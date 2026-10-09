// Build the firm's model portfolios from the revised wireframe.
//
// A model sets a target and a tolerance band on the classification tree, down to
// a depth chosen per asset class. Below that depth a portfolio still shows what
// it holds, but the model has nothing to say about it. The children of a node
// always add up to it, so a model is 100% by construction.
//
// Usage: node scripts/build-models.cjs > data/models.json
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
for (const name of ['CLS', 'LVN', 'TX', 'DEP', 'DEFB', 'MT0L', 'MI']) {
 raw[name] = vm.runInContext('(' + sliceDeclaration(name) + ')', sandbox, {timeout: 2000});
}

const master = JSON.parse(fs.readFileSync('data/security-master.json', 'utf8'));
const depthByClass = Object.fromEntries(raw.CLS.map((name, i) => [name, raw.DEP[i]]));
const nodeKey = parts => parts.join('|');

// Every node the taxonomy declares, plus the securities beneath it. A model may
// target a node the firm does not hold yet, so empty nodes are legitimate.
const nodes = [];
const seen = new Set();
const addNode = (key, parent, level, label, assetClass) => {
 if (seen.has(key)) return;
 seen.add(key);
 nodes.push({key, parent, level, label, assetClass});
};
for (const assetClass of raw.CLS) addNode(assetClass, null, 0, assetClass, assetClass);
for (const row of master.taxonomy) {
 let key = row.assetClass;
 for (const [level, label] of [[1, row.superSector], [2, row.sector], [3, row.subSector]]) {
  const child = key + '|' + label;
  addNode(child, key, level, label, row.assetClass);
  key = child;
 }
}
for (const instrument of master.instruments) {
 const path = [instrument.assetClass, instrument.superSector, instrument.sector, instrument.subSector];
 let key = path[0];
 for (let level = 1; level < 4; level++) {
  const child = key + '|' + path[level];
  addNode(child, key, level, path[level], instrument.assetClass);
  key = child;
 }
 addNode(key + '|' + instrument.name, key, 4, instrument.name, instrument.assetClass);
}

// The level a model stops at, per asset class.
const isTargetLevel = node => node.level === depthByClass[node.assetClass];
const targetNodes = nodes.filter(isTargetLevel);

// The wireframe keys a target by the label of its terminal node, which is
// unambiguous because a label is only reused across asset classes.
const models = Object.entries(raw.MT0L).map(([name, byLabel]) => {
 const info = raw.MI[name];
 const targets = {};
 for (const node of targetNodes) targets[node.key] = byLabel[node.label] || 0;
 const unmatched = Object.keys(byLabel).filter(label => !targetNodes.some(n => n.label === label));
 if (unmatched.length) throw new Error(name + ' targets a node that is not at a target level: ' + unmatched.join(', '));
 const total = Object.values(targets).reduce((a, b) => a + b, 0);
 if (Math.abs(total - 100) > 0.01) throw new Error(name + ' totals ' + total + '%, expected 100%');
 return {
  name,
  kind: info.k,
  // The risk profile the model is intended for. A strategy model names one too,
  // so model choice and assessed risk stay separate questions.
  riskProfile: info.risk,
  abbreviation: info.ab,
  description: info.d,
  targetsByNodeKey: targets,
  assetClassPercent: Object.fromEntries(raw.CLS.map(assetClass => [assetClass,
   targetNodes.filter(n => n.assetClass === assetClass).reduce((sum, n) => sum + targets[n.key], 0)])),
 };
});

process.stdout.write(JSON.stringify({
 schemaVersion: 1,
 metadata: {
  sourceFile: SOURCE.split('/').pop(),
  sourceSha256: crypto.createHash('sha256').update(html).digest('hex'),
  notes: [
   'A model sets a target and a tolerance band on the classification tree, down to the depth its asset class is modelled to.',
   'Below that depth a portfolio shows what it holds and the model says nothing, which is different from a target of zero.',
   'The children of a node always add up to it, so editing a node rescales what is under it and moves its siblings.',
   'All targets are illustrative sample policy, not investment advice.',
  ],
 },
 assetClasses: raw.CLS,
 levelNames: raw.LVN,
 modelDepthByClass: depthByClass,
 // Index 0 is the asset class, whose band is the portfolio threshold rather than
 // a model setting, so it has none here.
 defaultBandsByLevel: raw.DEFB,
 nodes,
 models,
}, null, 2) + '\n');
