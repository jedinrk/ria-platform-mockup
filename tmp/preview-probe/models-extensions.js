'use strict';
// Model library polish and the Profile comparison sibling page (plan 4.1 and 4.5).
// Presentation only: published snapshots, drafts and client targets are untouched.

let modelLibrarySearch='';
const publishedModels=()=>models.filter(m=>latest(m));
const modelUpdated=m=>m.draft?'Draft in progress':(latest(m)?.date||'Not recorded');
const modelTopLevel=m=>{const d=latest(m)?.data||m.draft;return originalData.assetHierarchy.map(c=>d?.allocations.find(n=>n.name===c.n)?.target||0)};
const modelAccounts=m=>clientRecords.filter(c=>approved(c).plan.base.modelId===m.id);

function modelMatches(m,q){
 if(!q)return true;
 const v=latest(m)?.data||m.draft||{};
 return ((v.name||'')+' '+(v.description||'')).toLowerCase().includes(q.toLowerCase());
}
function allocationPreview(values){
 return `<div class="model-preview"><div class="allocation" style="margin:0">${values.map((x,i)=>`<span style="width:${Math.max(0,x)}%;background:${palette[i]}" title="${esc(originalData.assetHierarchy[i].n)} ${fmt(x)}%"></span>`).join('')}</div><small>${originalData.assetHierarchy.map((c,i)=>`<span><i style="background:${palette[i]}"></i>${esc(c.n)} ${fmt(values[i])}%</span>`).join('')}</small></div>`;
}

const libraryBeforeExtensions=list;
list=function(){
 libraryBeforeExtensions();
 const q=modelLibrarySearch,shown=models.filter(m=>modelMatches(m,q));
 const table=document.querySelector('.card.tablewrap');
 if(!table)return;
 table.outerHTML=`<div class="library-toolbar"><label class="search-field model-search">Search models<input id="modelLibrarySearch" type="search" placeholder="Name or intended use" value="${esc(q)}"></label><p class="list-count">Showing ${shown.length} of ${models.length} ${models.length===1?'model':'models'}${q?' matching “'+esc(q)+'”':''}</p></div>
 <div class="card tablewrap"><table class="model-library"><thead><tr><th>Model / intended use</th><th>Top-level allocation</th><th class="numeric-head col-count">Portfolios</th><th class="col-state">State</th><th class="col-date">Last updated</th><th class="col-action"></th></tr></thead><tbody>${shown.map(m=>{
  const v=latest(m)?.data||m.draft||{};
  return `<tr><td class="model-identity"><button class="link" data-open-model="${esc(m.id)}">${esc(v.name||'Untitled model')}</button><small>${esc(v.description||'No intended use recorded')}</small></td><td>${allocationPreview(modelTopLevel(m))}</td><td class="numeric col-count">${m.clients.length}</td><td class="col-state">${m.draft?'<span class="badge draft">Draft changes</span>':'<span class="badge">Published</span>'}</td><td class="col-date"><small>${esc(modelUpdated(m))}</small></td><td class="col-action"><button data-open-model="${esc(m.id)}">Open →</button></td></tr>`;
 }).join('')||`<tr><td colspan="6" class="empty-state">No model matches “${esc(q)}”. Clear the search to see all ${models.length}.</td></tr>`}</tbody></table></div>`;
 if(q){const input=$('modelLibrarySearch');input.focus();input.setSelectionRange(input.value.length,input.value.length)}
};
document.addEventListener('input',e=>{
 if(e.target.id!=='modelLibrarySearch')return;
 modelLibrarySearch=e.target.value;list();
});
document.addEventListener('click',e=>{
 const b=e.target.closest('button[data-open-model]');if(!b)return;
 openModel(b.dataset.openModel);
});

// --- Intended profile, as a view inside Model comparison ---------------
// It was a separate page; the per-class rows simply repeated the Asset
// allocation view. Same models, same columns, so it belongs as a lens.
comparisonLenses.push(['profile','Intended profile']);

function profileRow(label,hint,cells){
 return `<tr><th scope="row">${esc(label)}${hint?`<small>${esc(hint)}</small>`:''}</th>${cells.join('')}</tr>`;
}
function profileComparisonTable(picked){
 if(!picked.length)return '<section class="card empty-state"><strong>Choose at least one model</strong><p>Select models on the left to compare their intended profile.</p></section>';
 const values=picked.map(modelTopLevel);
 const col=fn=>picked.map((m,i)=>`<td>${fn(m,i)}</td>`);
 const largest=values.map(v=>{const i=v.indexOf(Math.max(...v));return originalData.assetHierarchy[i].n+' '+fmt(v[i])+'%'});
 return `<div class="card tablewrap" style="padding:0"><table class="profile-table compare-table" style="min-width:${250+200*picked.length}px"><caption class="sr-only">Intended profile of the selected models</caption>
 <thead><tr><th scope="col">Attribute</th>${picked.map((m,i)=>`<th scope="col"><div class="compare-colour" style="background:${colours[i%colours.length]}"></div>${esc(latest(m).data.name)}<button class="quiet compare-remove" data-compare-open="${esc(m.id)}">Open model</button></th>`).join('')}</tr></thead>
 <tbody>
 ${profileRow('Intended use','As recorded on the model',col(m=>esc(latest(m).data.description||'Not recorded')))}
 ${profileRow('Allocation shape','Asset allocation view has the detail',col((m,i)=>allocationPreview(values[i])))}
 ${profileRow('Largest asset class','',col((m,i)=>esc(largest[i])))}
 ${profileRow('Portfolios using this model','Approved client targets',col(m=>`<strong>${m.clients.length}</strong>`))}
 ${profileRow('Assessed risk labels on those portfolios','From the account record, not the model',col(m=>{const a=modelAccounts(m);if(!a.length)return 'None';const counts={};for(const c of a)counts[c.risk]=(counts[c.risk]||0)+1;return Object.entries(counts).map(([k,v])=>esc(k)+' \u00d7'+v).join('<br>')}))}
 ${profileRow('Last updated','',col(m=>`<small>${esc(modelUpdated(m))}</small>`))}
 ${profileRow('Expected volatility','Never recorded in the original sample',col(()=>'<span class="compare-missing">Not supplied</span>'))}
 ${profileRow('Recommended time horizon','Never recorded in the original sample',col(()=>'<span class="compare-missing">Not supplied</span>'))}
 ${profileRow('Minimum investment','Never recorded in the original sample',col(()=>'<span class="compare-missing">Not supplied</span>'))}
 </tbody></table></div>
 <p class="note">A profile label does not by itself prove suitability. Risk assessment, profile comparison and assigning a model to a portfolio are separate actions, and this view performs none of them. Attributes marked <strong>Not supplied</strong> must not be inferred from the allocation.</p>`;
}

// --- Equity sector concentration check, from the original mockup ---------
function sectorConcentration(d){
 const cap=originalData.settings.sectorCapPercent,total=leafValues(d).reduce((s,x)=>s+x.value,0);
 const equity=leafValues(d).filter(x=>x.category==='Equity');
 if(!equity.length||!total)return null;
 const {buckets}=exposure(equity,'sec'),bySector=new Map();
 for(const [key,value] of buckets){const sector=key.split(' / ')[0];bySector.set(sector,(bySector.get(sector)||0)+value)}
 const ranked=[...bySector].map(([name,value])=>({name,percent:value/total*100})).sort((a,b)=>b.percent-a.percent);
 return {cap,top:ranked[0],atLeastOnePercent:ranked.filter(x=>x.percent>=1).length,breach:ranked[0].percent>cap};
}
const renderBeforeConcentration=render;
render=function(){
 renderBeforeConcentration();
 if(activeLens!=='sec')return;
 const c=sectorConcentration(data());if(!c)return;
 document.querySelector('main section.card')?.insertAdjacentHTML('afterbegin',
  `<div class="concentration ${c.breach?'is-breach':''}"><div><small>Largest equity sector</small><strong>${esc(c.top.name)} ${fmt(c.top.percent)}%</strong></div><div><small>Firm cap</small><strong>${fmt(c.cap)}%</strong></div><div><small>Equity sectors at 1% or more</small><strong>${c.atLeastOnePercent}</strong></div><span class="state-pill ${c.breach?'over':'ok'}">${c.breach?'Above cap':'Within cap'}</span></div>`);
};

// Route the Profile view through the existing comparison table, and keep the
// sub-nav to two destinations: the library, and one comparison page.
const comparisonTableBeforeProfile=comparisonTable;
comparisonTable=function(picked){
 return comparisonState.lens==='profile'?profileComparisonTable(picked):comparisonTableBeforeProfile(picked);
};
