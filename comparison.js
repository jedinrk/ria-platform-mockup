'use strict';
const comparisonState = {
  selected: new Set(models.filter(m => latest(m)).slice(0, 3).map(m => m.id)),
  search: '', expanded: new Set(), lens: 'allocation', mode: 'look', active: false,
  exposureData: null, loading: false, error: false,
};
const comparisonLenses = [['allocation','Asset allocation'],['sector','Sector'],['geography','Geography'],['marketCap','Market cap'],['themes','Themes'],['credit','Credit & duration'],['custom','Core / Satellite']];
function modelSubnav(comparing) {
  return `<nav class="model-subnav" aria-label="Models views"><button data-compare-action="library" ${comparing?'':'aria-current="page"'}>Model library</button><button data-compare-action="compare" ${comparing?'aria-current="page"':''}>Model comparison</button></nav>`;
}
// Extend the existing library without changing the paused portfolio redesign.
const renderModelLibrary = list;
list = function() {
  comparisonState.active = false;
  renderModelLibrary();
  $('app').insertAdjacentHTML('afterbegin', modelSubnav(false));
  $('app').insertAdjacentHTML('beforeend', '<p><button data-compare-action="compare">Compare models →</button></p>');
};
function openComparison() {
  leaveModels();
  clientEditing = false;
  selected = null;
  navState('models');
  comparisonState.active = true;
  renderComparison();
}
async function loadComparisonExposures() {
  if (comparisonState.loading || comparisonState.exposureData) return;
  comparisonState.loading = true;
  comparisonState.error = false;
  try {
    const response = await fetch('data/model-exposures.json');
    if (!response.ok) throw new Error('Exposure data unavailable');
    comparisonState.exposureData = await response.json();
  } catch { comparisonState.error = true; }
  finally {
    comparisonState.loading = false;
    if (comparisonState.active && $('modelComparison')) renderComparison();
  }
}
function comparedModels() {
  return models.filter(m => comparisonState.selected.has(m.id) && latest(m));
}
function renderComparison() {
  const published = models.filter(m => latest(m));
  for (const id of comparisonState.selected) if (!published.some(m => m.id === id)) comparisonState.selected.delete(id);
  const picked = comparedModels();
  const matches = published.filter(m => (latest(m).data.name+' '+latest(m).data.description).toLowerCase().includes(comparisonState.search.toLowerCase()));
  $('footer').innerHTML = '';
  $('app').innerHTML = `${modelSubnav(true)}<section id="modelComparison"><div class="eyebrow">Investment strategy</div><h1>Model comparison</h1><p class="muted">Compare published strategies side by side. Choose up to four models.</p><div class="compare-layout"><section class="card"><h2>Choose models</h2><label class="field">Search models<input id="comparisonSearch" class="compare-search" type="search" placeholder="Name or intended use" value="${esc(comparisonState.search)}"></label><div class="compare-count" role="status">${picked.length} of 4 selected · ${published.length} available</div><div class="compare-options">${matches.map(m => `<label class="compare-choice"><input type="checkbox" data-compare-model="${esc(m.id)}" ${comparisonState.selected.has(m.id)?'checked':''} ${picked.length>=4&&!comparisonState.selected.has(m.id)?'disabled':''}><span><strong>${esc(latest(m).data.name)}</strong><br><small>${esc(latest(m).data.description)}</small></span></label>`).join('') || `<p class="muted">${published.length?'No models match your search.':'No published models yet. Publish a model to compare it here.'}</p>`}</div><p class="compare-selection-hint">${picked.length>=4?'Four selected. Remove one to compare another.':'Choose two to four for a side-by-side comparison.'}</p><button data-compare-action="clear" ${picked.length?'':'disabled'}>Clear selection</button><p class="compare-detail">Selections stay in place when you search. Draft changes are excluded.</p></section><section class="compare-panel"><div class="compare-tools"><label>View <select id="comparisonLens">${comparisonLenses.map(([key,label])=>`<option value="${key}" ${comparisonState.lens===key?'selected':''}>${label}</option>`).join('')}</select></label>${['sector','geography','marketCap'].includes(comparisonState.lens)?`<label>Funds and ETFs <select id="comparisonMode"><option value="look" ${comparisonState.mode==='look'?'selected':''}>Look-through</option><option value="tag" ${comparisonState.mode==='tag'?'selected':''}>Single tag</option></select></label>`:''}${comparisonState.lens==='allocation'?'<button data-compare-action="expand">Expand all</button><button data-compare-action="collapse">Collapse all</button>':''}</div><p class="compare-current-note">Published allocations only. Model names identify the columns; revisions remain in each model’s History.</p>${picked.length?comparisonTable(picked):'<div class="card"><h2>Select models to begin</h2><p class="muted">Your library can contain any number of models. Compare a focused selection here.</p></div>'}<p class="compare-detail">${comparisonState.lens==='allocation'?'All percentages are of the whole model. “Not specified” means that allocation is absent; 0% is an explicit target.':comparisonState.lens==='credit'?'Credit and duration percentages use each model’s debt allocation. “Not applicable” means it has no debt allocation.':comparisonState.lens==='themes'?'Themes can overlap, so their percentages need not add up to 100%.':'Exposure percentages are of the whole model. Unclassified investments remain visible.'}</p>${comparisonState.lens!=='allocation'?'<p class="note">Exposure targets are derived from allocations using the original mockup’s illustrative classifications. Look-through splits a fund across its supplied underlying exposures; Single tag puts its whole allocation in one bucket per dimension. The same method applies to every selected model. Dimensions are compared separately.</p>':''}</section></div></section>`;
  if (comparisonState.lens!=='allocation' && !comparisonState.exposureData && !comparisonState.loading && !comparisonState.error) loadComparisonExposures();
}
function comparisonTable(picked) {
  let rows;
  if (comparisonState.lens==='allocation') {
    rows = ComparisonData.aligned(picked.map(m => latest(m).data)).filter(row => row.names.slice(0,-1).every((_,i) => comparisonState.expanded.has(JSON.stringify(row.names.slice(0,i+1)))));
  } else {
    if (comparisonState.error) return '<div class="card"><p>Exposure data could not load. Asset allocation comparison is still available.</p><button data-compare-action="retry">Retry exposure data</button></div>';
    if (!comparisonState.exposureData) return '<p class="card" role="status">Loading illustrative exposure data…</p>';
    const values = picked.map(m => ComparisonData.exposures(latest(m).data, comparisonState.exposureData.securities, comparisonState.lens, comparisonState.mode));
    rows = [...new Set(values.flatMap(v => [...v.buckets.keys()]))].sort().map(name => ({key: name, names:[name], children:false, values:values.map(v=>v.applicable?(v.buckets.get(name)||0):null)}));
  }
  return `<div class="card tablewrap" style="padding:0"><table class="compare-table" style="min-width:${230+165*picked.length}px"><caption class="sr-only">${comparisonLenses.find(x=>x[0]===comparisonState.lens)[1]} comparison of published models</caption><thead><tr><th scope="col">${comparisonState.lens==='allocation'?'Allocation':'Exposure'}</th>${picked.map((m,i)=>`<th scope="col"><div class="compare-colour" style="background:${colours[i%colours.length]}"></div>${esc(latest(m).data.name)}<small>${esc(latest(m).data.description)}</small><button class="quiet compare-remove" data-compare-open="${esc(m.id)}">Open model</button> · <button class="quiet compare-remove" data-compare-remove="${esc(m.id)}" aria-label="Remove ${esc(latest(m).data.name)} from comparison">Remove</button></th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr class="${row.names.length===1?'rowtop':''}"><th scope="row"><div class="allocation-name" style="padding-left:${(row.names.length-1)*14}px">${row.children?`<button class="chev" data-compare-toggle="${esc(row.key)}" aria-label="${comparisonState.expanded.has(row.key)?'Collapse':'Expand'} ${esc(row.names.join(' / '))}" aria-expanded="${comparisonState.expanded.has(row.key)}">${comparisonState.expanded.has(row.key)?'⌄':'›'}</button>`:''}<span>${esc(row.names.at(-1))}</span></div></th>${row.values.map((value,i)=>`<td>${value===null?`<span class="compare-missing">${comparisonState.lens==='credit'?'Not applicable':'Not specified'}</span>`:`<strong>${fmt(value)}%</strong><div class="compare-bar" aria-hidden="true"><span style="width:${Math.max(0,Math.min(100,value))}%;background:${colours[i%colours.length]}"></span></div>`}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${picked.length+1}">No allocations for this view.</td></tr>`}</tbody></table></div>`;
}
document.addEventListener('click',e=>{
  const button=e.target.closest('button'); if (!button) return;
  const action=button.dataset.compareAction;
  if (action==='library') {comparisonState.active=false;modelNav();return;}
  if (action==='compare') {openComparison();return;}
  if (button.dataset.compareOpen) {comparisonState.active=false;openModel(button.dataset.compareOpen);return;}
  if (button.dataset.compareRemove) comparisonState.selected.delete(button.dataset.compareRemove);
  else if (button.dataset.compareToggle) {const key=button.dataset.compareToggle;comparisonState.expanded.has(key)?comparisonState.expanded.delete(key):comparisonState.expanded.add(key);}
  else if (action==='clear') comparisonState.selected.clear();
  else if (action==='expand') comparisonState.expanded=new Set(ComparisonData.aligned(comparedModels().map(m=>latest(m).data)).filter(r=>r.children).map(r=>r.key));
  else if (action==='collapse') comparisonState.expanded.clear();
  else if (action==='retry') {comparisonState.error=false;loadComparisonExposures();}
  else return;
  renderComparison();
});
document.addEventListener('change',e=>{
  const input=e.target;
  if (input.dataset.compareModel) {if(input.checked&&comparisonState.selected.size<4)comparisonState.selected.add(input.dataset.compareModel);else comparisonState.selected.delete(input.dataset.compareModel);}
  else if (input.id==='comparisonLens') comparisonState.lens=input.value;
  else if (input.id==='comparisonMode') comparisonState.mode=input.value;
  else return;
  renderComparison();
});
document.addEventListener('input',e=>{
  if (e.target.id!=='comparisonSearch') return;
  const position=e.target.selectionStart;comparisonState.search=e.target.value;renderComparison();
  const input=$('comparisonSearch');input.focus();input.setSelectionRange(position,position);
});
