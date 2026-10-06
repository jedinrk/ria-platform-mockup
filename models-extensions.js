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
 return `<div class="model-preview"><div class="allocation" style="margin:0">${values.map((x,i)=>`<span style="width:${Math.max(0,x)}%;background:${palette[i]}" title="${esc(originalData.assetHierarchy[i].n)} ${fmt(x)}%"></span>`).join('')}</div><small>${originalData.assetHierarchy.map((c,i)=>esc(c.n.split(' ')[0])+' '+fmt(values[i])+'%').join(' · ')}</small></div>`;
}

const libraryBeforeExtensions=list;
list=function(){
 libraryBeforeExtensions();
 const q=modelLibrarySearch,shown=models.filter(m=>modelMatches(m,q));
 const table=document.querySelector('.card.tablewrap');
 if(!table)return;
 table.outerHTML=`<label class="search-field model-search">Search models<input id="modelLibrarySearch" type="search" placeholder="Name or intended use" value="${esc(q)}"></label>
 <p class="list-count">Showing ${shown.length} of ${models.length} ${models.length===1?'model':'models'}${q?' matching “'+esc(q)+'”':''}</p>
 <div class="card tablewrap"><table class="model-library"><thead><tr><th>Model / intended use</th><th>Top-level allocation</th><th class="numeric-head">Portfolios</th><th>State</th><th>Last updated</th><th></th></tr></thead><tbody>${shown.map(m=>{
  const v=latest(m)?.data||m.draft||{};
  return `<tr><td><button class="link" data-open-model="${esc(m.id)}">${esc(v.name||'Untitled model')}</button><small>${esc(v.description||'No intended use recorded')}</small></td><td>${allocationPreview(modelTopLevel(m))}</td><td class="numeric">${m.clients.length}</td><td>${m.draft?'<span class="badge draft">Draft changes</span>':'<span class="badge">Published</span>'}</td><td><small>${esc(modelUpdated(m))}</small></td><td><button data-open-model="${esc(m.id)}">Open →</button></td></tr>`;
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

// --- Profile comparison -------------------------------------------------
let profileComparing=false;
const subnavBeforeProfiles=modelSubnav;
modelSubnav=function(comparing){
 return `<nav class="model-subnav" aria-label="Models views"><button data-compare-action="library" ${!comparing&&!profileComparing?'aria-current="page"':''}>Model library</button><button data-compare-action="compare" ${comparing?'aria-current="page"':''}>Model comparison</button><button data-profile-compare ${profileComparing?'aria-current="page"':''}>Profile comparison</button></nav>`;
};

function profileRow(label,hint,cells){
 return `<tr><th scope="row">${esc(label)}${hint?`<small>${esc(hint)}</small>`:''}</th>${cells.join('')}</tr>`;
}
function renderProfileComparison(){
 profileComparing=true;comparisonState.active=false;
 leaveModels();clientEditing=false;activeClient=null;navState('models');
 $('footer').innerHTML='';
 const picked=publishedModels();
 const body=picked.length<1?'<section class="card empty-state"><strong>No published model to compare</strong><p>Publish at least one model to use this page.</p></section>':(()=>{
  const values=picked.map(modelTopLevel);
  const largest=values.map(v=>{const i=v.indexOf(Math.max(...v));return originalData.assetHierarchy[i].n+' '+fmt(v[i])+'%'});
  const col=(fn)=>picked.map((m,i)=>`<td>${fn(m,i)}</td>`);
  return `<div class="card tablewrap"><table class="profile-table" style="min-width:${250+200*picked.length}px"><caption class="sr-only">Intended profile of each published model</caption>
  <thead><tr><th scope="col">Attribute</th>${picked.map((m,i)=>`<th scope="col"><div class="compare-colour" style="background:${colours[i%colours.length]}"></div>${esc(latest(m).data.name)}<button class="quiet" data-open-model="${esc(m.id)}">Open model</button></th>`).join('')}</tr></thead>
  <tbody>
  ${profileRow('Intended use','As recorded on the model',col(m=>esc(latest(m).data.description||'Not recorded')))}
  ${profileRow('Top-level allocation','',col((m,i)=>allocationPreview(values[i])))}
  ${profileRow('Largest asset class','',col((m,i)=>esc(largest[i])))}
  ${originalData.assetHierarchy.map((c,ci)=>profileRow(c.n,'% of the whole model',col((m,i)=>`<strong>${fmt(values[i][ci])}%</strong>`))).join('')}
  ${profileRow('Portfolios using this model','Approved client targets',col(m=>`${m.clients.length}`))}
  ${profileRow('Assessed risk labels on those portfolios','From the account record, not the model',col(m=>{const a=modelAccounts(m);if(!a.length)return 'None';const counts={};for(const c of a)counts[c.risk]=(counts[c.risk]||0)+1;return Object.entries(counts).map(([k,v])=>esc(k)+' ×'+v).join('<br>')}))}
  ${profileRow('Last updated','',col(m=>`<small>${esc(modelUpdated(m))}</small>`))}
  ${profileRow('Expected volatility','Not supplied by the original sample',col(()=>'<span class="compare-missing">Not supplied</span>'))}
  ${profileRow('Recommended time horizon','Not supplied by the original sample',col(()=>'<span class="compare-missing">Not supplied</span>'))}
  ${profileRow('Minimum investment','Not supplied by the original sample',col(()=>'<span class="compare-missing">Not supplied</span>'))}
  </tbody></table></div>`;
 })();
 $('app').innerHTML=`${modelSubnav(false)}<div class="eyebrow">Investment strategy</div><h1>Profile comparison</h1><p class="muted">How published models differ in intended profile. Drafts are excluded.</p>${body}
 <p class="note">A profile label does not by itself prove suitability. Risk assessment, profile comparison and assigning a model to a portfolio are separate actions, and this page performs none of them. Attributes marked <strong>Not supplied</strong> were never recorded in the original sample and must not be inferred from the allocation.</p>`;
 scrollWorkspace();
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-profile-compare')){renderProfileComparison();return}
 if(b.dataset.compareAction&&profileComparing)profileComparing=false;
});
const modelNavBeforeProfiles=modelNav;
modelNav=function(){profileComparing=false;modelNavBeforeProfiles()};
const openModelBeforeProfiles=openModel;
openModel=function(id){profileComparing=false;openModelBeforeProfiles(id)};

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
