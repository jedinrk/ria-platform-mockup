// Apply data/security-master.json to the app dataset.
//
// The instrument master is the system of record for what an instrument is and
// where it is classified. This rewrites the dataset's securities, the allocation
// hierarchy and the model target vectors to agree with it, and leaves recorded
// holdings alone: an instrument in the master that no portfolio holds is normal.
//
// Usage: node scripts/apply-security-master.cjs
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dataPath = path.join(root, 'data/original-mockup.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const master = JSON.parse(fs.readFileSync(path.join(root, 'data/security-master.json'), 'utf8'));

// Existing instruments keep their id so recorded holdings keep resolving.
const existingIdByName = new Map(data.securities.map(s => [s.name, s.id]));
const previousByName = new Map(data.securities.map(s => [s.name, s]));
let nextId = data.securities.length;

const securities = master.instruments.map(instrument => {
 const previous = previousByName.get(instrument.name);
 const id = existingIdByName.get(instrument.name) || 'security-' + (++nextId);
 return {
  id,
  name: instrument.name,
  // The sheet's source-supplied columns.
  isin: instrument.isin,
  symbol: instrument.symbol,
  crisilRating: instrument.crisilRating,
  currentPrice: instrument.currentPrice,
  ratingApplies: instrument.ratingApplies,
  assetType: instrument.assetType,
  // The firm's classification.
  assetClass: instrument.assetClass,
  superSector: instrument.superSector,
  // The allocation hierarchy groups by instrument type, so subcategory mirrors it.
  subcategory: instrument.assetType,
  baseValueLakh: instrument.baseValueLakh,
  moderateTargetPercent: previous ? previous.moderateTargetPercent : 0,
  physical: instrument.physical,
  costBasisLakh: instrument.costBasisLakh,
  illustrativeTaxRatePercent: instrument.illustrativeTaxRatePercent,
  liquidity: instrument.liquidity,
  liquidityCode: instrument.liquidityCode,
  originalNote: instrument.originalNote,
  tags: {
   sector: instrument.sector,
   subsector: instrument.subSector,
   marketCap: instrument.attributes.mcap ?? null,
   geography: instrument.attributes.geo ?? null,
   themes: instrument.themes,
   // The renameable Core / Satellite lens is not carried forward.
   custom: null,
   creditQuality: instrument.crisilRating,
   duration: instrument.attributes.dur ?? null,
   isDebt: instrument.assetClass === 'Fixed income',
  },
  // Attributes beyond the sheet columns, keyed by the instrument type's schema.
  attributes: instrument.attributes,
  lookThrough: instrument.lookThrough,
 };
});

// Allocation hierarchy: Asset class > Instrument type > Instrument, in master order.
const hierarchy = [];
for (const assetClass of master.assetClasses) {
 const inClass = securities.filter(s => s.assetClass === assetClass);
 if (!inClass.length) continue;
 const types = [...new Set(inClass.map(s => s.assetType))];
 hierarchy.push({
  n: assetClass, tg: 0,
  c: types.map(type => ({
   n: type, tg: 0,
   c: inClass.filter(s => s.assetType === type)
    .map(s => ({n: s.name, v: s.baseValueLakh, tg: 0, ...(s.physical ? {p: 1} : {})})),
  })),
 });
}
const leafOrder = hierarchy.flatMap(c => c.c.flatMap(g => g.c.map(leaf => leaf.n)));

// Model targets keep each instrument's existing weight and give a newly added
// instrument 0%, so every profile still totals 100%.
const previousLeafOrder = data.assetHierarchy.flatMap(c => c.c.flatMap(g => g.c.map(leaf => leaf.n)));
const modelTargets = {};
for (const [profile, weights] of Object.entries(data.modelTargets)) {
 const byName = new Map(previousLeafOrder.map((name, i) => [name, weights[i]]));
 modelTargets[profile] = leafOrder.map(name => byName.get(name) ?? 0);
}
// Roll the Moderate weights up through the hierarchy for display.
{
 const moderate = new Map(leafOrder.map((name, i) => [name, modelTargets.Moderate[i]]));
 for (const assetClass of hierarchy) {
  for (const type of assetClass.c) {
   for (const leaf of type.c) leaf.tg = moderate.get(leaf.n);
   type.tg = type.c.reduce((sum, leaf) => sum + leaf.tg, 0);
  }
  assetClass.tg = assetClass.c.reduce((sum, type) => sum + type.tg, 0);
 }
 for (const s of securities) s.moderateTargetPercent = moderate.get(s.name) ?? 0;
}

for (const [profile, weights] of Object.entries(modelTargets)) {
 const total = weights.reduce((a, b) => a + b, 0);
 if (Math.abs(total - 100) > 0.01) throw new Error(profile + ' totals ' + total + '%, expected 100%');
}
const held = new Set(data.accounts.flatMap(a => a.holdings.map(h => h.securityId)));
for (const id of held) if (!securities.some(s => s.id === id)) throw new Error('A recorded holding lost its instrument: ' + id);

data.securities = securities;
data.assetHierarchy = hierarchy;
data.modelTargets = modelTargets;
data.settings.classificationOrder = {
 ...data.settings.classificationOrder,
 sec: [...new Set(securities.map(s => s.tags.sector).filter(Boolean))],
 sub: [...new Set(securities.map(s => s.tags.subsector).filter(Boolean))],
 superSector: [...new Set(securities.map(s => s.superSector).filter(Boolean))],
};
data.settings.instrumentTypes = master.instrumentTypes;
data.settings.taxonomy = master.taxonomy;
data.settings.ratingScale = master.ratingScale;
delete data.settings.customLensName;
data.metadata.securityMaster = {
 sourceFile: master.metadata.sourceFile,
 sourceSha256: master.metadata.sourceSha256,
 sheet: master.metadata.sheet,
 note: 'Instruments, instrument types and classification come from data/security-master.json, built from the revised wireframe to the RIA-AssetConfig-Type1 column set. Recorded holdings are unchanged, so an instrument the sample does not hold shows no value.',
};

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');
const heldCount = securities.filter(s => held.has(s.id)).length;
process.stderr.write(`securities ${securities.length} (${heldCount} held, ${securities.length - heldCount} in the master only)\n`);
process.stderr.write(`asset classes ${hierarchy.map(c => c.n + ' ' + c.tg.toFixed(1) + '%').join(', ')}\n`);
