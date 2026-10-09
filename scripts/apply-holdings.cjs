// Regenerate each account's holdings from the model it follows.
//
// The sample holdings were materialized once, against the models of the first
// mockup, and have been carried through every migration since. The models have
// moved on twice. The result was a portfolio holding one generation's weights
// and being measured against another's, so every household read "needs review"
// for a reason that said more about our data than about the portfolio.
//
// The revised wireframe derives holdings from the model instead:
//
//     raw[i] = max(0.05, impliedTarget[i]) * max(0.05, 1 + spread * (noise * 2 - 1))
//     holding = raw[i] * accountAum / sum(raw)
//
// so an account holds a spread around its own model, scaled to its AUM. The
// floor of 0.05 means every instrument is held at least slightly, including the
// ones the model gives nothing to.
//
// One account is deliberately exempt. The joint account carries the raw base
// vector rather than a model spread, exactly as the wireframe has it, so there
// is always one portfolio visibly off its model to review.
//
// Usage: node scripts/apply-holdings.cjs
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dataPath = path.join(root, 'data/original-mockup.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// The wireframe's deterministic noise: the same account and instrument always
// produce the same figure, so the sample is reproducible rather than random.
const noise = (a, b) => {
 const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
 return x - Math.floor(x);
};

const before = data.accounts.map(a => a.holdings.reduce((sum, h) => sum + h.valueLakh, 0));

for (const account of data.accounts) {
 const implied = data.settings.models[account.modelName].impliedHoldingPercent;
 const spread = account.generation.spread || 0;
 const seed = Number(account.id.slice(1));
 const raw = data.securities.map((security, i) =>
  Math.max(0.05, implied[security.name] || 0) * Math.max(0.05, 1 + spread * (noise(seed, i) * 2 - 1)));
 const total = raw.reduce((a, b) => a + b, 0);
 const scale = account.aumLakh / total;
 account.holdings = data.securities.map((security, i) => {
  const valueLakh = account.generation.usesBase ? security.baseValueLakh : raw[i] * scale;
  return {
   securityId: security.id,
   valueLakh,
   // Cost basis scales with the position, as it did when the sample was first
   // materialized. These remain illustrative placeholders.
   costBasisLakh: security.costBasisLakh * valueLakh / security.baseValueLakh,
  };
 });
}

data.metadata.holdings = {
 note: 'Each account holds a deterministic spread around the model it follows, scaled to its AUM, as the revised wireframe generates them. The joint account carries the raw base vector instead, so one portfolio is always visibly off its model. All figures are illustrative.',
 generatedFrom: 'data/models.json implied holding percentages',
};

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');

const after = data.accounts.map(a => a.holdings.reduce((sum, h) => sum + h.valueLakh, 0));
process.stderr.write('account'.padEnd(34) + 'holdings   AUM before -> after\n');
data.accounts.forEach((account, i) => {
 process.stderr.write(`${account.name.slice(0, 32).padEnd(34)}${String(account.holdings.length).padStart(5)}   ${before[i].toFixed(1).padStart(8)} -> ${after[i].toFixed(1)}${account.generation.usesBase ? '   (base vector, left off-model)' : ''}\n`);
});
process.stderr.write(`\ntotal ${before.reduce((a, b) => a + b, 0).toFixed(1)} -> ${after.reduce((a, b) => a + b, 0).toFixed(1)}\n`);
