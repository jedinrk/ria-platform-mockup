'use strict';
// The classification tree the firm sets policy on.
//
//     Asset class > Super sector > Sector > Sub-sector > Security
//
// A portfolio reads the whole tree, because it holds securities. A model stops
// at the depth its asset class is modelled to: below that it has nothing to say,
// which is different from a target of zero. The children of a node always add up
// to it, so a model totals 100% by construction rather than by arithmetic the
// adviser has to do.
//
// Nothing here touches the DOM, localStorage, an approved client target or a
// recorded holding.
const TAX = (() => {
 const settings = () => originalData.settings;
 const CLASSES = () => originalData.assetHierarchy.map(c => c.n);
 const depthOf = assetClass => settings().modelDepthByClass[assetClass];
 const defaultBand = level => settings().defaultBandsByLevel[level];
 const levelName = level => settings().levelNames[level];

 // The tree, indexed once. Security nodes carry the index of what they describe.
 let NODES = [], BY_KEY = new Map(), CHILDREN = new Map();
 function build() {
  NODES = settings().nodes.map(node => ({...node, children: [], holdings: []}));
  BY_KEY = new Map(NODES.map(node => [node.key, node]));
  CHILDREN = new Map();
  const indexByName = new Map(originalData.securities.map((s, i) => [s.name, i]));
  for (const node of NODES) {
   if (node.level === 4) node.securityIndex = indexByName.get(node.label);
   if (!node.parent) continue;
   const parent = BY_KEY.get(node.parent);
   if (parent) parent.children.push(node);
   if (!CHILDREN.has(node.parent)) CHILDREN.set(node.parent, []);
   CHILDREN.get(node.parent).push(node);
  }
  // Roll each security up through its ancestors, so any node can total what
  // sits beneath it in one pass.
  for (const node of NODES) {
   if (node.securityIndex === undefined) continue;
   for (let key = node.key; key; key = BY_KEY.get(key).parent) BY_KEY.get(key).holdings.push(node.securityIndex);
  }
 }
 build();

 const isTargetLevel = node => node.level === depthOf(node.assetClass);
 const nodePath = key => key.split('|').join(' › ');

 // ---- The model's own tree ------------------------------------------------
 // What the model store holds: the taxonomy down to each asset class's depth,
 // with a target and a band on every node.
 function modelTree(modelName, zero) {
  const targets = originalData.modelTargets[modelName] || {};
  const expand = node => {
   if (node.level > depthOf(node.assetClass)) return null;
   const kids = node.children.map(expand).filter(Boolean);
   const terminal = isTargetLevel(node);
   const out = {
    id: node.key, key: node.key, name: node.label, level: node.level,
    targetLevel: terminal,
    securityCount: node.holdings.length,
    band: node.level === 0 ? settings().firmThresholdPP : defaultBand(node.level),
    children: kids,
   };
   out.target = terminal ? (zero ? 0 : (targets[node.key] || 0)) : kids.reduce((sum, child) => sum + child.target, 0);
   return out;
  };
  return NODES.filter(n => n.level === 0).map(expand).filter(Boolean);
 }
 const walkTree = (nodes, visit) => {
  for (const node of nodes) { visit(node); walkTree(node.children || [], visit) }
 };
 function targetsFromTree(allocations) {
  const out = {};
  walkTree(allocations, node => { if (node.targetLevel) out[node.key] = node.target });
  return out;
 }
 function bandsFromTree(allocations) {
  const out = {};
  walkTree(allocations, node => { if (node.level > 0 && node.band !== undefined) out[node.key] = node.band });
  return out;
 }

 // Editing a node rescales its target-level descendants and moves its siblings,
 // so the level above never changes and the model stays at 100%.
 function editModelTree(allocations, key, value) {
  const parents = new Map();
  walkTree(allocations, node => { for (const child of node.children || []) parents.set(child.key, node) });
  let node = null;
  walkTree(allocations, candidate => { if (candidate.key === key) node = candidate });
  if (!node) return false;
  const parent = parents.get(key) || null;
  const ceiling = parent ? parent.target : 100;
  value = Math.max(0, Math.min(ceiling, Math.round(value * 10000) / 10000));
  const terminals = from => { const out = []; walkTree([from], n => { if (n.targetLevel) out.push(n) }); return out };
  const scale = (from, to) => {
   let list = terminals(from);
   const before = list.reduce((sum, n) => sum + n.target, 0);
   // With nothing to scale, spread across whatever actually holds something.
   if (before <= 0) { const held = list.filter(n => n.securityCount); if (held.length) list = held }
   for (const n of list) n.target = Math.round((before > 0 ? n.target * to / before : to / list.length) * 10000) / 10000;
  };
  const siblings = (parent ? parent.children : allocations).filter(n => n.key !== key);
  const siblingTotal = siblings.reduce((sum, n) => sum + n.target, 0);
  const remaining = Math.max(0, ceiling - value);
  if (!siblings.length) value = ceiling;
  else for (const sibling of siblings) scale(sibling, siblingTotal > 0 ? sibling.target * remaining / siblingTotal : remaining / siblings.length);
  scale(node, value);
  const roll = n => { if (!n.children.length) return n.target; n.target = n.children.reduce((sum, c) => sum + roll(c), 0); return n.target };
  allocations.forEach(roll);
  return true;
 }

 // ---- A portfolio against its target --------------------------------------
 // One pass over the whole tree: value, share, target, band, drift, and what it
 // would take to close the gap. `targets` is the approved client target keyed by
 // node; overrides are this portfolio's own adjustments on top of it.
 function rowsFor(entity) {
  const vector = entity.vector;
  const total = vector.reduce((a, b) => a + b, 0) || 1;
  const base = entity.targets || originalData.modelTargets[entity.modelName] || {};
  const targets = entity.targetOverrides ? {...base, ...entity.targetOverrides} : base;
  const modelOnly = originalData.modelTargets[entity.modelName] || base;
  const bands = entity.bands || {};
  const portfolioBands = entity.bandOverrides || {};
  const rows = NODES.map(node => ({
   key: node.key, parent: node.parent, level: node.level, label: node.label,
   assetClass: node.assetClass, securityIndex: node.securityIndex,
   isSecurity: node.level === 4, holdings: node.holdings,
   securityCount: node.holdings.length,
   value: node.holdings.reduce((sum, h) => sum + vector[h], 0),
   children: [],
  }));
  const by = new Map(rows.map(row => [row.key, row]));
  for (const row of rows) {
   row.current = row.value / total * 100;
   if (row.parent && by.has(row.parent)) by.get(row.parent).children.push(row);
  }
  for (let i = rows.length - 1; i >= 0; i--) {
   const row = rows[i];
   const depth = depthOf(row.assetClass);
   if (row.level === depth) {
    row.isTargetLevel = true;
    row.target = targets[row.key] || 0;
    row.modelTarget = modelOnly[row.key] || 0;
   } else if (row.level < depth) {
    row.target = row.children.reduce((sum, c) => sum + (c.target || 0), 0);
    row.modelTarget = row.children.reduce((sum, c) => sum + (c.modelTarget || 0), 0);
   } else {
    // Below the level the model speaks at. A portfolio still shows what it
    // holds here; it simply has nothing to be measured against.
    row.target = null;
    row.modelTarget = null;
    row.belowTargetLevel = true;
   }
   row.modelBand = row.level === 0 ? settings().firmThresholdPP : (bands[row.key] ?? defaultBand(row.level));
   row.portfolioBand = row.level === 0 ? undefined : portfolioBands[row.key];
   row.band = row.level === 0
    ? (entity.threshold ?? settings().firmThresholdPP)
    : (portfolioBands[row.key] ?? bands[row.key] ?? defaultBand(row.level));
   if (row.target != null) {
    row.drift = row.current - row.target;
    row.outsideBand = Math.abs(row.drift) > row.band && (row.current >= 0.05 || row.target >= 0.05);
    row.amountLakh = row.target / 100 * total - row.value;
    row.source = Math.abs(row.target - row.modelTarget) > 0.005 ? 'Portfolio override' : 'Model';
   }
  }
  // Only the most specific breach is reported: a parent outside its band
  // because a child is outside its band is one problem, not two.
  for (const row of rows) row.counts = !!row.outsideBand && !row.children.some(c => c.outsideBand);
  rows.by = by;
  rows.total = total;
  return rows;
 }

 const breaches = rows => rows.filter(r => r.counts).sort((a, b) => (Math.abs(b.drift) - b.band) - (Math.abs(a.drift) - a.band));
 const assetClassRows = rows => rows.filter(r => r.level === 0);

 // ---- Tags ----------------------------------------------------------------
 // The attributes of the securities under a node. Filtering a deep tree by what
 // the instruments actually are is the point: "show me the high-risk, locked
 // branches" is a real question.
 const TAG_GROUPS = ['Instrument type', 'Theme', 'Market cap', 'Risk rating', 'Credit rating', 'Duration', 'Liquidity', 'Geography'];
 const bucketOf = (value, edges) => { for (const [limit, label] of edges) if (value < limit) return label; return edges[edges.length - 1][1] };
 function securityTags(index) {
  const s = originalData.securities[index];
  if (!s) return [];
  const a = s.attributes || {};
  const tags = [['Instrument type', s.assetType]];
  for (const theme of s.themes || s.tags.themes || []) tags.push(['Theme', theme]);
  if (a.mcap) tags.push(['Market cap', a.mcap]);
  if (a.risk) tags.push(['Risk rating', a.risk]);
  if (s.crisilRating) tags.push(['Credit rating', s.crisilRating]);
  if (a.dur) tags.push(['Duration', a.dur]);
  tags.push(['Liquidity', s.liquidity]);
  if (a.geo) tags.push(['Geography', a.geo]);
  const rate = a.cpn !== undefined ? a.cpn : a.rate;
  if (rate !== undefined) tags.push(['Coupon / rate', bucketOf(rate, [[7, 'Below 7%'], [9, '7 to 9%'], [1e9, '9% and above']])]);
  return tags;
 }

 // Published models drive every drift calculation, so the live targets are
 // refreshed from the store rather than kept in parallel with it.
 function syncModelTargets(store) {
  for (const model of store) {
   const published = model.versions && model.versions[model.versions.length - 1];
   if (!published || !published.data || !published.data.allocations || !published.data.allocations.length) continue;
   originalData.modelTargets[published.data.name] = targetsFromTree(published.data.allocations);
  }
 }

 return {
  get nodes() { return NODES },
  get byKey() { return BY_KEY },
  CLASSES, depthOf, defaultBand, levelName, isTargetLevel, nodePath,
  modelTree, targetsFromTree, bandsFromTree, editModelTree, walkTree,
  rowsFor, breaches, assetClassRows,
  TAG_GROUPS, securityTags, syncModelTargets, rebuild: build,
 };
})();

// ---- A model's target expressed per security -------------------------------
// A model stops above securities for most asset classes, but almost everything
// downstream — exposure distributions, the trade engine, the recurring plan —
// needs to know what the target implies for each instrument. A target-level
// node's target is shared across the securities beneath it, pro rata to what is
// held there, which is the only split the model itself justifies.
TAX.impliedHoldingValues = function(allocations){
 const share=new Map();
 TAX.walkTree(allocations,node=>{
  if(!node.targetLevel||!node.target)return;
  const under=(TAX.byKey.get(node.key)||{holdings:[]}).holdings;
  if(!under.length)return;
  const total=under.reduce((sum,i)=>sum+originalData.securities[i].baseValueLakh,0);
  for(const i of under){
   const weight=total>0.0001?originalData.securities[i].baseValueLakh/total:1/under.length;
   share.set(i,(share.get(i)||0)+node.target*weight);
  }
 });
 return originalData.securities.map((s,i)=>({name:s.name,value:share.get(i)||0,category:s.assetClass,securityIndex:i}));
};
