'use strict';
const ComparisonData = (() => {
  function flatten(tree, path = []) {
    return tree.flatMap(node => {
      const names = [...path, node.name];
      return [{key: JSON.stringify(names), parent: path.length ? JSON.stringify(path) : null, names, node}, ...flatten(node.children || [], names)];
    });
  }
  function aligned(models) {
    const maps = models.map(model => new Map(flatten(model.allocations).map(row => [row.key, row.node])));
    const nodes = new Map();
    for (const model of models) for (const row of flatten(model.allocations)) if (!nodes.has(row.key)) nodes.set(row.key, row);
    const visit = parent => [...nodes.values()].filter(row => row.parent === parent).flatMap(row => {
      const children = [...nodes.values()].some(child => child.parent === row.key);
      return [{...row, children, values: maps.map(map => map.has(row.key) ? map.get(row.key).target : null)}, ...visit(row.key)];
    });
    return visit(null);
  }
  function exposures(model, securities, dimension, mode) {
    const buckets = new Map();
    let total = 0;
    for (const row of flatten(model.allocations).filter(row => !(row.node.children || []).length)) {
      const security = securities.find(s => s.name === row.node.name);
      if (dimension === 'credit' && !(security?.tags.isDebt || (!security && row.names[0] === 'Fixed income'))) continue;
      const weight = row.node.target;
      total += weight;
      let shares;
      if (!security) shares = [['Unclassified', 1]];
      else if (dimension === 'sector') shares = mode === 'look' && security.lookThrough ? security.lookThrough.sector.map(x => [x.bucket, x.weight]) : [[security.tags.sector || 'Unclassified', 1]];
      else if (dimension === 'geography' || dimension === 'marketCap') {
        // Single tag counts a fund in one bucket; its own tag if it has one,
        // otherwise its largest underlying bucket.
        const dominant = security.lookThrough?.[dimension]?.reduce((best, x) => x.weight > best.weight ? x : best)?.bucket;
        shares = mode === 'look' && security.lookThrough ? security.lookThrough[dimension].map(x => [x.bucket, x.weight]) : [[security.tags[dimension] || dominant || 'Unclassified', 1]];
      }
      else if (dimension === 'themes') shares = (security.tags.themes.length ? security.tags.themes : ['Unclassified']).map(name => [name, 1]);
      else if (dimension === 'credit') shares = [[(security.tags.creditQuality || 'Unclassified') + ' / ' + (security.tags.duration || 'Unclassified'), 1]];
      else shares = [[security.tags.custom || 'Unclassified', 1]];
      for (const [bucket, share] of shares) buckets.set(bucket, (buckets.get(bucket) || 0) + weight * share);
    }
    // Other dimensions are already percentages of the whole model. Credit is explicitly debt-only.
    if (dimension === 'credit' && total > 0) for (const [key, value] of buckets) buckets.set(key, value / total * 100);
    return {buckets, applicable: dimension !== 'credit' || total > 0};
  }
  return {flatten, aligned, exposures};
})();
if (typeof module !== 'undefined') module.exports = ComparisonData;
