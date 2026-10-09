'use strict';
const palette=originalData.settings.palette;
const lenses=[['ac','Asset class'],['tree','Hierarchy'],['sec','Sector'],['mc','Market cap'],['geo','Geography'],['th','Theme'],['cr','Credit & duration']];
let activeLens='ac',fundMode=originalData.settings.fundMode;
try{fundMode=localStorage.getItem('portfolio-fund-mode')||fundMode}catch{}
if(!['look','tag'].includes(fundMode))fundMode='look';
function signed(n){const rounded=Math.round(n*10)/10;return (rounded>0?'+':'')+fmt(rounded)}
// What a model target means per security. The tree a model covers no longer ends
// at securities, so the leaves of its allocations are sub-sectors or sectors;
// every caller here wants the per-instrument implication instead.
function leafValues(d){return TAX.impliedHoldingValues(d.allocations)}
// Market cap and geography are recorded only where they describe the instrument
// itself: a fund's are a property of what it holds. In Single tag mode, where the
// whole fund counts in one bucket, fall back to its largest underlying bucket
// rather than reporting it as unclassified.
function dominantBucket(s,key){
 const weights=s.lookThrough?.[key];
 if(!weights?.length)return null;
 return weights.reduce((best,x)=>x.weight>best.weight?x:best).bucket;
}
function exposure(values,lens){
 const buckets=new Map();let total=0,missing=0;
 for(const h of values){
  const s=originalData.securities.find(s=>s.name===h.name);
  if(lens==='cr'&&!(s?.tags.isDebt||(!s&&h.category==='Fixed income')))continue;
  total+=h.value;let parts;
  if(!s){parts=[['Unclassified',1]];missing+=h.value}
  else if(lens==='sec')parts=fundMode==='look'&&s.lookThrough?s.lookThrough.sector.map(x=>[x.bucket,x.weight]):[[s.tags.sector||'Unclassified',1]];
  else if(lens==='mc'||lens==='geo'){const key=lens==='mc'?'marketCap':'geography';parts=fundMode==='look'&&s.lookThrough?s.lookThrough[key].map(x=>[x.bucket,x.weight]):[[s.tags[key]||dominantBucket(s,key)||'Unclassified',1]]}
  else if(lens==='th')parts=(s.tags.themes.length?s.tags.themes:['Unclassified']).map(x=>[x,1]);
  else if(lens==='cr')parts=[[(s.tags.creditQuality||'Unclassified')+' / '+(s.tags.duration||'Unclassified'),1]];
  for(const [key,weight] of parts)buckets.set(key,(buckets.get(key)||0)+h.value*weight);
 }
 return {buckets,total,missing};
}
function exposureRows(actual,target,lens){const a=exposure(actual,lens),t=exposure(target,lens);return [...new Set([...a.buckets.keys(),...t.buckets.keys()])].sort().map(name=>({name,actual:a.total>0?(a.buckets.get(name)||0)/a.total*100:null,target:t.total>0?(t.buckets.get(name)||0)/t.total*100:null,value:a.buckets.get(name)||0}))}
let lensControls;
function lensTable(actual,target,lens,isModel=false){const rows=exposureRows(actual,target,lens);return `<div class="tablewrap"><table><thead><tr><th>Exposure</th>${isModel?'':'<th>Actual %</th>'}<th>${isModel?'Model':'Client target'} %</th>${isModel?'':'<th>Drift (pp)</th>'}</tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.name)}</td>${isModel?'':`<td>${x.actual===null?'Unavailable':fmt(x.actual)}</td>`}<td>${x.target===null?'Not defined':fmt(x.target)}</td>${isModel?'':`<td>${x.actual===null||x.target===null?'—':signed(x.actual-x.target)}</td>`}</tr>`).join('')||'<tr><td colspan="4">No data for this lens.</td></tr>'}</tbody></table></div><p><small>${lens==='cr'?'Percentages use debt only.':lens==='th'?'Themes overlap; their percentages can exceed 100% when added.':'Percentages use the whole portfolio.'} Exposure data is illustrative, extracted from the original mockup. Exposure targets are derived from the selected allocation.</small></p>`}
function lensContent(actual,target,isModel=false){if(activeLens!=='tree')return lensTable(actual,target,activeLens,isModel);return `<p class="note">Hierarchy groups the original asset classes with their exposure dimensions. Geography, market cap and sector are separate views: the source contains no joint underlying-holdings data to combine them reliably.</p>${originalData.assetHierarchy.map(c=>{const aa=actual.filter(x=>x.category===c.n),tt=target.filter(x=>x.category===c.n),dims=c.n==='Equity'?['geo','mc','sec']:c.n==='Fixed income'?['cr']:['sec'];return `<details class="card" open><summary>${esc(c.n)}</summary>${dims.map(l=>`<details class="review-detail"><summary>${lenses.find(x=>x[0]===l)[1]} (% of ${esc(c.n)})</summary>${lensTable(aa,tt,l,isModel).replace('Percentages use the whole portfolio.','Percentages use this asset class.')}</details>`).join('')}</details>`}).join('')}`}
function stack(values){return `<div class="allocation" style="margin:8px 0">${values.map((x,i)=>`<span style="width:${Math.max(0,x)}%;background:${palette[i]}" title="${esc(originalData.assetHierarchy[i].n)} ${fmt(x)}%"></span>`).join('')}</div>`}

let distribution;
function refreshLens(context){context==='model'?render():renderClient()}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.lens){activeLens=b.dataset.lens;refreshLens(b.dataset.context)}if(b.dataset.fundMode){fundMode=b.dataset.fundMode;try{localStorage.setItem('portfolio-fund-mode',fundMode)}catch{}refreshLens(b.dataset.context)}});

// Keep version numbers in history only; published snapshots remain immutable internally.
list=function(){selected=null;editing=false;$('footer').innerHTML='';$('app').innerHTML=`<div class="flex between"><div><div class="eyebrow">Investment strategy</div><h1>Models</h1><p class="muted">Reusable allocations, from asset classes to individual investments.</p></div><button class="primary" onclick="newModel()">＋ Create model</button></div><h2>Your model library</h2><div class="card tablewrap"><table><thead><tr><th>Model / intended use</th><th>Portfolios</th><th>State</th><th></th></tr></thead><tbody>${models.map(m=>`<tr><td><button class="link" onclick="openModel('${m.id}')">${esc(latest(m)?.data.name||m.draft?.name||'Untitled model')}</button><br><small>${esc(latest(m)?.data.description||m.draft?.description||'')}</small></td><td>${m.clients.length}</td><td>${m.draft?'Draft changes':'Published'}</td><td><button onclick="openModel('${m.id}')">Open →</button></td></tr>`).join('')}</tbody></table></div><p class="note">Model changes are reviewed before updating an approved client target. Publication details and previous snapshots are available in History.</p>`};
// ---- Models ---------------------------------------------------------------
let modelTagFilter={},modelFirmRows=null;
const tagFilterActive=()=>Object.values(modelTagFilter).some(set=>set.size);
const securityTagsCache=()=>originalData.securities.map((_,i)=>TAX.securityTags(i));
const tagMatches=(index,tags)=>Object.keys(modelTagFilter).every(group=>
 !modelTagFilter[group].size||tags[index].some(([g,v])=>g===group&&modelTagFilter[group].has(v)));

// What the firm actually holds, so a target can be read against reality.
function firmRows(){
 if(modelFirmRows)return modelFirmRows;
 const vector=originalData.securities.map(()=>0);
 for(const record of clientRecords)for(const asset of approved(record).plan.assets)
  if(asset.included){const i=originalData.securities.findIndex(s=>s.id===asset.securityId);if(i>=0)vector[i]+=asset.value}
 return (modelFirmRows=TAX.rowsFor({vector,modelName:data().name}).by);
}
const clearFirmRows=()=>{modelFirmRows=null};

function modelComparisonStrip(activeName){
 const published=models.filter(m=>latest(m));
 if(published.length<2)return '';
 return `<section class="card"><h2>How the models compare</h2>${published.map(m=>{
  const d=latest(m).data;
  const values=originalData.assetHierarchy.map(c=>d.allocations.find(n=>n.name===c.n)?.target||0);
  return `<div class="compare-row${d.name===activeName?' is-active':''}"><div>${esc(d.name)}<small>${esc(d.kind||'')}</small></div><div class="compare-stack">${values.map((x,i)=>`<span style="width:${Math.max(0,x)}%;background:${palette[i]}" title="${esc(originalData.assetHierarchy[i].n)} ${fmt(x)}%"></span>`).join('')}</div><div class="numeric">${values.map(x=>Math.round(x)).join(' / ')}</div></div>`;
 }).join('')}<small class="legend">${originalData.assetHierarchy.map((c,i)=>`<span><i class="dot" style="background:${palette[i]}"></i>${esc(c.n)}</span>`).join('')}</small></section>`;
}

function modelDepthCard(){
 const levels=originalData.settings.levelNames;
 return `<section class="card"><h2>How deep each asset class is modelled</h2>
 <div class="depth-grid">${originalData.assetHierarchy.map(c=>`<div><small>${esc(c.n)}</small><strong>${esc(levels[originalData.settings.modelDepthByClass[c.n]])}</strong></div>`).join('')}</div>
 <p class="note">A model sets targets down to the level shown. Below it a portfolio still lists what it holds, but there is no target to compare against, which is different from a target of nothing. Changing a depth re-projects every model and every portfolio adjustment, so it is a firm decision rather than an edit, and is not offered here yet.</p></section>`;
}

function tagFilterPanel(tags){
 const counts={};
 for(const list of tags)for(const [group,value] of list){(counts[group]=counts[group]||{})[value]=(counts[group][value]||0)+1}
 const groups=TAX.TAG_GROUPS.filter(g=>counts[g]&&Object.keys(counts[g]).length>1);
 const selected=groups.reduce((sum,g)=>sum+(modelTagFilter[g]?.size||0),0);
 return `<details class="card tag-filter"${selected?' open':''}><summary>Filter by what the securities are${selected?` · ${selected} selected`:''}</summary>
 <div class="tag-filter-body">${groups.map(group=>`<div><strong>${esc(group)}</strong><div class="tag-filter-options">${Object.entries(counts[group]).sort((a,b)=>b[1]-a[1]).map(([value,count])=>`<label><input type="checkbox" data-tag-group="${esc(group)}" data-tag-value="${esc(value)}" ${modelTagFilter[group]?.has(value)?'checked':''}> ${esc(value)} <small>${count}</small></label>`).join('')}</div></div>`).join('')}</div>
 ${selected?'<div class="flex"><button onclick="clearTagFilter()">Clear filters</button></div>':''}
 <p class="note">A group is listed only where the securities actually differ. Narrowing here hides the branches that hold nothing matching, which is how you find, say, every locked or sub-investment-grade corner of a model.</p></details>`;
}
function clearTagFilter(){modelTagFilter={};render()}
function toggleTag(group,value){
 const set=modelTagFilter[group]||(modelTagFilter[group]=new Set());
 set.has(value)?set.delete(value):set.add(value);
 if(!set.size)delete modelTagFilter[group];
 render();
}
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.dataset&&t.dataset.tagGroup!==undefined&&t.type==='checkbox')toggleTag(t.dataset.tagGroup,t.dataset.tagValue);
});

render=function(){
 clearFirmRows();
 const m=current(),d=data(),issues=validation(d);
 const tags=securityTagsCache(),filtering=tagFilterActive();
 const intended=d.riskProfile||m.riskProfile;
 $('app').innerHTML=`<button class="quiet" onclick="saveAndList()">← All models</button>
 <div class="flex between toolbar"><div><h1>${esc(d.name||'Untitled model')}</h1><p>${esc(d.description||'')}</p>
  <span class="badge ${editing?'draft':''}">${editing?'Draft':'Published'}</span>
  ${d.kind?` <span class="badge">${esc(d.kind)}</span>`:''}
  ${intended?` <span class="badge">Intended for a ${esc(intended)} risk profile</span>`:''}</div>
  <div class="flex"><button onclick="history()">History</button>${!editing?`<button class="primary" onclick="startEdit()">${m.draft?'Resume draft':'Edit model'}</button>`:''}</div></div>
 <button class="quiet" onclick="clients()">${m.clients.length} ${m.clients.length===1?'portfolio uses':'portfolios use'} this model →</button>
 ${editing?`<details class="card"><summary>Model name and intended use</summary><label class="field">Model name<input value="${esc(d.name)}" onchange="data().name=this.value;dirty=true;render()"></label><label class="field">Intended use<textarea onchange="data().description=this.value;dirty=true;render()">${esc(d.description||'')}</textarea></label></details>`:''}
 ${modelComparisonStrip(d.name)}
 ${modelDepthCard()}
 <div class="card"><h2>Target allocation · ${fmt(d.allocations.reduce((s,n)=>s+n.target,0))}%</h2>
  <small>Percentages of the whole portfolio. The children of a node always add up to it, so editing one moves its siblings rather than the total.</small>
  ${stack(originalData.assetHierarchy.map(c=>d.allocations.find(n=>n.name===c.n)?.target||0))}</div>
 ${tagFilterPanel(tags)}
 <div class="flex toolbar"><button onclick="expandAll()">Expand all</button><button onclick="collapseAll()">Collapse all</button>${filtering?'<small class="muted">Filtered: branches with no matching security are hidden.</small>':''}</div>
 <div class="card tablewrap"><table class="model-tree"><thead><tr><th>Classification</th><th class="numeric-head">Target %</th><th class="numeric-head">Band ± pp</th><th class="numeric-head">Firm holds %</th><th>What is in here</th></tr></thead><tbody>${rows(d.allocations,0,tags,filtering)||`<tr><td colspan="5" class="empty-state">No branch matches these filters.</td></tr>`}</tbody></table></div>
 <p class="note">A band is how far a portfolio may drift from this target before it is flagged for review. The asset-class band is the portfolio's own threshold, set per portfolio, so it is not a model setting.</p>
 <div class="card ${issues.length?'warning':''}"><h2>${issues.length?'Complete before publishing':'Allocation checks passed'}</h2>${issues.length?'<ul>'+issues.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p>Targets total 100% and every breakdown matches its parent.</p>'}</div>`;
 $('footer').innerHTML=editing?`<div class="footer"><div><strong>${dirty?'Changes not saved yet':'Draft workspace'}</strong><small>Approved client targets remain unchanged</small></div><div class="flex"><button onclick="saveDraft()">Save draft</button><button class="primary" onclick="review()" ${issues.length?'disabled':''}>Review and publish →</button></div></div>`:'';
};

// Three or four levels deep depending on the branch, so the row renders what the
// node is rather than assuming where it sits.
rows=function(ns,depth=0,tags,filtering){
 const firm=firmRows();
 return ns.map(n=>{
  const under=(TAX.byKey.get(n.key)||{holdings:[]}).holdings;
  const matching=filtering?under.filter(i=>tagMatches(i,tags)):under;
  if(filtering&&!matching.length)return '';
  const open=expanded.has(n.id)||filtering;
  const held=firm.get(n.key);
  const row=`<tr class="${depth?'child':'rowtop'} level-${Math.min(depth,2)}"><td style="padding-left:${12+depth*20}px">
   ${n.children.length?`<button class="chev" aria-label="${open?'Collapse':'Expand'} ${esc(n.name)}" aria-expanded="${open}" onclick="toggle('${esc(n.id)}')">${open?'⌄':'›'}</button>`:'<span class="chev"></span>'}${esc(n.name)}
   ${n.targetLevel&&n.children.length?' <span class="holding-tag" title="Targets stop at this level">target level</span>':''}
   ${n.targetLevel&&!under.length?' <span class="holding-tag">nothing held here</span>':''}</td>
  <td class="numeric">${editing?`<input aria-label="Target for ${esc(n.name)}" class="target" type="number" step="0.1" min="0" max="100" value="${fmt(n.target)}" onchange="changeTarget('${esc(n.id)}',this.value)">`:fmt(n.target)+'%'}</td>
  <td class="numeric">${depth===0?'<small class="muted">per portfolio</small>':editing?`<input aria-label="Band for ${esc(n.name)}" class="target" type="number" step="0.5" min="0.5" value="${fmt(n.band)}" onchange="changeBand('${esc(n.id)}',this.value)">`:'±'+fmt(n.band)}</td>
  <td class="numeric">${held?fmt(held.current):'—'}</td>
  <td class="tag-cell">${tagSummary(matching,tags,under.length)}</td></tr>`;
  return row+(n.children.length&&open?rows(n.children,depth+1,tags,filtering):'');
 }).join('');
};

// The attributes of the securities under a node, most common first. Clicking one
// filters the tree to the branches holding it.
function tagSummary(holdings,tags,total){
 if(!holdings.length)return '<small class="muted">—</small>';
 const groups={};
 for(const i of holdings)for(const [group,value] of tags[i]){(groups[group]=groups[group]||{})[value]=(groups[group][value]||0)+1}
 const shown=TAX.TAG_GROUPS.filter(g=>groups[g]).slice(0,3);
 return `<small class="muted">${holdings.length}${total!==holdings.length?' of '+total:''} ${total===1?'security':'securities'}</small>`+
  shown.map(group=>{
   const ranked=Object.entries(groups[group]).sort((a,b)=>b[1]-a[1]);
   const on=modelTagFilter[group]||new Set();
   return `<span class="tag-pill"><small>${esc(group)}</small>${ranked.slice(0,2).map(([value,count])=>`<button class="tag-value${on.has(value)?' on':''}" onclick="toggleTag('${esc(group)}','${esc(value).replace(/'/g,"&#39;")}')" title="${count} of ${holdings.length}. Select to filter.">${esc(value)}</button>`).join('')}${ranked.length>2?`<span class="muted" title="${esc(ranked.slice(2).map(x=>x[0]).join(', '))}">+${ranked.length-2}</span>`:''}</span>`;
  }).join('');
}

changes=function(before,after){const a=flatten(before),b=flatten(after);let out=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>a[k]?.target!==b[k]?.target).map(k=>`<tr><td>${esc(k)}</td><td>${a[k]?fmt(a[k].target)+'%':'—'}</td><td>${b[k]?fmt(b[k].target)+'%':'Removed'}</td></tr>`).join('');for(const field of ['name','description'])if(before?.[field]!==after[field])out+=`<tr><td>${field==='name'?'Model name':'Intended use'}</td><td>${esc(before?.[field]||'—')}</td><td>${esc(after[field])}</td></tr>`;return out||'<tr><td colspan="3">No allocation changes.</td></tr>'};
review=function(){if(validation(data()).length)return;show(`<h2>Review ${esc(data().name)}</h2><div class="tablewrap"><table><thead><tr><th>Allocation / field</th><th>Published</th><th>Draft</th></tr></thead><tbody>${changes(latest(current())?.data,data())}</tbody></table></div><p class="note">${current().clients.length} portfolios retain their approved targets.</p><label class="field">Reason for this change<textarea id="reason"></textarea></label><p id="publishError" class="errors"></p><div class="actions"><button onclick="closeModal()">Back to draft</button><button class="primary" onclick="publish()">Publish model</button></div>`)};
