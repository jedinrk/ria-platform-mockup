'use strict';
// Security master, built to the RIA-AssetConfig-Type1 sheet: one row per
// instrument, identity and market data arriving fixed from the source, and
// Asset class / Super sector / Sector / Sub-sector as the firm's decision.
// Classification is firm-wide, so edits are staged and applied deliberately.

const SECURITY_KEY='portfolio-security-master-v2';
const ASSET_CLASSES=originalData.assetHierarchy.map(c=>c.n);
// AssetType is <<Fixed>> on the sheet: the instrument's form, not a choice, and
// the master now states it rather than inferring it from a grouping name.
const instrumentType=s=>s.assetType||s.subcategory;
const notSupplied='<span class="config-absent" title="Not supplied by the sample data" aria-label="Not supplied">—</span>';

// The classification levels nest, so each dropdown offers only what belongs
// under the level above it. The declared taxonomy is the source, which lets a
// level offer a branch the sample does not yet hold.
const TAXONOMY=originalData.settings.taxonomy||[];
const distinct=values=>[...new Set(values.filter(Boolean))];
const superSectorsFor=assetClass=>distinct(TAXONOMY.filter(t=>t.assetClass===assetClass).map(t=>t.superSector));
const sectorsFor=(assetClass,superSector)=>distinct(TAXONOMY.filter(t=>t.assetClass===assetClass&&(!superSector||t.superSector===superSector)).map(t=>t.sector));
const subsectorsFor=(assetClass,superSector,sector)=>distinct(TAXONOMY.filter(t=>t.assetClass===assetClass&&(!superSector||t.superSector===superSector)&&(!sector||t.sector===sector)).map(t=>t.subSector));

let securityEdits={};
try{securityEdits=JSON.parse(localStorage.getItem(SECURITY_KEY)||'{}')}catch{securityEdits={}}
let securityPending={},securityFilters={search:'',assetClass:'',instrumentType:'',unclassifiedOnly:false},securityAddOpen=false;
let securityExpanded=new Set();
const CLASSIFICATION_FIELDS=['assetClass','superSector','sector','subsector'];

// Saved classification is applied to the in-memory records at load, so every
// exposure view reads it without a second source of truth.
function applySecurityEdits(){
 for(const s of originalData.securities){
  const e=securityEdits[s.id];if(!e)continue;
  if(e.assetClass)s.assetClass=e.assetClass;
  if(e.superSector!==undefined)s.superSector=e.superSector;
  if(e.sector!==undefined)s.tags.sector=e.sector;
  if(e.subsector!==undefined)s.tags.subsector=e.subsector;
  // The credit and duration view is gated on isDebt, so asset class drives it.
  s.tags.isDebt=s.assetClass==='Fixed income';
 }
}
applySecurityEdits();

// ---- Instrument attributes -------------------------------------------------
// Attributes sit outside the sheet's nine columns, so they are shown read-only
// and labelled by who can actually supply them. Three tiers, because three
// different parties own this data:
//
//   source  a market or provider feed states it; we receive it
//   firm    no feed supplies it, and one value is shared by every client who
//           holds the instrument, so the firm maintains it
//   client  the fact belongs to one client's holding, not to a shared
//           instrument: this deposit's rate, this investor's commitment
//
// Nothing here is editable yet. The client tier in particular must not get a
// firm-wide edit box, because editing it would change a value for every client
// at once. Where those assets should live is an open question, below.
const FEED_TYPES=new Set(['Direct equity','Mutual fund','ETF','Government bond','Corporate bond','REIT / InvIT','Debt fund']);
const CLIENT_ATTRIBUTES={
 'Fixed deposit':['rate','mat'],
 'Retirement account':[],
 'AIF':['com','vin'],
 'Digital asset':['cust'],
 'Collectible':['it','vd','vm'],
 'Real estate':['pt','loc','ry','val'],
};
const TIER_LABEL={source:'From the instrument source',firm:'Firm-maintained · no feed supplies this',client:'Client-specific · belongs to the holding, not the instrument'};
const TIER_SHORT={source:'Source',firm:'Firm',client:'Client'};
function attributeTier(s,key){
 if(FEED_TYPES.has(instrumentType(s)))return 'source';
 if((CLIENT_ATTRIBUTES[instrumentType(s)]||[]).includes(key))return 'client';
 // A physical holding's purity is a property of the client's own bars, not of a
 // scheme every client can buy.
 if(key==='pur'&&s.physical)return 'client';
 return 'firm';
}
const attributeSchema=s=>(originalData.settings.instrumentTypes||[]).find(t=>t.name===instrumentType(s))?.attributes||[];
function attributeFields(s){
 return attributeSchema(s).map(field=>({...field,value:s.attributes?.[field.key],tier:attributeTier(s,field.key)}))
  .filter(f=>f.value!==undefined&&f.value!=='');
}
function formatAttribute(field){
 if(field.kind!=='number')return esc(field.value);
 const unit=field.unit||'';
 if(!unit)return esc(field.value);
 // A currency unit reads as a prefix, a scale as a suffix: ₹8 L, not 8 ₹ L.
 if(unit.startsWith('\u20b9')){
  const scale=unit.slice(1).trim();
  return '\u20b9'+esc(field.value)+(scale?' '+esc(scale):'');
 }
 return esc(field.value)+(unit.length<=2?esc(unit):' '+esc(unit));
}
// A valuation nobody has refreshed is the quiet risk on an illiquid asset, so a
// date-valued attribute says how old it is rather than only what it says.
const MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function monthsSince(value){
 const match=/^([A-Za-z]{3})[a-z]*\s+(\d{4})$/.exec(String(value).trim());
 if(!match)return null;
 const month=MONTHS.indexOf(match[1].toLowerCase());
 if(month<0)return null;
 const asOf=new Date(originalData.metadata.asOf);
 return (asOf.getFullYear()-Number(match[2]))*12+(asOf.getMonth()-month);
}
const VALUATION_KEYS=new Set(['vd','val']);
function attributeAge(field){
 if(!VALUATION_KEYS.has(field.key))return '';
 const age=monthsSince(field.value);
 if(age===null||age<0)return '';
 const text=age===0?'this month':age===1?'1 month ago':age+' months ago';
 return `<span class="attr-age ${age>12?'is-stale':''}">valued ${text}</span>`;
}

const securityValue=id=>clientRecords.reduce((sum,c)=>sum+approved(c).plan.assets
 .filter(a=>a.securityId===id&&a.included).reduce((s,a)=>s+a.value,0),0);
const securityPortfolios=id=>clientRecords.filter(c=>approved(c).plan.assets.some(a=>a.securityId===id&&a.included)).length;
const effectiveField=(s,field)=>securityPending[s.id]?.[field]??(field==='assetClass'?s.assetClass:field==='superSector'?s.superSector:s.tags[field]);
const isUnclassified=s=>CLASSIFICATION_FIELDS.some(field=>!effectiveField(s,field));
const pendingCount=()=>Object.values(securityPending).reduce((n,e)=>n+Object.keys(e).length,0);

function securityRows(){
 const q=securityFilters.search.toLowerCase();
 return originalData.securities.filter(s=>{
  if(securityFilters.assetClass&&effectiveField(s,'assetClass')!==securityFilters.assetClass)return false;
  if(securityFilters.instrumentType&&instrumentType(s)!==securityFilters.instrumentType)return false;
  if(securityFilters.unclassifiedOnly&&!isUnclassified(s))return false;
  if(!q)return true;
  return (s.name+' '+(s.symbol||'')+' '+(s.superSector||'')+' '+(s.tags.sector||'')+' '+(s.tags.subsector||'')+' '+instrumentType(s)).toLowerCase().includes(q);
 });
}

// One builder for all four levels: each offers what the level above allows, and
// keeps an out-of-taxonomy value selectable so a staged edit is never silently
// dropped.
function levelSelect(s,field,label,options,disabledWhen){
 const value=effectiveField(s,field)||'';
 const changed=securityPending[s.id]?.[field]!==undefined;
 const known=new Set(options);
 const required=field==='assetClass';
 return `<select class="config-select ${changed?'is-changed':''}" data-security="${esc(s.id)}" data-field="${field}" aria-label="${esc(label)} for ${esc(s.name)}" ${disabledWhen?'disabled':''}>
  ${required?'':`<option value="" ${value?'':'selected'}>${disabledWhen?esc(disabledWhen):'Not classified'}</option>`}
  ${options.map(c=>`<option ${c===value?'selected':''}>${esc(c)}</option>`).join('')}
  ${value&&!known.has(value)?`<option selected>${esc(value)}</option>`:''}</select>`;
}
const classSelect=s=>levelSelect(s,'assetClass','Asset class',ASSET_CLASSES);
const superSectorSelect=s=>levelSelect(s,'superSector','Super sector',superSectorsFor(effectiveField(s,'assetClass')));
function sectorSelect(s){
 const superSector=effectiveField(s,'superSector');
 return levelSelect(s,'sector','Sector',sectorsFor(effectiveField(s,'assetClass'),superSector),superSector?'':'Choose a super sector first');
}
function subsectorSelect(s){
 const sector=effectiveField(s,'sector');
 return levelSelect(s,'subsector','Sub-sector',subsectorsFor(effectiveField(s,'assetClass'),effectiveField(s,'superSector'),sector),sector?'':'Choose a sector first');
}

// Attributes for one instrument, grouped by who owns them so the grid teaches
// the distinction rather than flattening it.
function attributePanel(s,columns){
 const fields=attributeFields(s);
 const groups=['source','firm','client'].map(tier=>[tier,fields.filter(f=>f.tier===tier)]).filter(([,list])=>list.length);
 const type=instrumentType(s);
 return `<tr class="config-detail"><td colspan="${columns}"><div class="attr-panel">
  <div class="attr-head"><strong>${esc(type)} attributes</strong><small>Defined by the instrument type, outside the configuration sheet. Read-only in this prototype.</small></div>
  ${groups.length?groups.map(([tier,list])=>`<div class="attr-group attr-${tier}">
   <div class="attr-group-head"><span class="attr-tier attr-tier-${tier}">${TIER_SHORT[tier]}</span><small>${esc(TIER_LABEL[tier])}</small></div>
   <dl class="attr-list">${list.map(f=>`<div><dt>${esc(f.label)}</dt><dd>${formatAttribute(f)}${attributeAge(f)}</dd></div>`).join('')}</dl>
  </div>`).join(''):'<p class="muted">No attributes are recorded for this instrument.</p>'}
  ${s.lookThrough?`<details class="attr-lookthrough"><summary>Underlying exposure · looked through</summary>${['sector','marketCap','geography'].map(dimension=>`<div class="attr-lt"><strong>${dimension==='marketCap'?'Market cap':dimension[0].toUpperCase()+dimension.slice(1)}</strong>${s.lookThrough[dimension].map(x=>`<span>${esc(x.bucket)} ${fmt(x.weight*100)}%</span>`).join('')}</div>`).join('')}<p class="note">Illustrative fund composition. Who owns and refreshes look-through data is an open question.</p></details>`:''}
  <p class="note attr-note">${esc(s.originalNote||'')}</p>
 </div></td></tr>`;
}

function securityGrid(){
 const rows=securityRows();
 if(!rows.length)return `<div class="card empty-state"><strong>No instrument matches these filters</strong><p>Clear the search or the filters to see all ${originalData.securities.length}.</p><button data-security-action="clear">Clear filters</button></div>`;
 // Comparing attributes only means anything within one instrument type, so the
 // type's own columns appear once the list is narrowed to it.
 const typeColumns=securityFilters.instrumentType
  ?((originalData.settings.instrumentTypes||[]).find(t=>t.name===securityFilters.instrumentType)?.attributes||[])
  :[];
 // A filtered column stays visible, as it would in a spreadsheet. Apart from
 // preserving context, this keeps the type filter available so it can be
 // changed or cleared after its type-specific attribute columns appear.
 const showAssetType=true;
 const columnCount=10+typeColumns.length;
 const typeOptions=[...new Set(originalData.securities.map(instrumentType))].sort();
 return `<div class="card tablewrap" style="padding:0"><table class="config-grid${typeColumns.length?' has-attributes':''}"><caption class="sr-only">Firm-wide instrument classification</caption>
 <thead><tr>
  <th scope="col">Name</th><th scope="col">ISIN</th><th scope="col">Symbol</th>
  <th scope="col">Crisil rating</th><th scope="col">Current price</th>${showAssetType?'<th scope="col">Asset type</th>':''}
  <th scope="col" class="col-editable">Asset class</th><th scope="col" class="col-editable">Super sector</th><th scope="col" class="col-editable">Sector</th><th scope="col" class="col-editable">Sub-sector</th>
  ${typeColumns.map(a=>`<th scope="col" class="col-attribute">${esc(a.label)}${a.unit?`<small>${esc(a.unit)}</small>`:''}</th>`).join('')}
 </tr><tr class="config-filter-row">
  <th><label class="config-header-search"><span class="sr-only">Filter instruments</span><input id="securitySearch" type="search" placeholder="Filter rows…" value="${esc(securityFilters.search)}" aria-label="Filter instruments by name, symbol, type or sector"></label><label class="config-header-check"><input id="securityUnclassified" type="checkbox" ${securityFilters.unclassifiedOnly?'checked':''}> Needs classification only</label></th>
  <th aria-label="No ISIN filter"></th><th aria-label="No symbol filter"></th><th aria-label="No rating filter"></th><th aria-label="No price filter"></th>
  ${showAssetType?`<th><label><span class="sr-only">Filter by asset type</span><select id="securityTypeFilter" class="config-header-filter" aria-label="Filter by asset type"><option value="">All</option>${typeOptions.map(t=>`<option ${securityFilters.instrumentType===t?'selected':''}>${esc(t)}</option>`).join('')}</select></label></th>`:''}
  <th class="col-editable"><label><span class="sr-only">Filter by asset class</span><select id="securityClassFilter" class="config-header-filter" aria-label="Filter by asset class"><option value="">All</option>${ASSET_CLASSES.map(c=>`<option ${securityFilters.assetClass===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label></th>
  <th class="col-editable" aria-label="No super sector filter"></th><th class="col-editable" aria-label="No sector filter"></th><th class="col-editable" aria-label="No sub-sector filter"></th>
  ${typeColumns.map(a=>`<th class="col-attribute" aria-label="No ${esc(a.label)} filter"></th>`).join('')}
 </tr></thead><tbody>${rows.map(s=>{
  // A rating the source never supplies is different from one that cannot apply:
  // the instrument type decides which of the two this is.
  const rating=s.crisilRating?`${esc(s.crisilRating)}<small>${esc(s.tags.duration||'')}</small>`
   :s.ratingApplies?'<span class="config-absent" title="This instrument type carries a rating, but none is recorded in the sample">Not rated</span>'
   :'<span class="config-na" title="A credit rating does not apply to this instrument type">n/a</span>';
  const value=securityValue(s.id),count=securityPortfolios(s.id);
  const held=count?`${money(value)} · ${count} ${count===1?'portfolio':'portfolios'}`:'<span class="config-absent" title="In the master, not held by any sample portfolio">Not held</span>';
  return `<tr class="${isUnclassified(s)?'is-unclassified':''}">
   <th scope="row"><button class="attr-toggle" data-security-attributes="${esc(s.id)}" aria-expanded="${securityExpanded.has(s.id)}" aria-label="${securityExpanded.has(s.id)?'Hide':'Show'} ${esc(s.name)} attributes"><span aria-hidden="true">${securityExpanded.has(s.id)?'⌄':'›'}</span></button><strong>${esc(s.name)}</strong><small>${esc(instrumentType(s))}${s.lookThrough?' · looked through':''}</small><small class="config-held">${held}</small></th>
   <td class="config-fixed">${notSupplied}</td>
   <td class="config-fixed">${s.symbol?esc(s.symbol):notSupplied}</td>
   <td class="config-fixed">${rating}</td>
   <td class="config-fixed">${notSupplied}</td>
   ${showAssetType?`<td class="config-fixed">${esc(instrumentType(s))}</td>`:''}
   <td>${classSelect(s)}</td><td>${superSectorSelect(s)}</td><td>${sectorSelect(s)}</td><td>${subsectorSelect(s)}</td>
   ${typeColumns.map(a=>{const value=s.attributes?.[a.key];return `<td class="config-fixed col-attribute">${value===undefined||value===''?notSupplied:formatAttribute({...a,value})}</td>`}).join('')}</tr>`+
   (securityExpanded.has(s.id)?attributePanel(s,columnCount):'');
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
 <p class="muted">Classify each instrument once. Every model and portfolio reads its exposure from here. The four classification levels nest: each offers only what belongs under the level above it.</p>
 <div class="portfolio-metrics">
  <div class="card"><small>Instruments</small><strong>${total}</strong><small>in the firm master</small></div>
  <div class="card"><small>Need classification</small><strong class="${unclassified?'drift-over':''}">${unclassified}</strong><small>missing a level of the classification</small></div>
  <div class="card"><small>Staged changes</small><strong>${pending}</strong><small>not applied yet</small></div>
  <div class="card"><small>Instrument types</small><strong>${new Set(originalData.securities.map(instrumentType)).size}</strong><small>each sets its own attributes</small></div>
 </div>
 <p class="list-caption config-legend"><span class="config-key"><b class="is-fixed">Fixed</b> from the instrument source</span><span class="config-key"><b class="is-editable">Editable</b> your classification</span><span class="config-key"><b class="is-absent">—</b> not supplied by the sample</span><span class="config-key"><b class="is-attr">›</b> open a row for its type's attributes</span><span class="config-count">Showing ${securityRows().length} of ${total}${securityFilters.search||securityFilters.assetClass||securityFilters.instrumentType||securityFilters.unclassifiedOnly?' · <button class="link-button" data-security-action="clear">Clear filters</button>':''}</span></p>
 ${securityAddPanel()}
 ${securityGrid()}
 <p class="note">Super sector, sector and sub-sector feed every exposure view immediately once applied. Asset class also decides whether an instrument is measured by the credit and duration view. Recorded holdings keep the asset class they were recorded under: reclassifying an instrument changes analysis from now on, it does not restate an approved snapshot.</p>
 <details class="card"><summary>What a production security master still needs decided</summary>
  <p class="note" style="margin-top:0">The sheet defines the grid, not these. Each needs a product or adviser decision before this page can be built for real.</p>
  <h3 class="config-open-heading">Questions for an adviser</h3>
  <ul><li>when an adviser records a fixed deposit's rate and maturity, do they expect to type it here or on the client's holding?</li>
  <li>how often are illiquid assets genuinely re-valued — a flat, jewellery, art — and after how long should this page call a valuation stale?</li>
  <li>an investor's AIF commitment and vintage differ per client while the scheme's category and lock-in do not. Is that split right, and where should each live?</li>
  <li>which instrument attributes does an adviser actually read before advising, and which are reference clutter?</li></ul>
  <h3 class="config-open-heading">Questions for the firm</h3>
  <ul><li>shared instruments versus client-specific assets: a named flat, one EPF account and a specific deposit are each owned by one client, yet sit in a firm-wide master;</li>
  <li>who maintains the attributes no feed supplies — AIF lock-in, PMS fees, deposit penalties — and from which document;</li>
  <li>canonical instrument identity and aliases, and which of ISIN, symbol or name is authoritative;</li>
  <li>who owns and refreshes a fund's look-through data, and how stale it may be before exposure analysis stops relying on it;</li>
  <li>who approves a classification, and from what effective date;</li>
  <li>whether a change ever restates history rather than only applying forward.</li></ul></details>`;
 $('footer').innerHTML=pending?`<div class="footer"><div><strong>${pending} staged ${pending===1?'change':'changes'}</strong><small>Nothing is applied until you review it</small></div><div class="flex"><button data-security-action="discard">Discard</button><button class="primary" data-security-action="review">Review & apply →</button></div></div>`:'';
 scrollWorkspace();
};

function securityReview(){
 const entries=Object.entries(securityPending).flatMap(([id,fields])=>{
  const s=originalData.securities.find(x=>x.id===id);
  return Object.entries(fields).map(([field,value])=>({s,field,
   from:field==='assetClass'?s.assetClass:field==='superSector'?s.superSector:s.tags[field],to:value}));
 });
 const touched=[...new Set(entries.map(e=>e.s.id))];
 const value=touched.reduce((sum,id)=>sum+securityValue(id),0);
 const portfolios=new Set();
 for(const id of touched)for(const c of clientRecords)
  if(approved(c).plan.assets.some(a=>a.securityId===id&&a.included))portfolios.add(c.id);
 const label={assetClass:'Asset class',superSector:'Super sector',sector:'Sector',subsector:'Sub-sector'};
 show(`<div class="target-review-dialog"><span class="section-step">Firm-wide change</span><h2>Apply ${entries.length} classification ${entries.length===1?'change':'changes'}</h2>
 <p class="muted">This is not a portfolio edit. It changes how every model and portfolio measures these instruments.</p>
 <div class="review-impact-grid"><div><small>Instruments</small><strong>${touched.length}</strong></div><div><small>Value affected</small><strong>${money(value)}</strong></div><div><small>Portfolios affected</small><strong>${portfolios.size}</strong></div><div><small>Fields changed</small><strong>${entries.length}</strong></div></div>
 <div class="tablewrap"><table><thead><tr><th>Instrument</th><th>Field</th><th>From</th><th>To</th></tr></thead><tbody>
 ${entries.map(e=>`<tr><td>${esc(e.s.name)}</td><td>${esc(label[e.field])}</td><td>${e.from?esc(e.from):'<span class="compare-missing">Not classified</span>'}</td><td><strong>${e.to?esc(e.to):'<span class="compare-missing">Not classified</span>'}</strong></td></tr>`).join('')}
 </tbody></table></div>
 <p class="note">Super sector, sector and sub-sector changes take effect in every exposure view as soon as they are applied. An asset-class change also moves the instrument in or out of the credit and duration view. Approved client targets, recorded holdings and historic snapshots are untouched.</p>
 <div class="actions"><button onclick="closeModal()">Back to the grid</button><button class="primary" data-security-action="apply">Apply firm-wide</button></div></div>`);
}

document.addEventListener('click',e=>{
 const toggle=e.target.closest('button[data-security-attributes]');
 if(toggle){
  const id=toggle.dataset.securityAttributes;
  securityExpanded.has(id)?securityExpanded.delete(id):securityExpanded.add(id);
  securityMasterPage();
  document.querySelector(`[data-security-attributes="${id}"]`)?.focus();
  return;
 }
 const b=e.target.closest('button[data-security-action]');if(!b)return;
 const action=b.dataset.securityAction;
 if(action==='clear'){securityFilters={search:'',assetClass:'',instrumentType:'',unclassifiedOnly:false};securityMasterPage();return}
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
 if(t.id==='securityTypeFilter'){securityFilters.instrumentType=t.value;securityMasterPage();return}
 if(t.id==='securityUnclassified'){securityFilters.unclassifiedOnly=t.checked;securityMasterPage();return}
 const id=t.dataset.security,field=t.dataset.field;
 if(!id||!field)return;
 const s=originalData.securities.find(x=>x.id===id);
 const recorded=field==='assetClass'?s.assetClass:field==='superSector'?s.superSector:s.tags[field];
 securityPending[id]=securityPending[id]||{};
 if((t.value||'')===(recorded||''))delete securityPending[id][field];
 else securityPending[id][field]=t.value;
 // The levels nest, so choosing one clears any level below it that no longer
 // belongs underneath. Clearing to '' is a staged value, not an absent one.
 const below={assetClass:['superSector','sector','subsector'],superSector:['sector','subsector'],sector:['subsector']}[field]||[];
 for(const lower of below){
  const allowed=new Set(lower==='superSector'?superSectorsFor(effectiveField(s,'assetClass'))
   :lower==='sector'?sectorsFor(effectiveField(s,'assetClass'),effectiveField(s,'superSector'))
   :subsectorsFor(effectiveField(s,'assetClass'),effectiveField(s,'superSector'),effectiveField(s,'sector')));
  const value=effectiveField(s,lower);
  if(value&&!allowed.has(value))securityPending[id][lower]='';
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
