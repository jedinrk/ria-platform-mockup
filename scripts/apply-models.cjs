// Apply data/models.json to the app dataset.
//
// This is the hierarchy switch. The allocation tree stops being
//
//     Asset class > Instrument type > Security
//
// which groups by the vehicle an instrument happens to be, and becomes
//
//     Asset class > Super sector > Sector > Sub-sector > Security
//
// which groups by what it is exposed to. A firm sets policy on large-cap equity
// or corporate credit, not on "ETFs", so the second is what a model should
// target.
//
// The tree runs to securities everywhere, because a portfolio shows what it
// holds at every level. A model stops at the depth its asset class is modelled
// to; below that it says nothing, which is not the same as a target of zero.
//
// Usage: node scripts/apply-models.cjs
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dataPath = path.join(root, 'data/original-mockup.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const definitions = JSON.parse(fs.readFileSync(path.join(root, 'data/models.json'), 'utf8'));

const byKey = new Map(definitions.nodes.map(node => [node.key, node]));
const children = new Map();
for (const node of definitions.nodes) {
 if (!node.parent) continue;
 if (!children.has(node.parent)) children.set(node.parent, []);
 children.get(node.parent).push(node);
}
const securityByName = new Map(data.securities.map(s => [s.name, s]));

// The implied share each security carries: a target-level node's target is
// shared across the securities under it, pro rata to what is held.
const securitiesUnder = key => {
 const out = [];
 const walk = node => {
  if (node.level === 4) { out.push(node.label); return }
  for (const child of children.get(node.key) || []) walk(child);
 };
 walk(byKey.get(key));
 return out;
};
function impliedHoldingPercent(model) {
 const out = new Map();
 for (const [key, target] of Object.entries(model.targetsByNodeKey)) {
  if (!target) continue;
  const names = securitiesUnder(key);
  if (!names.length) continue;
  const total = names.reduce((sum, name) => sum + (securityByName.get(name)?.baseValueLakh || 0), 0);
  for (const name of names) {
   const weight = total > 0.0001 ? (securityByName.get(name)?.baseValueLakh || 0) / total : 1 / names.length;
   out.set(name, (out.get(name) || 0) + target * weight);
  }
 }
 return out;
}

// The full tree, to securities, in taxonomy order. A branch holding nothing and
// targeted by no model is dropped: it would be a row that can never say anything.
const modelled = new Set();
for (const model of definitions.models)
 for (const [key, target] of Object.entries(model.targetsByNodeKey)) if (target > 0) modelled.add(key);
const moderate = impliedHoldingPercent(definitions.models.find(m => m.name === 'Moderate'));

function build(node) {
 const kids = (children.get(node.key) || []).map(build).filter(Boolean);
 if (node.level === 4) {
  const security = securityByName.get(node.label);
  if (!security) return null;
  return {
   n: node.label, key: node.key, level: 4,
   v: security.baseValueLakh, tg: moderate.get(node.label) || 0,
   ...(security.physical ? {p: 1} : {}),
   c: [],
  };
 }
 const holdsSomething = kids.length > 0;
 if (!holdsSomething && !modelled.has(node.key)) return null;
 return {
  n: node.label, key: node.key, level: node.level,
  tg: kids.reduce((sum, child) => sum + child.tg, 0),
  targetLevel: node.level === definitions.modelDepthByClass[node.assetClass],
  c: kids,
 };
}
const hierarchy = definitions.assetClasses.map(assetClass => build(byKey.get(assetClass))).filter(Boolean);

// Model targets keyed by node, not by a positional array: the tree a model
// covers is no longer the tree a portfolio displays.
const modelTargets = {};
const modelDefinitions = {};
for (const model of definitions.models) {
 modelTargets[model.name] = model.targetsByNodeKey;
 modelDefinitions[model.name] = {
  name: model.name, kind: model.kind, riskProfile: model.riskProfile,
  abbreviation: model.abbreviation, description: model.description,
  assetClassPercent: model.assetClassPercent,
  impliedHoldingPercent: Object.fromEntries(impliedHoldingPercent(model)),
 };
}

// Every household and account keeps its model. The three risk-based names carry
// over unchanged; two households move to a strategy model, as the revised
// mockup has them.
const STRATEGY_ASSIGNMENT = {h4: 'Dividend reinvestment', h6: 'Growth'};
for (const household of data.households) {
 household.modelName = STRATEGY_ASSIGNMENT[household.id] || household.riskProfile;
 household.riskProfile = modelDefinitions[household.modelName].riskProfile;
}
for (const account of data.accounts) {
 const household = data.households.find(h => h.id === account.householdId);
 account.modelName = household.modelName;
 account.riskProfile = household.riskProfile;
}

data.assetHierarchy = hierarchy;
data.modelTargets = modelTargets;
data.settings.models = modelDefinitions;
data.settings.modelDepthByClass = definitions.modelDepthByClass;
data.settings.defaultBandsByLevel = definitions.defaultBandsByLevel;
data.settings.levelNames = definitions.levelNames;
data.settings.nodes = definitions.nodes;
data.metadata.models = {
 sourceFile: definitions.metadata.sourceFile,
 sourceSha256: definitions.metadata.sourceSha256,
 note: 'Models and the allocation hierarchy come from data/models.json. The tree runs to securities; a model stops at the depth its asset class is modelled to.',
};

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');

const countAt = level => definitions.nodes.filter(n => n.level === level).length;
process.stderr.write(`hierarchy: ${hierarchy.length} asset classes, ${countAt(1)} super sectors, ${countAt(2)} sectors, ${countAt(3)} sub-sectors, ${data.securities.length} securities\n`);
process.stderr.write(`models: ${definitions.models.length} (${definitions.models.filter(m => m.kind === 'Risk-based').length} risk-based, ${definitions.models.filter(m => m.kind === 'Strategy').length} strategy)\n`);
for (const household of data.households) process.stderr.write(`  ${household.name}: ${household.modelName} (${household.riskProfile})\n`);
