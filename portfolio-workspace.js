'use strict';
// Presentation state is independent of the approved target and source holdings.
let portfolioArea='allocation',scopeDialogOpen=false;
const sourceDate=()=>originalData.metadata.asOf;
const recordedValue=p=>p.assets.reduce((sum,a)=>sum+a.value,0);
const crore=value=>'₹'+(value/100).toFixed(2)+' Cr';
const pp=value=>signed(value)+' pp';
const reviewLabel=r=>r.drift===null?'Data incomplete':r.flagged?'Needs review':'Within threshold';
// Why a portfolio needs review: asset-class drift, exposure limits, or both.
const reviewReason=r=>{if(r.drift===null)return 'Comparison unavailable';if(!r.flagged)return 'Asset class and exposures within limits';const cls=r.drift>r.threshold,exp=r.exposureFlags.length>0;return cls&&exp?'Asset class + exposure':cls?'Asset class only':'Exposure only'};
const scrollWorkspace=()=>window.scrollTo(0,0);

// Keep the familiar model editor focused; exposure controls appear only on demand.
lensControls=function(context){return `<div class="analysis-toolbar"><label>View <select id="modelLens">${lenses.map(([key,label])=>`<option value="${key}" ${activeLens===key?'selected':''}>${key==='ac'?'Asset allocation':label}</option>`).join('')}</select></label>${['sec','mc','geo','tree'].includes(activeLens)?`<label>Funds and ETFs <select id="modelFundMode"><option value="look" ${fundMode==='look'?'selected':''}>Look-through</option><option value="tag" ${fundMode==='tag'?'selected':''}>Single tag</option></select></label><p class="chart-key">Look-through splits a fund across its supplied underlying exposures. Single tag assigns the whole fund to one bucket per dimension. These are display settings, not target edits.</p>`:''}</div>`};

renderClients=function(){
  const all=dashboardRecords(),shown=visibleRecords(),flagged=all.filter(r=>r.flagged);
  const total=all.reduce((sum,r)=>sum+r.total,0),flaggedTotal=flagged.reduce((sum,r)=>sum+r.total,0);
  $('footer').innerHTML='';
  $('app').innerHTML=`<div class="flex between"><div><div class="eyebrow">Adviser workspace</div><h1>Portfolios</h1><p class="muted">An overview of allocations that may need your attention.</p></div><span class="source-stamp">Illustrative data · ${sourceDate()}</span></div>
    ${!clientStorageOK?'<p class="note warning">Browser saving is unavailable. Changes last for this session only.</p>':''}
    <div class="portfolio-metrics">
      <section class="card"><small>AUM under advice</small><strong>${crore(total)}</strong><small>${money(total)} · all ${clientView}</small></section>
      <section class="card"><small>Coverage</small><strong>${originalData.households.length} <span>households</span></strong><small>${clientRecords.length} accounts · no double counting</small></section>
      <section class="card"><small>Needs allocation review</small><strong>${flagged.length}<span> / ${all.length} ${clientView}</span></strong><small>Asset-class or exposure deviations</small></section>
      <section class="card"><small>AUM needing review</small><strong>${crore(flaggedTotal)}</strong><small>${total?fmt(flaggedTotal/total*100):0}% of AUM under advice</small></section>
    </div>
    <section class="card overview-card"><div class="overview-controls"><div class="segmented" role="group" aria-label="Portfolio grouping"><button data-action="households" aria-pressed="${clientView==='households'}">Households</button><button data-action="accounts" aria-pressed="${clientView==='accounts'}">Accounts</button></div><label class="search-field">Search portfolios<input id="clientSearch" type="search" placeholder="Name, household or account" value="${esc(clientSearch)}"></label><label class="search-field">Model<select id="modelFilter"><option value="">All models</option>${Object.keys(originalData.modelTargets).map(p=>`<option ${modelFilter===p?'selected':''}>${esc(p)}</option>`).join('')}</select></label><label class="check-filter"><input id="flaggedOnly" type="checkbox" ${flaggedOnly?'checked':''}> Needs review only</label></div>
    <div class="flex between list-caption"><small role="status">Showing ${shown.length} of ${all.length} ${clientView} · summary cards show all ${clientView}</small>${clientSearch||modelFilter||flaggedOnly?'<button class="quiet" data-workspace="clear-filters">Clear filters</button>':''}</div>
    <div class="tablewrap"><table class="portfolio-list"><caption class="sr-only">${clientView==='households'?'Household':'Account'} portfolios</caption><thead><tr><th aria-sort="${sortField==='name'?(sortDirection===1?'ascending':'descending'):'none'}"><button class="link" data-sort="name">Portfolio ↕</button></th><th>Model / risk profile</th><th aria-sort="${sortField==='total'?(sortDirection===1?'ascending':'descending'):'none'}"><button class="link" data-sort="total">Under advice (₹ L) ↕</button></th><th aria-sort="${sortField==='drift'?(sortDirection===1?'ascending':'descending'):'none'}"><button class="link" data-sort="drift">Max drift ↕</button></th><th>Attention</th></tr></thead><tbody>${shown.map(dashboardRow).join('')||'<tr><td colspan="5"><div class="empty-state"><h2>No portfolios match</h2><p>Try another name or clear your filters.</p><button data-workspace="clear-filters">Clear filters</button></div></td></tr>'}</tbody></table></div></section>
    <details class="methodology"><summary>How to read these figures</summary><p>Max drift is the largest absolute asset-class difference from the approved client target. Household targets are account targets weighted by their value under advice; a joint account is counted once, not once per owner.</p><p>Review flags use the original illustrative thresholds and Look-through exposure method. They are prompts to investigate, not trade instructions. Exposure dimensions are assessed separately, so flags can overlap. The underlying thresholds and flagged buckets appear in each row’s breakdown.</p><p>All original accounts and holdings are retained. Ownership labels describe account types, not a complete beneficial-owner mapping.</p></details>`;
};
dashboardRow=function(r){
  const isHousehold=r.kind==='Household',open=dashboardExpanded.has(r.id);
  const row=`<tr><td><div class="portfolio-name"><button class="chev" data-dashboard-expand="${r.id}" aria-label="${open?'Hide':'Show'} breakdown for ${esc(r.name)}" aria-expanded="${open}">${open?'⌄':'›'}</button><div><button class="link" ${isHousehold?`data-household="${r.id}"`:`data-client="${r.id}"`}>${esc(r.name)}</button><small>${isHousehold?r.members.length+' accounts':esc(r.kind)+' · '+esc(r.household)}</small></div></div></td><td>${esc(r.model)}<small>Risk profile: ${esc(r.risk)}</small></td><td class="numeric">${fmt(r.total)}</td><td>${r.drift===null?'Unavailable':fmt(r.drift)+' pp'}</td><td><span class="badge ${r.flagged?'draft':''}">${reviewLabel(r)}</span><small>${r.exposureFlags.length?r.exposureFlags.length+' exposure flags':'No exposure flags'}</small></td></tr>`;
  if(!open)return row;
  return row+`<tr class="breakdown-row"><td colspan="5"><div class="dashboard-breakdown"><section><h3>Asset-class allocation</h3>${r.classes.map(c=>`<p><strong>${esc(c.name)}</strong><span>Actual ${c.actual===null?'—':fmt(c.actual)+'%'} · target ${fmt(c.target)}%</span></p>`).join('')}<small>Review threshold: ${fmt(r.threshold)} pp</small></section><section><h3>${isHousehold?'Accounts in this household':'Account context'}</h3>${r.members.map(c=>`<p><button class="link" data-client="${c.id}">${esc(c.name)}</button><small>${esc(c.type)} · ${money(scopeValue(approved(c).plan))}</small></p>`).join('')}</section><section><h3>Exposure review · Look-through</h3>${r.exposureFlags.length?`<div class="exposure-flags">${r.exposureFlags.map(x=>`<p><strong>${esc(lenses.find(l=>l[0]===x.lens)[1])}</strong><span>${esc(x.name)} · ${pp(x.drift)}</span></p>`).join('')}</div>`:'<p>No exposure buckets exceed the sample defaults.</p>'}</section></div></td></tr>`;
};

// Dashboard flags must not change because an adviser browsed a different lens mode.
const metricCalculation=portfolioMetrics;
portfolioMetrics=function(actual,target,threshold,lensLimits){const prior=fundMode;try{fundMode='look';return metricCalculation(actual,target,threshold,lensLimits)}finally{fundMode=prior}};

distribution=function(actual,target,label='Client target'){
  const total=actual.reduce((sum,x)=>sum+x.value,0);
  const classes=originalData.assetHierarchy.map((c,i)=>({name:c.n,colour:palette[i],actual:total?actual.filter(x=>x.category===c.n).reduce((sum,x)=>sum+x.value,0)/total*100:null,target:target.filter(x=>x.category===c.n).reduce((sum,x)=>sum+x.value,0)}));
  return `<section class="card distribution-card"><div class="flex between"><div><h2>Asset distribution</h2><p class="muted">Actual vs ${esc(label.toLowerCase())}</p></div><small>Same assets · same denominator</small></div><div class="distribution-bars"><div><strong>Actual</strong>${total?stack(classes.map(c=>c.actual)):'<span class="muted">No included value</span>'}<small>${money(total)}</small></div><div><strong>${esc(label)}</strong>${stack(classes.map(c=>c.target))}<small>100% allocation</small></div></div><div class="distribution-legend">${classes.map(c=>`<div><strong><i class="dot" style="background:${c.colour}"></i>${esc(c.name)}</strong><p>${c.actual===null?'—':fmt(c.actual)+'%'} <span>/ ${fmt(c.target)}%</span></p><small>${c.actual===null?'Actual unavailable':pp(c.actual-c.target)+' drift'}</small></div>`).join('')}</div><p class="chart-key">Legend values: Actual / ${esc(label)}. Drift = actual minus target, in percentage points.</p></section>`;
};

householdPage=function(id){
  leaveModels();clientEditing=false;activeClient=null;comparisonState.active=false;navState('portfolios');scrollWorkspace();
  const h=originalData.households.find(h=>h.id===id),members=clientRecords.filter(c=>c.householdId===id);
  const actual=members.flatMap(c=>actualValues(approved(c).plan)),total=actual.reduce((sum,x)=>sum+x.value,0);
  const target=members.flatMap(c=>leafValues(effective(approved(c).plan)).map(x=>({...x,value:total?x.value*scopeValue(approved(c).plan)/total:0})));
  $('footer').innerHTML='';$('app').innerHTML=`<button class="quiet" data-action="back">← All portfolios</button><div class="eyebrow">Household overview</div><h1>${esc(h.name)}</h1><p class="muted">${members.length} accounts · ${money(total)} under advice · sample as of ${sourceDate()}</p><p class="note">This is a combined view, not a separate household target. Each account retains its own approved plan. Household risk label: ${esc(h.riskProfile)}.</p>${distribution(actual,target,'Combined client targets')}<section class="card"><h2>Accounts in this household</h2><div class="tablewrap"><table><thead><tr><th>Account</th><th>Ownership type</th><th>Under advice (₹ L)</th><th>Model</th><th></th></tr></thead><tbody>${members.map(c=>`<tr><td><button class="link" data-client="${c.id}">${esc(c.name)}</button></td><td>${esc(c.type)}</td><td>${fmt(scopeValue(approved(c).plan))}</td><td>${esc(baseRef(approved(c).plan))}</td><td><button data-client="${c.id}">Open portfolio →</button></td></tr>`).join('')}</tbody></table></div></section>`;
};
const baseClientNav=clientNav;
clientNav=function(){comparisonState.active=false;scopeDialogOpen=false;baseClientNav();scrollWorkspace()};
openClient=function(id){leaveModels();comparisonState.active=false;activeClient=id;clientEditing=false;portfolioArea='allocation';activeLens='ac';clientExpanded=new Set();navState('portfolios');renderClient();scrollWorkspace()};
const baseModelNav=modelNav,baseOpenModel=openModel;
modelNav=function(){baseModelNav();scrollWorkspace()};
openModel=function(id){activeLens='ac';baseOpenModel(id);scrollWorkspace()};
editClient=function(){portfolioArea='target';allocationDraft=false;const c=client();c.draft=c.draft||copy(approved(c).plan);clientEditing=true;saveClients();renderClient()};

function portfolioTabs(){return `<nav class="portfolio-tabs" aria-label="Portfolio work areas">${[['allocation','Allocation'],['target','Target plan'],['planning','Planning'],['history','History']].map(([key,label])=>`<button data-portfolio-area="${key}" aria-current="${portfolioArea===key?'page':'false'}">${label}${key==='target'&&client().draft?' <span class="draft-dot" aria-label="Draft exists"></span>':''}</button>`).join('')}</nav>`}
function scopeSummary(p){return `<div class="scope-summary"><div><small>Recorded assets</small><strong>${money(recordedValue(p))}</strong></div><div><small>Under advice${clientEditing?' · draft':''}</small><strong>${money(scopeValue(p))}</strong></div><p>${p.assets.filter(a=>a.included).length} of ${p.assets.length} assets included</p><button data-workspace="scope">${clientEditing?'Manage included assets':'View included assets'}</button></div>`}
function allocationControls(){return `<div class="analysis-toolbar"><div class="segmented" role="group" aria-label="Allocation view"><button data-lens="ac" data-context="portfolio" aria-pressed="${activeLens==='ac'}">Asset allocation</button><button data-workspace="exposures" aria-pressed="${activeLens!=='ac'}">Exposure analysis</button></div>${activeLens!=='ac'?`<label>Lens <select id="portfolioLens">${lenses.filter(([key])=>!['ac'].includes(key)).map(([key,label])=>`<option value="${key}" ${key===activeLens?'selected':''}>${label}</option>`).join('')}</select></label>${['sec','mc','geo','tree'].includes(activeLens)?`<label>Funds and ETFs <select id="portfolioFundMode"><option value="look" ${fundMode==='look'?'selected':''}>Look-through</option><option value="tag" ${fundMode==='tag'?'selected':''}>Single tag</option></select></label>`:''}`:allocationTreeTools()}</div>`}

// The tree a portfolio is displayed against is the whole classification, to
// whatever depth each branch runs. It used to be three levels everywhere; it no
// longer is, so this mirrors the hierarchy rather than assuming a shape.
function actualAllocationTree(p){
  const mirror=node=>({name:node.n,key:node.key,target:0,children:(node.c||[]).map(mirror)});
  return originalData.assetHierarchy.map(mirror);
}
function alignedPortfolioRows(p){
  const model=p.base.data,target=effective(p),tree=actualAllocationTree(p),values=new Map();
  const held=new Map();
  for(const asset of p.assets)if(asset.included)held.set(asset.name,(held.get(asset.name)||0)+asset.value);
  // The tree runs to a different depth in each branch, so totals are rolled up
  // rather than read off a fixed three levels.
  const roll=(node,path)=>{
    const here=[...path,node.name];
    const value=node.children.length
      ?node.children.reduce((sum,child)=>sum+roll(child,here),0)
      :(held.get(node.name)||0);
    values.set(JSON.stringify(here),value);
    return value;
  };
  for(const assetClass of tree)roll(assetClass,[]);
  return ComparisonData.aligned([model,target,{allocations:tree}]).map(row=>({...row,actual:values.get(row.key)||0}));
}
// The band a row is judged against comes off the classification tree, so the
// drift table and the review flags cannot disagree: the asset-class row uses the
// portfolio threshold, and every level below it uses the band on that node — the
// model's default unless this portfolio has overridden it.
function portfolioThreshold(id){
 if(typeof reviewRules==='undefined')return originalData.settings.firmThresholdPP;
 return reviewRules.overrides[id]??reviewRules.firm;
}
function allocationBand(depth,id,band){
 if(depth===0)return portfolioThreshold(id);
 if(band!==undefined&&band!==null)return band;
 return originalData.settings.defaultBandsByLevel[depth]??2;
}
function allocationState(drift,depth,id,band){
 if(drift===null)return {label:'—',tone:'none'};
 const limit=allocationBand(depth,id,band);
 if(Math.abs(drift)<=limit)return {label:'Within '+fmt(limit)+' pp',tone:'ok'};
 return {label:(drift>0?'Above':'Below')+' by '+fmt(Math.abs(drift))+' pp',tone:drift>0?'over':'under'};
}

// --- Inline target and band editing ----------------------------------------
// The revised mockup retunes a portfolio straight on the drift table, which is
// where the adviser is already looking. We do the same, with one difference the
// firm asked for: an edit lands in the target draft, and the approved client
// target only moves after the review step on Client target. Editing a node
// moves its siblings so the level above does not change, exactly as in Models,
// so the portfolio stays at 100% without arithmetic by hand.
let allocationDraft=false;
const allocationPlan=()=>allocationDraft&&client()&&client().draft?client().draft:approved(client()).plan;
const overrideKey=names=>names.join(' / ');
function allocationOverrideKeys(p){
 const model=new Map(entries(p.base.data.allocations).map(x=>[x.key,x.node.target])),out=new Set();
 const walk=(nodes,path)=>{for(const node of nodes){
  const key=path?path+' / '+node.name:node.name,base=model.get(key);
  if(base!==undefined&&Math.abs(node.target-base)>0.005){out.add(key);continue}
  walk(node.children||[],key);
 }};
 walk(effective(p).allocations,'');
 return out;
}
const allocationBandKeys=p=>new Set(Object.keys(p.overrides).filter(k=>p.overrides[k].band!==undefined));
const allocationOverrideCount=p=>{const keys=allocationOverrideKeys(p);for(const k of allocationBandKeys(p))keys.add(k);return keys.size};
function treeNodeAt(nodes,names){
 let list=nodes,node=null;
 for(const name of names){node=(list||[]).find(n=>n.name===name);if(!node)return null;list=node.children}
 return node;
}
// Overrides are written against the keys the target plan already uses, so a
// change made here is the same change Client target reviews and approves.
function syncTargetOverrides(p,tree){
 const model=new Map(entries(p.base.data.allocations).map(x=>[x.key,x.node.target]));
 for(const x of entries(tree)){
  const base=model.get(x.key),o=p.overrides[x.key];
  if(base!==undefined&&Math.abs(x.node.target-base)<0.005){
   if(o&&o.target!==undefined){delete o.target;if(!Object.keys(o).length)delete p.overrides[x.key]}
  }else (p.overrides[x.key]||(p.overrides[x.key]={})).target=Math.round(x.node.target*10000)/10000;
 }
}
function editAllocationTarget(p,names,value){
 const tree=effective(p).allocations,node=treeNodeAt(tree,names);
 if(!node||!TAX.editModelTree(tree,node.key,value))return false;
 syncTargetOverrides(p,tree);
 return true;
}
// Clearing a box follows the model again. The siblings moved together when the
// edit was made, so they come back together: the whole group under the parent
// returns to the model, and the level above is untouched either way.
function resetAllocationBranch(p,names){
 const parent=names.slice(0,-1),prefix=parent.length?overrideKey(parent)+' / ':'';
 let changed=false;
 for(const key of Object.keys(p.overrides)){
  if(prefix&&!key.startsWith(prefix))continue;
  const o=p.overrides[key];
  if(o.target===undefined)continue;
  delete o.target;changed=true;
  if(!Object.keys(o).length)delete p.overrides[key];
 }
 return changed;
}
function setAllocationBand(p,names,value){
 const key=overrideKey(names),o=p.overrides[key]||(p.overrides[key]={});
 if(value===null)delete o.band;else o.band=value;
 if(!Object.keys(o).length)delete p.overrides[key];
}
const allocationNodes=p=>new Map(entries(effective(p).allocations).map(x=>[x.key,x.node]));
// Expanding to the breaches saves the adviser opening five levels to find the
// one sub-sector that is actually out of band.
function breachKeys(p){
 const total=scopeValue(p),nodes=allocationNodes(p),out=new Set();
 if(!total)return out;
 for(const row of alignedPortfolioRows(p)){
  const target=row.values[1];if(target===null)continue;
  const depth=row.names.length-1,node=nodes.get(overrideKey(row.names));
  const drift=row.actual/total*100-target;
  if(Math.abs(drift)<=allocationBand(depth,activeClient,node&&node.band))continue;
  for(let i=1;i<row.names.length;i++)out.add(JSON.stringify(row.names.slice(0,i)));
 }
 return out;
}
function startAllocationDraft(){
 const c=client();c.draft=c.draft||copy(approved(c).plan);
 allocationDraft=true;saveClients();renderClient();
}
function allocationTreeTools(){
 const reachable=breachKeys(allocationPlan()).size;
 return `<div class="flex allocation-tools"><button data-workspace="expand-all">Expand all</button><button data-workspace="expand-breaches" ${reachable?'':'disabled'} title="${reachable?'Open only the branches holding a row outside its band':'Nothing below an asset class is outside its band'}">Expand to breaches</button><button data-workspace="collapse-all">Collapse all</button>${allocationEditControls()}</div>`;
}
function allocationEditControls(){
 if(!allocationDraft)return `<button class="primary" data-workspace="adjust">${client().draft?'Resume target draft':'Adjust targets'}</button>`;
 const count=allocationOverrideCount(allocationPlan());
 return `<span class="lens-override-count">${count?count+' override'+(count===1?'':'s')+' in this draft':'No overrides yet'}</span><button data-workspace="reset-model" ${count?'':'disabled'} title="Remove every portfolio override and follow the model">Reset to model</button><button data-workspace="approved-target">Compare with approved</button>`;
}
function holdingTags(asset){
 if(!asset)return '';
 const s=originalData.securities.find(x=>x.name===asset.name),tags=[];
 if(s?.physical)tags.push(['physical','Physical']);
 if(s?.liquidity&&s.liquidity!=='Liquid')tags.push([s.liquidity==='Locked'?'locked':'semi','Locked'===s.liquidity?'Locked':'Semi-liquid']);
 return tags.map(([cls,label])=>`<span class="holding-tag ${cls}">${label}</span>`).join('');
}
function allocationTable(p){
  const total=scopeValue(p),nodes=allocationNodes(p),editing=allocationDraft,changed=allocationOverrideKeys(p);
  const rows=alignedPortfolioRows(p).filter(row=>row.names.slice(0,-1).every((_,i)=>clientExpanded.has(JSON.stringify(row.names.slice(0,i+1)))));
  const notice=editing
    ?`<p class="note warning"><strong>Target draft.</strong> Change a target or a band and the siblings under the same parent move, so the level above does not change. Clear a box to follow the model again. The approved client target, the holdings and the review summary above are unchanged until this draft is approved on <button class="link" data-workspace="review-draft">Client target</button>. To change the model itself, go to Models.</p>`
    :'';
  const body=rows.map(row=>{
    const percent=total?row.actual/total*100:null,target=row.values[1];
    const asset=!row.children?p.assets.find(a=>a.name===row.names.at(-1)):null,depth=row.names.length-1;
    const node=nodes.get(overrideKey(row.names)),own=p.overrides[overrideKey(row.names)]||{};
    const band=allocationBand(depth,activeClient,node&&node.band);
    const drift=target===null||percent===null?null:percent-target;
    const state=allocationState(drift,depth,activeClient,node&&node.band);
    const targetOverridden=changed.has(overrideKey(row.names));
    const bandOverridden=own.band!==undefined;
    const box=(kind,value,max,step)=>`<div class="target-input-wrap"><input class="target" type="number" min="0" max="${max}" step="${step}" aria-label="${esc(row.names.join(' / '))} ${kind==='target'?'draft target %':'band in percentage points'}" data-allocation-${kind}="${esc(row.key)}" value="${Math.round(value*100)/100}"></div>`;
    const targetCell=target===null?'<td class="numeric">Not specified</td>'
      :editing?`<td class="numeric${targetOverridden?' is-override':''}">${box('target',target,100,'0.1')}</td>`
      :`<td class="numeric${targetOverridden?' is-override':''}">${fmt(target)}</td>`;
    const bandCell=target===null?'<td class="numeric">—</td>'
      :depth===0?`<td class="numeric">± ${fmt(band)}<small>Portfolio threshold</small></td>`
      :editing?`<td class="numeric${bandOverridden?' is-override':''}">${box('band',band,50,'0.5')}</td>`
      :`<td class="numeric${bandOverridden?' is-override':''}">± ${fmt(band)}</td>`;
    const resetCell=!editing?''
      :`<td class="numeric">${targetOverridden||bandOverridden?`<button class="chev" data-allocation-reset="${esc(row.key)}" title="Follow the model again for this group" aria-label="Reset ${esc(row.names.join(' / '))} to the model">↺</button>`:''}</td>`;
    return `<tr class="${row.names.length===1?'rowtop':''}${targetOverridden||bandOverridden?' is-custom':''}"><th scope="row"><div class="allocation-name" style="padding-left:${depth*15}px">${row.children?`<button class="chev" data-allocation-toggle="${esc(row.key)}" aria-label="${clientExpanded.has(row.key)?'Collapse':'Expand'} ${esc(row.names.join(' / '))}" aria-expanded="${clientExpanded.has(row.key)}">${clientExpanded.has(row.key)?'⌄':'›'}</button>`:''}<span>${asset?`<button class="link" data-holding="${esc(asset.id)}">${esc(row.names.at(-1))}</button>${holdingTags(asset)}${!asset.included?'<small>Outside advice scope</small>':''}`:esc(row.names.at(-1))}</span></div></th><td class="numeric">${fmt(row.actual)}</td><td class="numeric">${percent===null?'—':fmt(percent)}</td>${targetCell}${bandCell}<td class="numeric">${drift===null?'—':signed(drift)}</td><td class="numeric">${target===null||percent===null?'—':signed(total*target/100-row.actual)}</td><td><span class="state-pill ${state.tone}">${state.label}</span></td>${resetCell}</tr>`;
  }).join('');
  return `${notice}<div class="tablewrap"><table class="allocation-review${editing?' is-editing':''}"><caption class="sr-only">Actual holdings compared with ${editing?'the target draft':'the approved client target'}</caption><thead><tr><th>Allocation / holding</th><th class="numeric-head">Actual (₹ L)</th><th class="numeric-head">Actual %</th><th class="numeric-head">${editing?'Draft target %':'Client target %'}</th><th class="numeric-head">Band ±</th><th class="numeric-head">Drift (pp)</th><th class="numeric-head">Value gap (₹ L)</th><th>Review state</th>${editing?'<th><span class="sr-only">Reset to model</span></th>':''}</tr></thead><tbody>${body}</tbody></table></div><p class="chart-key">All percentages use the ${money(total)} under advice. Positive drift means above target. Positive value gap means below target in rupees—not a suggested buy. “Not specified” is different from an explicit 0% target. Review state uses the portfolio threshold for asset classes, then the band set on each node of the classification tree — the model’s default unless this portfolio overrides it. <strong>Locked</strong> and <strong>Semi-liquid</strong> assets cannot be traded freely, whatever their drift.</p>`;
}
function targetPlanContent(p){
  const issues=targetIssues(p);
  return `<div class="flex between toolbar"><div><h2>${clientEditing?'Target draft':'Approved client target'}</h2><p class="muted">Model allocation and client adjustments, separate from actual holdings.</p></div>${clientEditing?'<button data-action="approved">View approved target</button>':`<button class="primary" data-action="edit">${client().draft?'Resume target draft':'Edit target plan'}</button>`}</div>${clientEditing?'<p class="note warning">Draft preview only. Allocation continues to compare actual holdings with the approved target until you approve this plan.</p>':''}${scopeSummary(p)}${clientEditing?`<section class="card"><h2>Assigned model</h2><div class="client-controls"><label class="field">Model<select id="baseChoice">${modelOptions(p)}</select></label><button data-action="base">Review model selection</button></div><p class="muted">Selecting a model here does not change the account’s assessed risk label. Review and approve before it affects the target.</p></section>`:''}<section class="card"><h2>Model and client allocation</h2><p class="muted">Blank adjustments inherit the model; zero is explicit. Parent and child percentages must reconcile.</p><div class="flex toolbar"><button data-action="expand">Expand all</button><button data-action="collapse">Collapse all</button></div><div class="tablewrap"><table class="client-table"><thead><tr><th>Allocation</th><th>Model %</th>${clientEditing?'<th>Client adjustment %</th>':''}<th>Client target %</th><th>Source</th></tr></thead><tbody>${targetRows(p)}</tbody></table></div></section>${clientEditing?`<section class="card ${issues.length?'warning':''}"><h2>${issues.length?'Complete before approval':'Allocation checks passed'}</h2>${issues.length?'<ul>'+issues.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul>':'<p>Targets total 100%; child allocations reconcile with their parents.</p>'}</section>`:''}`;
}
targetRows=function(p){
  const base=entries(p.base.data.allocations),effectiveNodes=new Map(entries(effective(p).allocations).map(x=>[x.key,x.node]));
  return base.map((x,i)=>{let parent=base.find(y=>y.node.children.includes(x.node)),depth=0;while(parent){depth++;if(!clientExpanded.has(parent.key))return '';parent=base.find(y=>y.node.children.includes(parent.node))}const n=effectiveNodes.get(x.key),o=p.overrides[x.key]||{};return `<tr class="${depth?'child':'rowtop'}"><td style="padding-left:${12+depth*18}px">${n.children.length?`<button class="chev" data-toggle="${i}" aria-label="${clientExpanded.has(x.key)?'Collapse':'Expand'} ${esc(x.key)}" aria-expanded="${clientExpanded.has(x.key)}">${clientExpanded.has(x.key)?'⌄':'›'}</button>`:''}${esc(n.name)}</td><td>${fmt(x.node.target)}</td>${clientEditing?`<td><input class="target" type="number" min="0" max="100" step="0.1" aria-label="${esc(x.key)} client target" data-adjust="${i}" placeholder="Inherit" value="${o.target??''}"></td>`:''}<td>${fmt(n.target)}</td><td>${o.target!==undefined?'Client adjustment':'Model'}</td></tr>`}).join('');
};

renderClient=function(){
  if(portfolioArea!=='target')clientEditing=false;
  if(portfolioArea!=='allocation')allocationDraft=false;
  const c=client(),p=portfolioArea==='target'?planNow():portfolioArea==='allocation'?allocationPlan():approved(c).plan;
  $('footer').innerHTML='';
  $('app').innerHTML=`<button class="quiet" data-action="back">← All portfolios</button><div class="portfolio-heading"><div><div class="eyebrow">${esc(c.household)} / ${esc(c.type)}</div><h1>${esc(c.name)}</h1><p class="muted">Model: ${esc(baseRef(approved(c).plan))} · Risk profile: ${esc(c.risk)}</p></div><span class="source-stamp">Illustrative data · ${sourceDate()}</span></div>${newer(c)?'<p class="note warning">Model changes available. Review them in Target plan; the approved target has not changed.</p>':''}${c.draft&&portfolioArea!=='target'&&!allocationDraft?'<p class="note">A target draft is saved. This view still uses the approved client target. <button class="link" data-portfolio-area="target">View target plan →</button></p>':''}${portfolioTabs()}
  ${portfolioArea==='allocation'?`${scopeSummary(p)}${distribution(actualValues(p),leafValues(effective(p)))}<section class="card allocation-section"><h2>Allocation review</h2>${allocationControls()}${activeLens==='ac'?allocationTable(p):`${['sec','geo','mc','tree'].includes(activeLens)?'<p class="note">Look-through splits a fund across its supplied underlying exposures. Single tag assigns its whole value to one bucket per dimension. For example, 30% of a ₹10 lakh fund contributes ₹3 lakh to that exposure. This view does not change holdings or targets.</p>':''}${lensContent(actualValues(p),leafValues(effective(p)))}`}</section><details class="methodology"><summary>Source and comparison assumptions</summary><p>These are the original mockup’s illustrative holdings, dated ${sourceDate()}, not verified balances. Every original asset starts included; property, gold and EPF are not excluded automatically. Any scope changes require target approval.</p><p>Exposure targets are derived from the approved allocation using the original classifications. Separate dimensions cannot be combined into an inferred joint exposure.</p></details>`:portfolioArea==='target'?targetPlanContent(p):portfolioArea==='history'?`<section class="card"><h2>Target history</h2><p class="muted">Approved snapshots, model references and reasons. Initial approval is an illustrative workflow record, not a real adviser decision.</p>${historyMarkup(c)}</section>`:`<section class="card planning-placeholder"><div class="eyebrow">Next workflow · not yet implemented</div><h2>Planning</h2><p>Turn allocation gaps into reviewable scenarios without changing recorded holdings.</p><ul><li>Suggested buys / sells, liquidity restrictions and residual cash.</li><li>Illustrative tax estimates, exemptions and loss harvesting.</li><li>Cash inflows, withdrawals and lump-sum or staged investments.</li></ul><p class="note">These capabilities remain in scope. No trade, tax calculation or cash-event workflow is active on this screen yet.</p></section>`}`;
  if(clientEditing&&portfolioArea==='target')$('footer').innerHTML=`<div class="footer"><div><strong>${clientStorageOK?'Draft saved in this browser':'Session only · saving unavailable'}</strong><small>Approved target and holdings remain unchanged</small></div><button class="primary" data-action="review" ${targetIssues(p).length?'disabled':''}>Review & approve →</button></div>`;
  if(allocationDraft&&portfolioArea==='allocation')$('footer').innerHTML=`<div class="footer"><div><strong>${clientStorageOK?'Draft saved in this browser':'Session only · saving unavailable'}</strong><small>Approved target and holdings remain unchanged</small></div><button class="primary" data-workspace="review-draft">Review & approve →</button></div>`;
  if(scopeDialogOpen)renderScopeDialog();
};
function renderScopeDialog(){const p=portfolioArea==='target'?planNow():approved(client()).plan;$('modal').innerHTML=`<h2>${clientEditing?'Manage included assets':'Assets under advice'}</h2><p>${money(scopeValue(p))} under advice / ${money(recordedValue(p))} recorded. Inclusion affects comparison percentages, not whether an asset can be sold.</p>${scopePanel(p,true)}${!clientEditing?'<p class="note">To change inclusion, edit Target plan and review the change before approval.</p>':'<p class="note">Changes are saved to the target draft only. Excluded assets require a reason.</p>'}<div class="actions"><button data-workspace="close-scope">Done</button></div>`}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.portfolioArea){portfolioArea=b.dataset.portfolioArea;clientEditing=false;clientExpanded.clear();renderClient();return}
  if(b.dataset.allocationToggle){const key=b.dataset.allocationToggle;clientExpanded.has(key)?clientExpanded.delete(key):clientExpanded.add(key);renderClient();return}
  if(b.dataset.allocationReset){
    const names=JSON.parse(b.dataset.allocationReset),p=allocationPlan();
    resetAllocationBranch(p,names);setAllocationBand(p,names,null);saveClients();renderClient();return;
  }
  const action=b.dataset.workspace;
  if(action==='clear-filters'){clientSearch='';modelFilter='';flaggedOnly=false;renderClients()}
  if(action==='exposures'){activeLens='sec';renderClient()}
  if(action==='expand-all'){clientExpanded=new Set(alignedPortfolioRows(allocationPlan()).filter(r=>r.children).map(r=>r.key));renderClient()}
  if(action==='expand-breaches'){clientExpanded=breachKeys(allocationPlan());renderClient()}
  if(action==='collapse-all'){clientExpanded.clear();renderClient()}
  if(action==='adjust'){startAllocationDraft()}
  if(action==='approved-target'){allocationDraft=false;renderClient()}
  if(action==='reset-model'){const p=allocationPlan();p.overrides={};saveClients();renderClient()}
  if(action==='review-draft'){portfolioArea='target';allocationDraft=false;editClient()}
  if(action==='scope'){scopeDialogOpen=true;renderScopeDialog();$('modal').showModal()}
  if(action==='close-scope'){scopeDialogOpen=false;closeModal()}
});
$('modal').addEventListener('close',()=>{scopeDialogOpen=false});
// A target or band typed into the drift table. Out-of-range input is rejected by
// re-rendering the stored value rather than by storing something unusable.
document.addEventListener('change',e=>{
  const input=e.target;if(!input||!input.dataset)return;
  const targetKey=input.dataset.allocationTarget,bandKey=input.dataset.allocationBand;
  if(targetKey===undefined&&bandKey===undefined)return;
  if(!activeClient||!allocationDraft)return renderClient();
  const names=JSON.parse(targetKey===undefined?bandKey:targetKey),p=allocationPlan(),raw=String(input.value).trim();
  const value=raw===''?null:Number(raw);
  if(raw!==''&&(!Number.isFinite(value)||value<0||value>(targetKey===undefined?50:100)))return renderClient();
  if(targetKey!==undefined){
    if(value===null)resetAllocationBranch(p,names);
    else if(!editAllocationTarget(p,names,value))return renderClient();
  }else setAllocationBand(p,names,value===null?null:Math.round(value*100)/100);
  saveClients();renderClient();
  const field=targetKey===undefined?'band':'target',key=targetKey===undefined?bandKey:targetKey;
  const again=document.querySelector('[data-allocation-'+field+'="'+CSS.escape(key)+'"]');
  if(again)again.focus();
});
document.addEventListener('input',e=>{if(e.target.id!=='clientSearch')return;const pos=e.target.selectionStart;clientSearch=e.target.value;renderClients();$('clientSearch').focus();$('clientSearch').setSelectionRange(pos,pos)});
document.addEventListener('change',e=>{
  if(e.target.id==='modelLens'){activeLens=e.target.value;render()}
  if(e.target.id==='modelFundMode'){fundMode=e.target.value;render()}
  if(e.target.id==='portfolioLens'){activeLens=e.target.value;renderClient()}
  if(e.target.id==='portfolioFundMode'){fundMode=e.target.value;renderClient()}
});
