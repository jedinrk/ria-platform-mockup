'use strict';
// Security master, built to the RIA-AssetConfig-Type1 sheet: one row per
// instrument, identity and market data arriving fixed from the source, and
// only Asset class / Sector / Sub-sector as the firm's decision.
// Classification is firm-wide, so edits are staged and applied deliberately.

const SECURITY_KEY='portfolio-security-master-v1';
const ASSET_CLASSES=originalData.assetHierarchy.map(c=>c.n);
const SECTORS=originalData.settings.classificationOrder.sec;
// AssetType is <<Fixed>> on the sheet: the instrument's form, not a choice.
const INSTRUMENT_TYPES={'Mutual funds':'Mutual fund','Direct stocks':'Equity share','ETFs':'ETF',
 'Bonds':'Bond','Fixed deposits':'Fixed deposit','EPF / PPF':'Retirement account','AIF':'AIF unit',
 'REIT / InvIT':'REIT / InvIT unit','Gold':'Gold','Real estate':'Property'};
const instrumentType=s=>INSTRUMENT_TYPES[s.subcategory]||s.subcategory;
const notSupplied='<span class="config-absent" title="Not supplied by the sample data" aria-label="Not supplied">—</span>';

const subsectorsBySector=()=>{
 const map=new Map();
 for(const s of originalData.securities){
  if(!s.tags.sector)continue;
  if(!map.has(s.tags.sector))map.set(s.tags.sector,new Set());
  if(s.tags.subsector)map.get(s.tags.sector).add(s.tags.subsector);
 }
 return map;
};
const allSubsectors=()=>[...new Set(originalData.securities.map(s=>s.tags.subsector).filter(Boolean))].sort();

let securityEdits={};
try{securityEdits=JSON.parse(localStorage.getItem(SECURITY_KEY)||'{}')}catch{securityEdits={}}
let securityPending={},securityFilters={search:'',assetClass:'',unclassifiedOnly:false},securityAddOpen=false;

// Saved classification is applied to the in-memory records at load, so every
// exposure view reads it without a second source of truth.
function applySecurityEdits(){
 for(const s of originalData.securities){
  const e=securityEdits[s.id];if(!e)continue;
  if(e.assetClass)s.assetClass=e.assetClass;
  if(e.sector!==undefined)s.tags.sector=e.sector;
  if(e.subsector!==undefined)s.tags.subsector=e.subsector;
  // The credit and duration lens is gated on isDebt, so asset class drives it.
  s.tags.isDebt=s.assetClass==='Debt';
 }
}
applySecurityEdits();

const securityValue=id=>clientRecords.reduce((sum,c)=>sum+approved(c).plan.assets
 .filter(a=>a.securityId===id&&a.included).reduce((s,a)=>s+a.value,0),0);
const securityPortfolios=id=>clientRecords.filter(c=>approved(c).plan.assets.some(a=>a.securityId===id&&a.included)).length;
const effectiveField=(s,field)=>securityPending[s.id]?.[field]??(field==='assetClass'?s.assetClass:s.tags[field]);
const isUnclassified=s=>!effectiveField(s,'sector')||!effectiveField(s,'subsector')||!effectiveField(s,'assetClass');
const pendingCount=()=>Object.values(securityPending).reduce((n,e)=>n+Object.keys(e).length,0);

function securityRows(){
 const q=securityFilters.search.toLowerCase();
 return originalData.securities.filter(s=>{
  if(securityFilters.assetClass&&effectiveField(s,'assetClass')!==securityFilters.assetClass)return false;
  if(securityFilters.unclassifiedOnly&&!isUnclassified(s))return false;
  if(!q)return true;
  return (s.name+' '+(s.tags.sector||'')+' '+(s.tags.subsector||'')+' '+instrumentType(s)).toLowerCase().includes(q);
 });
}

function classSelect(s){
 const value=effectiveField(s,'assetClass'),changed=securityPending[s.id]?.assetClass!==undefined;
 return `<select class="config-select ${changed?'is-changed':''}" data-security="${esc(s.id)}" data-field="assetClass" aria-label="Asset class for ${esc(s.name)}">
  ${ASSET_CLASSES.map(c=>`<option ${c===value?'selected':''}>${esc(c)}</option>`).join('')}</select>`;
}
function sectorSelect(s){
 const value=effectiveField(s,'sector'),changed=securityPending[s.id]?.sector!==undefined;
 const known=new Set(SECTORS);
 return `<select class="config-select ${changed?'is-changed':''}" data-security="${esc(s.id)}" data-field="sector" aria-label="Sector for ${esc(s.name)}">
  <option value="" ${value?'':'selected'}>Not classified</option>
  ${SECTORS.map(c=>`<option ${c===value?'selected':''}>${esc(c)}</option>`).join('')}
  ${value&&!known.has(value)?`<option selected>${esc(value)}</option>`:''}</select>`;
}
function subsectorSelect(s){
 const sector=effectiveField(s,'sector'),value=effectiveField(s,'subsector');
 const changed=securityPending[s.id]?.subsector!==undefined;
 const within=[...(subsectorsBySector().get(sector)||[])].sort();
 const others=allSubsectors().filter(x=>!within.includes(x));
 return `<select class="config-select ${changed?'is-changed':''}" data-security="${esc(s.id)}" data-field="subsector" aria-label="Sub-sector for ${esc(s.name)}" ${sector?'':'disabled'}>
  <option value="" ${value?'':'selected'}>${sector?'Not classified':'Choose a sector first'}</option>
  ${within.length?`<optgroup label="Used in ${esc(sector)}">${within.map(x=>`<option ${x===value?'selected':''}>${esc(x)}</option>`).join('')}</optgroup>`:''}
  ${others.length?`<optgroup label="Other sub-sectors">${others.map(x=>`<option ${x===value?'selected':''}>${esc(x)}</option>`).join('')}</optgroup>`:''}</select>`;
}

function securityGrid(){
 const rows=securityRows();
 if(!rows.length)return `<div class="card empty-state"><strong>No instrument matches these filters</strong><p>Clear the search or the filters to see all ${originalData.securities.length}.</p><button data-security-action="clear">Clear filters</button></div>`;
 return `<div class="card tablewrap" style="padding:0"><table class="config-grid"><caption class="sr-only">Firm-wide instrument classification</caption>
 <thead><tr>
  <th scope="col">Name</th><th scope="col">ISIN</th><th scope="col">Symbol</th>
  <th scope="col">Crisil rating</th><th scope="col">Current price</th><th scope="col">Asset type</th>
  <th scope="col" class="col-editable">Asset class</th><th scope="col" class="col-editable">Sector</th><th scope="col" class="col-editable">Sub-sector</th>
 </tr></thead><tbody>${rows.map(s=>{
  const rating=s.tags.creditQuality?`${esc(s.tags.creditQuality)}<small>${esc(s.tags.duration||'')}</small>`
   :effectiveField(s,'assetClass')==='Debt'?'<span class="config-absent" title="Debt instrument with no rating recorded">Not rated</span>'
   :'<span class="config-na" title="A credit rating does not apply to this instrument type">n/a</span>';
  const value=securityValue(s.id),count=securityPortfolios(s.id);
  return `<tr class="${isUnclassified(s)?'is-unclassified':''}">
   <th scope="row"><strong>${esc(s.name)}</strong><small>${esc(instrumentType(s))}${s.lookThrough?' · looked through':''}</small><small class="config-held">${money(value)} · ${count} ${count===1?'portfolio':'portfolios'}</small></th>
   <td class="config-fixed">${notSupplied}</td>
   <td class="config-fixed">${notSupplied}</td>
   <td class="config-fixed">${rating}</td>
   <td class="config-fixed">${notSupplied}</td>
   <td class="config-fixed">${esc(instrumentType(s))}</td>
   <td>${classSelect(s)}</td><td>${sectorSelect(s)}</td><td>${subsectorSelect(s)}</td></tr>`;
 }).join('')}</tbody></table></div>`;
}

function securityAddPanel(){
 if(!securityAddOpen)return `<div class="flex"><button data-security-action="add">＋ Add an instrument</button></div>`;
 const q=securityFilters.addSearch||'';
 const matches=q?originalData.securities.filter(s=>s.name.toLowerCase().includes(q.toLowerCase())).slice(0,6):[];
 return `<section class="card config-add"><div class="target-section-heading"><div><span class="section-step">Add an instrument</span><h2>Find it by name or ISIN</h2><p>Identity, rating and price arrive from the instrument source. You classify it afterwards.</p></div><button data-security-action="add-close">Cancel</button></div>
 <label class="search-field">Name or ISIN<input id="securityAdd" type="search" placeholder="Start typing" value="${esc(q)}" autocomplete="off"></label>
 ${q?`<ul class="config-suggestions">${matches.length?matches.map(s=>`<li><strong>${esc(s.name)}</strong><small>${esc(instrumentType(s))} · ${esc(s.tags.sector||'unclassified')}</small><span class="state-pill none">Already in the master</span></li>`).join(''):'<li class="muted">No match in the sample universe.</li>'}</ul>`:''}
 <p class="note">The sample contains exactly the ${originalData.securities.length} instruments of the original mockup and no external feed, so every match is already in the master. A production build would search a firm or vendor instrument master here and create the row from it.</p></section>`;
}

securityMasterPage=function(){
 leaveModels();clientEditing=false;activeClient=null;securityMasterOpen=true;
 if(typeof profileComparing!=='undefined')profileComparing=false;
 comparisonState.active=false;
 for(const id of ['navClients','navModels','navAudit'])$(id).setAttribute('aria-current','false');
 $('navSecurity').setAttribute('aria-current','page');
 document.title='Portfolio Console · Security master';
 const total=originalData.securities.length,unclassified=originalData.securities.filter(isUnclassified).length;
 const pending=pendingCount();
 $('app').innerHTML=`<div class="eyebrow">Firm-wide configuration</div><h1>Security master</h1>
 <p class="muted">Classify each instrument once. Every model and portfolio reads its exposure from here.</p>
 <div class="portfolio-metrics">
  <div class="card"><small>Instruments</small><strong>${total}</strong><small>in the firm master</small></div>
  <div class="card"><small>Need classification</small><strong class="${unclassified?'drift-over':''}">${unclassified}</strong><small>missing an asset class, sector or sub-sector</small></div>
  <div class="card"><small>Staged changes</small><strong>${pending}</strong><small>not applied yet</small></div>
  <div class="card"><small>Custom lens</small><strong>${esc(originalData.settings.customLensName)}</strong><small>set on each instrument</small></div>
 </div>
 <section class="card overview-card"><div class="overview-controls">
  <label class="search-field">Search instruments<input id="securitySearch" type="search" placeholder="Name, type or sector" value="${esc(securityFilters.search)}"></label>
  <label class="search-field">Asset class<select id="securityClassFilter"><option value="">All asset classes</option>${ASSET_CLASSES.map(c=>`<option ${securityFilters.assetClass===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
  <label class="check-filter"><input id="securityUnclassified" type="checkbox" ${securityFilters.unclassifiedOnly?'checked':''}> Needs classification only</label>
 </div>
 <p class="list-caption config-legend"><span class="config-key"><b class="is-fixed">Fixed</b> from the instrument source</span><span class="config-key"><b class="is-editable">Editable</b> your classification</span><span class="config-key"><b class="is-absent">—</b> not supplied by the sample</span><span class="config-count">Showing ${securityRows().length} of ${total}</span></p>
 </section>
 ${securityAddPanel()}
 ${securityGrid()}
 <p class="note">Sector and sub-sector feed every exposure view immediately once applied. Asset class also decides whether an instrument is measured by the credit and duration lens. Recorded holdings keep the asset class they were recorded under: reclassifying an instrument changes analysis from now on, it does not restate an approved snapshot.</p>
 <details class="card"><summary>What a production security master still needs decided</summary>
  <ul><li>shared instruments versus client-specific assets, such as a named flat or one EPF account;</li>
  <li>canonical instrument identity and aliases, and which of ISIN, symbol or name is authoritative;</li>
  <li>investment vehicle versus economic exposure, and who owns a fund's look-through data;</li>
  <li>who approves a classification, and from what effective date;</li>
  <li>whether a change ever restates history rather than only applying forward.</li></ul>
  <p class="note">The sheet defines the grid, not these. They stay open.</p></details>`;
 $('footer').innerHTML=pending?`<div class="footer"><div><strong>${pending} staged ${pending===1?'change':'changes'}</strong><small>Nothing is applied until you review it</small></div><div class="flex"><button data-security-action="discard">Discard</button><button class="primary" data-security-action="review">Review & apply →</button></div></div>`:'';
 scrollWorkspace();
};

function securityReview(){
 const entries=Object.entries(securityPending).flatMap(([id,fields])=>{
  const s=originalData.securities.find(x=>x.id===id);
  return Object.entries(fields).map(([field,value])=>({s,field,
   from:field==='assetClass'?s.assetClass:s.tags[field],to:value}));
 });
 const touched=[...new Set(entries.map(e=>e.s.id))];
 const value=touched.reduce((sum,id)=>sum+securityValue(id),0);
 const portfolios=new Set();
 for(const id of touched)for(const c of clientRecords)
  if(approved(c).plan.assets.some(a=>a.securityId===id&&a.included))portfolios.add(c.id);
 const label={assetClass:'Asset class',sector:'Sector',subsector:'Sub-sector'};
 show(`<div class="target-review-dialog"><span class="section-step">Firm-wide change</span><h2>Apply ${entries.length} classification ${entries.length===1?'change':'changes'}</h2>
 <p class="muted">This is not a portfolio edit. It changes how every model and portfolio measures these instruments.</p>
 <div class="review-impact-grid"><div><small>Instruments</small><strong>${touched.length}</strong></div><div><small>Value affected</small><strong>${money(value)}</strong></div><div><small>Portfolios affected</small><strong>${portfolios.size}</strong></div><div><small>Fields changed</small><strong>${entries.length}</strong></div></div>
 <div class="tablewrap"><table><thead><tr><th>Instrument</th><th>Field</th><th>From</th><th>To</th></tr></thead><tbody>
 ${entries.map(e=>`<tr><td>${esc(e.s.name)}</td><td>${esc(label[e.field])}</td><td>${e.from?esc(e.from):'<span class="compare-missing">Not classified</span>'}</td><td><strong>${e.to?esc(e.to):'<span class="compare-missing">Not classified</span>'}</strong></td></tr>`).join('')}
 </tbody></table></div>
 <p class="note">Sector and sub-sector changes take effect in every exposure view as soon as they are applied. An asset-class change also moves the instrument in or out of the credit and duration lens. Approved client targets, recorded holdings and historic snapshots are untouched.</p>
 <div class="actions"><button onclick="closeModal()">Back to the grid</button><button class="primary" data-security-action="apply">Apply firm-wide</button></div></div>`);
}

document.addEventListener('click',e=>{
 const b=e.target.closest('button[data-security-action]');if(!b)return;
 const action=b.dataset.securityAction;
 if(action==='clear'){securityFilters={search:'',assetClass:'',unclassifiedOnly:false};securityMasterPage();return}
 if(action==='add'){securityAddOpen=true;securityMasterPage();$('securityAdd')?.focus();return}
 if(action==='add-close'){securityAddOpen=false;securityFilters.addSearch='';securityMasterPage();return}
 if(action==='discard'){securityPending={};securityMasterPage();notify('Staged changes discarded. Nothing was applied.');return}
 if(action==='review')return securityReview();
 if(action==='apply'){
  for(const [id,fields] of Object.entries(securityPending)){
   securityEdits[id]={...securityEdits[id],...fields};
  }
  try{localStorage.setItem(SECURITY_KEY,JSON.stringify(securityEdits))}catch{}
  applySecurityEdits();securityPending={};closeModal();securityMasterPage();
  notify('Classification applied firm-wide. Exposure views now use it; approved targets and holdings are unchanged.');
 }
});
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.id==='securityClassFilter'){securityFilters.assetClass=t.value;securityMasterPage();return}
 if(t.id==='securityUnclassified'){securityFilters.unclassifiedOnly=t.checked;securityMasterPage();return}
 const id=t.dataset.security,field=t.dataset.field;
 if(!id||!field)return;
 const s=originalData.securities.find(x=>x.id===id);
 const current=field==='assetClass'?s.assetClass:s.tags[field];
 securityPending[id]=securityPending[id]||{};
 if((t.value||'')===(current||''))delete securityPending[id][field];
 else securityPending[id][field]=t.value;
 // Changing the sector invalidates a sub-sector that does not belong to it.
 if(field==='sector'){
  const within=subsectorsBySector().get(t.value)||new Set();
  const sub=effectiveField(s,'subsector');
  if(sub&&!within.has(sub)){securityPending[id].subsector='';}
 }
 if(!Object.keys(securityPending[id]).length)delete securityPending[id];
 securityMasterPage();
 document.querySelector(`[data-security="${id}"][data-field="${field}"]`)?.focus();
});
document.addEventListener('input',e=>{
 if(e.target.id==='securitySearch'){
  const pos=e.target.selectionStart;securityFilters.search=e.target.value;securityMasterPage();
  const i=$('securitySearch');i.focus();i.setSelectionRange(pos,pos);return;
 }
 if(e.target.id==='securityAdd'){
  const pos=e.target.selectionStart;securityFilters.addSearch=e.target.value;securityMasterPage();
  const i=$('securityAdd');i.focus();i.setSelectionRange(pos,pos);
 }
});
