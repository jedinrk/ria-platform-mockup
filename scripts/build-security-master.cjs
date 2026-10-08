// Build the firm instrument master from the revised wireframe, in the shape the
// RIA-AssetConfig-Type1 sheet defines.
//
//   Name | ISIN | Symbol | Crisil Rating | Current Price | AssetType | Asset Class | Sector | Sub-sector
//
// The sheet marks Name and ISIN <<Autocomplete>>, Symbol / Crisil Rating /
// Current Price / AssetType <<Fixed>> (they arrive from the instrument source),
// and Asset Class / Sector / Sub-sector <<DropDown>> (the firm's decision).
// Super sector is a fourth firm-decided level the revised mockup introduces
// between Asset Class and Sector.
//
// Usage: node scripts/build-security-master.cjs > data/security-master.json
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

const SOURCE = process.argv[2] || 'docs/sources/Portfolio Console – wireframes v3.html';
const html = fs.readFileSync(SOURCE, 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Slice a named declaration's initialiser without running the file's DOM code.
// The source packs several declarators into one `const`, so each statement is
// walked declarator by declarator.
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
for (const name of ['CLS', 'LVN', 'U', 'TX', 'RISK', 'CRD', 'DUR', 'INS', 'NIFTY', 'X', 'SEC', 'BASE', 'LQ', 'M']) {
 raw[name] = vm.runInContext('(' + sliceDeclaration(name) + ')', sandbox, {timeout: 2000});
}

// Exchange symbols confirmed against public listings. Only instruments with a
// single unambiguous listed symbol are filled; a generic sample name such as
// "Silver ETF" maps to no one real product, and a mutual fund has no exchange
// symbol at all, so those stay null rather than being invented.
const SYMBOLS = {
 'HDFC Bank': 'HDFCBANK',
 'Infosys': 'INFY',
 'Reliance Industries': 'RELIANCE',
 'Bajaj Finance': 'BAJFINANCE',
 'Hindustan Unilever': 'HINDUNILVR',
 'Sun Pharma': 'SUNPHARMA',
 'Larsen & Toubro': 'LT',
 'Nippon Nifty BeES': 'NIFTYBEES',
 'Embassy REIT': 'EMBASSY',
 'IRB InvIT': 'IRBINVIT',
};

// The instrument types whose attribute set includes a credit rating. For
// anything else a Crisil rating does not apply, which is different from a debt
// instrument that simply has none recorded.
const RATED_TYPES = new Set(Object.entries(raw.INS)
 .filter(([, fields]) => fields.some(([key]) => key === 'rating'))
 .map(([name]) => name));

const instrumentTypes = Object.entries(raw.INS).map(([name, fields]) => ({
 name,
 ratingApplies: RATED_TYPES.has(name),
 attributes: fields.map(([key, label, kind, unitOrOptions]) => ({
  key, label,
  kind: kind === 'n' ? 'number' : kind === 's' ? 'select' : 'text',
  unit: kind === 'n' ? (unitOrOptions ?? null) : null,
  options: kind === 's' ? unitOrOptions : null,
 })),
}));

const taxonomy = [];
for (const assetClass of raw.CLS)
 for (const [superSector, sectors] of (raw.TX[assetClass] || []))
  for (const [sector, subSectors] of sectors)
   for (const subSector of subSectors) taxonomy.push({assetClass, superSector, sector, subSector});

const instruments = raw.SEC.map((s, i) => {
 const [assetClass, superSector = null, sector = null, subSector = null] = s.pa;
 const tax = raw.M[s.n];
 return {
  // The nine sheet columns, in sheet order.
  name: s.n,
  isin: null,
  symbol: SYMBOLS[s.n] ?? null,
  crisilRating: s.a.rating ?? null,
  currentPrice: null,
  assetType: s.type,
  assetClass,
  superSector,
  sector,
  subSector,
  // Supporting data the revised mockup adds beyond the sheet.
  themes: s.th,
  attributes: s.a,
  physical: !!s.p,
  ratingApplies: RATED_TYPES.has(s.type),
  baseValueLakh: raw.BASE[i],
  costBasisLakh: tax.c,
  illustrativeTaxRatePercent: tax.r,
  liquidity: raw.LQ[tax.l],
  liquidityCode: tax.l,
  originalNote: tax.t,
  lookThrough: s.lt ? {
   sector: s.lt.sec.map(([bucket, weight]) => ({bucket, weight})),
   marketCap: s.lt.mc.map(([bucket, weight]) => ({bucket, weight})),
   geography: s.lt.geo.map(([bucket, weight]) => ({bucket, weight})),
  } : null,
 };
});

process.stdout.write(JSON.stringify({
 schemaVersion: 1,
 metadata: {
  sheet: 'RIA-AssetConfig-Type1',
  sourceFile: SOURCE.split('/').pop(),
  sourceSha256: crypto.createHash('sha256').update(html).digest('hex'),
  columns: ['Name', 'ISIN', 'Symbol', 'Crisil Rating', 'Current Price', 'AssetType', 'Asset Class', 'Super sector', 'Sector', 'Sub-sector'],
  editableColumns: ['Asset Class', 'Super sector', 'Sector', 'Sub-sector'],
  notes: [
   'ISIN and Current Price are not supplied by any available source: the sheet is a blank template and the revised wireframe carries neither. They stay null rather than being invented.',
   'Symbol is filled only where one real listed symbol is unambiguous. Mutual funds have no exchange symbol; generic sample names such as "Silver ETF" map to no single product.',
   'Crisil Rating is populated from the revised wireframe credit rating, which exists only for instrument types whose attribute set defines one. ratingApplies distinguishes "not applicable" from "not recorded".',
   'Attributes beyond the sheet columns depend on the instrument type and are stored but not displayed on the configuration grid.',
   'All values are illustrative sample data, not verified instrument reference data or current prices.',
  ],
 },
 assetClasses: raw.CLS,
 levelNames: raw.LVN,
 unclassifiedLabel: raw.U,
 taxonomy,
 instrumentTypes,
 ratingScale: raw.CRD,
 riskScale: raw.RISK,
 durationBuckets: raw.DUR,
 instruments,
}, null, 2) + '\n');
