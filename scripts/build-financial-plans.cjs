// Build the household financial plans from the revised wireframe.
//
// A plan is held at household level, not per account: income, liabilities and
// recurring needs belong to the family, and every account in it draws on the
// same ones. The wireframe builds each plan in three steps, and all three are
// reproduced here: the declared plan, a bundle of domestic costs scaled per
// household, and school fees for the three households that have children.
//
// Usage: node scripts/build-financial-plans.cjs > data/financial-plans.json
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

const SOURCE = process.argv[2] || 'docs/sources/Portfolio Console – wireframes v3.html';
const html = fs.readFileSync(SOURCE, 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function scanTo(start, stop) {
 const depth = [], open = {'(': ')', '[': ']', '{': '}'};
 for (let i = start; i < source.length; i++) {
  const c = source[i];
  if (c === '"' || c === "'" || c === '`') {
   const quote = c;
   for (i++; i < source.length; i++) { if (source[i] === '\\') { i++; continue } if (source[i] === quote) break }
   continue;
  }
  if (c === '/' && source[i + 1] === '/') { while (i < source.length && source[i] !== '\n') i++; continue }
  if (c === '/' && source[i + 1] === '*') { i = source.indexOf('*/', i) + 1; continue }
  if (open[c]) { depth.push(open[c]); continue }
  if (c === depth[depth.length - 1]) { depth.pop(); continue }
  if (!depth.length && stop(c, i)) return i;
 }
 return source.length;
}
function sliceDeclaration(name) {
 const keyword = /(?:^|[\s;{})])(?:const|let|var)\s+/g;
 for (let m; (m = keyword.exec(source));) {
  const end = scanTo(m.index + m[0].length, c => c === ';' || c === '\n');
  let i = m.index + m[0].length;
  while (i < end) {
   const declarator = /^([A-Za-z_$][\w$]*)\s*=/.exec(source.slice(i, end));
   if (!declarator) break;
   const valueStart = i + declarator[0].length;
   const valueEnd = Math.min(scanTo(valueStart, (c, j) => (c === ',' || c === ';') && j < end), end);
   if (declarator[1] === name) return source.slice(valueStart, valueEnd).trim();
   i = valueEnd + 1;
   while (i < end && /\s/.test(source[i])) i++;
  }
 }
 throw new Error('Missing declaration: ' + name);
}
const raw = {};
const sandbox = vm.createContext(raw);
for (const name of ['HH', 'FIN0', 'r2', 'DOM', 'DSC', 'SCH', 'FREQ', 'LTYPES', 'NCAT', 'RET', 'MN', 'MORD']) {
 raw[name] = vm.runInContext('(' + sliceDeclaration(name) + ')', sandbox, {timeout: 2000});
}

// A yearly need without a stated month is assumed to fall in the month the
// wireframe assigns it: insurance in March, travel in May, everything else April.
const defaultDueMonth = category => category === 'Insurance premium' ? 3 : category === 'Travel and lifestyle' ? 5 : 4;

const plans = {};
for (const household of raw.HH) {
 const plan = JSON.parse(JSON.stringify(raw.FIN0[household.id]));
 for (const need of plan.needs) if (need.f === 'Yearly' && need.mo === undefined) need.mo = defaultDueMonth(need.c);
 // Domestic running costs, scaled by how big the household is.
 plan.needs.push(...raw.DOM(raw.DSC[household.id]));
 // School fees, for the households with children still in school.
 if (raw.SCH[household.id]) {
  plan.needs.push({n: 'School fees (current)', c: 'Education', a: raw.SCH[household.id][0], f: 'Quarterly', s: 0, d: raw.SCH[household.id][1], i: 8, mo: 4});
 }
 plans[household.id] = {
  householdId: household.id,
  householdName: household.n,
  monthlyIncomeLakh: plan.inc,
  incomeContinuesYears: plan.incYrs,
  incomeGrowthPercent: plan.ig,
  // Null means "use the blend implied by what is actually held".
  portfolioReturnPercent: plan.ret,
  monthlyInvestmentTargetLakh: plan.invT ?? null,
  liabilities: plan.liab.map(l => ({
   name: l.n, type: l.t, outstandingLakh: l.o, ratePercent: l.r, emiLakh: l.emi, monthsLeft: l.m,
  })),
  recurringNeeds: plan.needs.map(n => ({
   name: n.n, category: n.c, amountLakh: n.a, frequency: n.f,
   startsInYears: n.s, lastsYears: n.d, inflationPercent: n.i, dueMonth: n.mo ?? null,
  })),
 };
}

process.stdout.write(JSON.stringify({
 schemaVersion: 1,
 metadata: {
  sourceFile: SOURCE.split('/').pop(),
  sourceSha256: crypto.createHash('sha256').update(html).digest('hex'),
  notes: [
   'Income, liabilities and recurring needs are household facts. An account shows its household plan and says so.',
   'All amounts are in ₹ lakh and illustrative. Rates, balances and valuations are sample data, not a client record.',
   'A recurring need carries its own inflation rate, a start year and a duration, so a goal that begins later is expressed the same way as a cost that runs throughout.',
  ],
 },
 settings: {
  frequencyPerYear: raw.FREQ,
  liabilityTypes: raw.LTYPES,
  needCategories: raw.NCAT,
  blendedReturnByClassPercent: raw.RET,
  monthNames: raw.MN,
  financialYearMonthOrder: raw.MORD,
  horizonYears: 30,
  emergencyMonths: 6,
  // Categories the wireframe treats as ordinary domestic running costs, which
  // are worth separating from goals when an adviser reads the yearly total.
  domesticCategories: ['Domestic help & utilities', 'Property & society charges', 'Vehicle running', 'Home maintenance', 'Festivals & gifting'],
 },
 plans,
}, null, 2) + '\n');
