'use strict';
// Audit log, Security master placeholder and the remaining portfolio-detail
// context required by the refinement plan. Records themselves are unchanged.

// --- Activity feed -------------------------------------------------------
const auditFilters={from:'',to:'',actor:'',object:'',action:'',status:''};
const ACTION_TYPES=[['model','Model published'],['target','Client target approved']];
// Local calendar date; toISOString() would shift an IST date back a day.
const isoOf=value=>{const d=new Date(value);if(Number.isNaN(d.valueOf()))return null;
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};

function activityEvents(){
 const events=[];
 for(const m of models){
  const versions=m.versions||[];
  versions.forEach((v,i)=>{
   events.push({kind:'model',action:'Model published',object:v.data.name,objectId:m.id,
    date:isoOf(v.date)||v.date,sortKey:isoOf(v.date)||'',actor:'Not recorded',
    status:i===versions.length-1&&!m.draft?'Current':'Superseded',
    reason:v.reason||'No reason recorded',revision:v.number,
    detail:()=>`<div class="tablewrap"><table><thead><tr><th>Allocation / field</th><th>Before</th><th>After</th></tr></thead><tbody>${i?changes(versions[i-1].data,v.data):'<tr><td colspan="3">First published snapshot.</td></tr>'}</tbody></table></div>`});
  });
  if(m.draft)events.push({kind:'model',action:'Model draft open',object:m.draft.name||'Untitled model',objectId:m.id,
   date:'—',sortKey:'',actor:originalData.audit.user,status:'Draft',reason:'Not published; approved client targets are unaffected.',
   detail:()=>'<p class="muted">A draft is open on this model. It has no effect until it is published.</p>'});
 }
 for(const c of clientRecords){
  (c.history||[]).forEach((h,i)=>{
   const previous=c.history[i-1];
   events.push({kind:'target',action:'Client target approved',object:c.name,objectId:c.id,household:c.household,
    date:h.effectiveDate,sortKey:isoOf(h.approvedAt)||h.effectiveDate||'',actor:h.approver||'Not recorded',
    status:i===c.history.length-1?'In force':'Superseded',reason:h.reason||'No reason recorded',revision:h.number,
    model:h.plan.base.name,
    detail:()=>`<dl class="audit-facts"><div><dt>Model</dt><dd>${esc(h.plan.base.name)}</dd></div><div><dt>Value under advice</dt><dd>${money(scopeValue(h.plan))}</dd></div><div><dt>Approved at</dt><dd>${esc(h.approvedAt||'Not recorded')}</dd></div></dl><div class="tablewrap"><table><thead><tr><th>Allocation</th><th>Before</th><th>After</th></tr></thead><tbody>${previous?changes(effective(previous.plan),effective(h.plan)):'<tr><td colspan="3">First approved snapshot.</td></tr>'}</tbody></table></div>${previous?scopeChanges(previous.plan,h.plan):''}`});
  });
  if(c.draft)events.push({kind:'target',action:'Target draft saved',object:c.name,objectId:c.id,household:c.household,
   date:'—',sortKey:'',actor:originalData.audit.user,status:'Draft',reason:'Not approved; allocation still compares against the approved target.',
   model:c.draft.base.name,detail:()=>'<p class="muted">A target draft is saved for this portfolio. It changes nothing until it is approved.</p>'});
 }
 return events.sort((a,b)=>(b.sortKey||'').localeCompare(a.sortKey||'')||a.object.localeCompare(b.object));
}
function filteredEvents(){
 const f=auditFilters;
 return activityEvents().filter(e=>{
  if(f.action&&e.kind!==f.action)return false;
  if(f.status&&e.status!==f.status)return false;
  if(f.actor&&e.actor!==f.actor)return false;
  if(f.object&&!((e.object+' '+(e.household||'')+' '+(e.model||'')).toLowerCase().includes(f.object.toLowerCase())))return false;
  const day=e.sortKey;
  if(f.from&&(!day||day<f.from))return false;
  if(f.to&&(!day||day>f.to))return false;
  return true;
 });
}
const auditOpen=new Set();
function auditEntry(e,index){
 const id='audit-'+index,open=auditOpen.has(id);
 return `<details class="card audit-entry" ${open?'open':''} data-audit="${id}"><summary><span class="audit-when">${esc(e.date)}</span><span class="audit-action">${esc(e.action)}</span><strong>${esc(e.object)}</strong><span class="audit-meta">${esc(e.actor)}${e.revision?' · revision '+e.revision:''}</span><span class="state-pill ${e.status==='Draft'?'none':e.status==='Superseded'?'under':'ok'}">${esc(e.status)}</span></summary><p class="audit-reason">${esc(e.reason)}</p>${e.detail()}<p class="audit-open"><button class="quiet" ${e.kind==='model'?`data-open-model="${esc(e.objectId)}"`:`data-client="${esc(e.objectId)}"`}>Open ${e.kind==='model'?'model':'portfolio'} →</button></p></details>`;
}
auditPage=function(){
 leaveModels();clientEditing=false;activeClient=null;
 if(typeof profileComparing!=='undefined')profileComparing=false;
 comparisonState.active=false;navState('history');$('footer').innerHTML='';
 const all=activityEvents(),shown=filteredEvents();
 const actors=[...new Set(all.map(e=>e.actor))].sort();
 const statuses=[...new Set(all.map(e=>e.status))].sort();
 let earlier=[];try{earlier=JSON.parse(localStorage.getItem('portfolio-client-targets-v1')||'[]')}catch{}
 $('app').innerHTML=`<div class="eyebrow">Audit trail</div><h1>Audit log</h1><p class="muted">Every model publication and client target approval, newest first. Opening an entry shows what changed, who decided it and why.</p>
 <section class="card audit-filters"><div class="audit-filter-grid">
  <label class="search-field">Portfolio, household or model<input id="auditObject" type="search" placeholder="Search" value="${esc(auditFilters.object)}"></label>
  <label class="search-field">Action<select id="auditAction"><option value="">All actions</option>${ACTION_TYPES.map(([k,l])=>`<option value="${k}" ${auditFilters.action===k?'selected':''}>${l}</option>`).join('')}</select></label>
  <label class="search-field">Actor<select id="auditActor"><option value="">All actors</option>${actors.map(a=>`<option ${auditFilters.actor===a?'selected':''}>${esc(a)}</option>`).join('')}</select></label>
  <label class="search-field">Status<select id="auditStatus"><option value="">All statuses</option>${statuses.map(a=>`<option ${auditFilters.status===a?'selected':''}>${esc(a)}</option>`).join('')}</select></label>
  <label class="search-field">From<input id="auditFrom" type="date" value="${esc(auditFilters.from)}"></label>
  <label class="search-field">To<input id="auditTo" type="date" value="${esc(auditFilters.to)}"></label>
 </div><div class="flex between audit-count"><span>Showing ${shown.length} of ${all.length} ${all.length===1?'entry':'entries'}</span><button data-audit-clear>Clear filters</button></div></section>
 ${shown.length?shown.map(auditEntry).join(''):`<section class="card empty-state"><strong>No activity matches these filters</strong><p>Widen the date range or clear the filters to see all ${all.length} entries.</p><button data-audit-clear>Clear filters</button></section>`}
 ${earlier.length?`<details class="card"><summary>Earlier prototype examples · ${earlier.length} records retained</summary><p>These invented examples were replaced in the portfolio list by the original sample accounts. Their saved drafts and approvals remain readable here.</p>${earlier.map(c=>`<details class="history"><summary>${esc(c.name)}</summary>${historyMarkup(c)}</details>`).join('')}</details>`:''}
 <p class="note">Entries are reconstructed from the records this prototype holds. Where the original sample never recorded an actor or timestamp, the entry says so rather than inventing one.</p>`;
 scrollWorkspace();
};
document.addEventListener('input',e=>{
 if(e.target.id!=='auditObject')return;
 const position=e.target.selectionStart;auditFilters.object=e.target.value;auditPage();
 const input=$('auditObject');input.focus();input.setSelectionRange(position,position);
});
document.addEventListener('change',e=>{
 const map={auditAction:'action',auditActor:'actor',auditStatus:'status',auditFrom:'from',auditTo:'to'};
 const key=map[e.target.id];if(!key)return;auditFilters[key]=e.target.value;auditPage();
});
document.addEventListener('click',e=>{
 if(e.target.closest('button[data-audit-clear]')){Object.keys(auditFilters).forEach(k=>auditFilters[k]='');auditPage()}
});
document.addEventListener('toggle',e=>{
 const d=e.target.closest?.('details[data-audit]');if(!d)return;
 d.open?auditOpen.add(d.dataset.audit):auditOpen.delete(d.dataset.audit);
},true);

// --- Security master: named placeholder, not a redesign (plan 14) --------
let securityMasterOpen=false;
function securityMasterPage(){
 leaveModels();clientEditing=false;activeClient=null;securityMasterOpen=true;
 if(typeof profileComparing!=='undefined')profileComparing=false;
 comparisonState.active=false;$('footer').innerHTML='';
 for(const id of ['navClients','navModels','navAudit'])$(id).setAttribute('aria-current','false');
 $('navSecurity').setAttribute('aria-current','page');
 document.title='Portfolio Console · Security master';
 const unclassified=originalData.securities.filter(s=>!s.tags.sector||!s.tags.subsector||!s.tags.marketCap||!s.tags.geography).length;
 $('app').innerHTML=`<div class="eyebrow">Separate design discussion · not yet implemented</div><h1>Security master</h1>
 <p class="muted">Classify each instrument once, firm-wide, so every model and portfolio reads the same exposure.</p>
 <section class="card"><h2>What the original mockup did here</h2>
  <ul><li>Group all ${originalData.securities.length} instruments by sector, theme, market cap, geography, credit &amp; duration or a renameable custom lens.</li>
  <li>Show value held firm-wide and share of firm AUM for each bucket.</li>
  <li>Edit sector, sub-sector, market cap, geography, themes, credit quality, duration and custom tag in a side panel.</li>
  <li>Filter to unclassified instruments only, and show fund look-through read-only.</li>
  <li>Apply a classification change to every portfolio immediately.</li></ul>
  <div class="scope-summary"><div><small>Instruments in the sample</small><strong>${originalData.securities.length}</strong></div><div><small>Missing a classification</small><strong>${unclassified}</strong></div><div><small>Custom lens</small><strong>${esc(originalData.settings.customLensName)}</strong></div></div>
  <p class="note">The classification data is preserved and already drives every exposure view. It is readable today on any holding, through <strong>1 Drill-down allocation → a holding</strong>.</p></section>
 <section class="card"><h2>Why it is not designed yet</h2>
  <p>Editing classification firm-wide changes historic and current analytics for every portfolio at once, so it needs its own product decision first:</p>
  <ul><li>shared instruments versus client-specific assets, such as a named flat or one EPF account;</li>
  <li>canonical instrument identity and aliases;</li>
  <li>investment vehicle versus economic exposure;</li>
  <li>who owns and approves a classification, and from what effective date;</li>
  <li>fund and ETF underlying holdings, their source and staleness;</li>
  <li>whether a change reclassifies history or only applies going forward.</li></ul>
  <p class="note">Until those are settled, this area is deliberately left undesigned rather than changed as a side effect of portfolio work.</p></section>`;
 scrollWorkspace();
}
(function addSecurityNav(){
 const nav=document.querySelector('header nav');
 if(!nav||$('navSecurity'))return;
 nav.insertAdjacentHTML('beforeend',' <button id="navSecurity">Security master</button>');
 $('navSecurity').addEventListener('click',()=>securityMasterPage());
})();
for(const [name,fn] of [['clientNav',clientNav],['modelNav',modelNav],['auditPage',auditPage]]){
 const base=fn;
 globalThis[name]=function(...args){securityMasterOpen=false;$('navSecurity')?.setAttribute('aria-current','false');return base.apply(this,args)};
}

// --- Client/account context (plan 9.3) ----------------------------------
// Derived from records the sample actually holds. Anything the original never
// captured says so instead of being inferred from the allocation.
function liquidityProfile(p){
 const buckets={Liquid:0,'Semi-liquid':0,Locked:0,Unclassified:0};
 for(const a of p.assets){
  if(!a.included)continue;
  const s=originalData.securities.find(x=>x.name===a.name);
  buckets[s?.liquidity&&buckets[s.liquidity]!==undefined?s.liquidity:'Unclassified']+=a.value;
 }
 const total=Object.values(buckets).reduce((x,y)=>x+y,0);
 return {buckets,total,restricted:buckets['Semi-liquid']+buckets.Locked};
}
function restrictionList(p){
 return p.assets.filter(a=>a.included).map(a=>originalData.securities.find(x=>x.name===a.name))
  .filter(s=>s&&s.liquidity&&s.liquidity!=='Liquid')
  .map(s=>({name:s.name,liquidity:s.liquidity,note:s.originalNote}));
}
function contextDetail(p){
 const l=liquidityProfile(p),r=restrictionList(p),a=targetPlanApproved();
 const pct=v=>l.total?fmt(v/l.total*100)+'%':'—';
 return `<section class="card context-card"><div class="target-section-heading"><div><span class="section-step">Account context</span><h2>What this target has to work with</h2><p>Read-only. Assessment, goals and restrictions belong to the client record, not to this screen.</p></div></div>
 <dl class="context-grid">
  <div><dt>Assessed risk profile</dt><dd>${esc(client().risk)}</dd><dd class="context-sub">Assessment date not supplied by the original sample</dd></div>
  <div><dt>Goals</dt><dd><span class="compare-missing">Not supplied</span></dd><dd class="context-sub">No goal record exists in the sample</dd></div>
  <div><dt>Time horizon</dt><dd><span class="compare-missing">Not supplied</span></dd><dd class="context-sub">Not captured per account</dd></div>
  <div><dt>Current approved target</dt><dd>Revision ${a.number} · ${esc(a.effectiveDate)}</dd><dd class="context-sub">${esc(a.approver)}</dd></div>
 </dl>
 <h3 class="context-heading">Liquidity of the value under advice</h3>
 <div class="liquidity-bar" role="img" aria-label="Liquid ${pct(l.buckets.Liquid)}, semi-liquid ${pct(l.buckets['Semi-liquid'])}, locked ${pct(l.buckets.Locked)}">
  ${['Liquid','Semi-liquid','Locked','Unclassified'].map(k=>l.buckets[k]?`<span class="liq-${k.toLowerCase().replace(/[^a-z]/g,'')}" style="width:${l.buckets[k]/l.total*100}%" title="${k} ${pct(l.buckets[k])}"></span>`:'').join('')}
 </div>
 <div class="liquidity-legend">${['Liquid','Semi-liquid','Locked','Unclassified'].filter(k=>l.buckets[k]).map(k=>`<span><i class="liq-${k.toLowerCase().replace(/[^a-z]/g,'')}"></i>${k} ${money(l.buckets[k])} · ${pct(l.buckets[k])}</span>`).join('')}</div>
 <p class="chart-key">${money(l.restricted)} of ${money(l.total)} under advice is semi-liquid or locked. Those assets still count in the allocation comparison; they are simply not freely available to trade against a gap.</p>
 ${r.length?`<details class="context-restrictions"><summary>Known restrictions · ${r.length}</summary><ul>${r.map(x=>`<li><strong>${esc(x.name)}</strong> <span class="holding-tag ${x.liquidity==='Locked'?'locked':'semi'}">${esc(x.liquidity)}</span><br><small>${esc(x.note||'No note recorded')}</small></li>`).join('')}</ul><p class="chart-key">Notes are the original mockup's illustrative text, not verified terms.</p></details>`:'<p class="chart-key">No restricted holdings recorded.</p>'}
 </section>`;
}

// --- Model update: three explicit choices (plan 9.4) --------------------
function modelUpdatePanel(c){
 if(!newer(c))return '';
 const p=approved(c).plan,m=models.find(x=>x.id===p.base.modelId),v=latest(m);
 return `<section class="card model-update"><div class="target-section-heading"><div><span class="section-step">Model update available</span><h2>${esc(v.data.name)} has been republished</h2><p>The approved client target is unchanged and stays in force until a revised target is approved. Nothing happens automatically.</p></div></div>
 <div class="model-update-choices">
  <button data-model-update="keep"><strong>Keep the current approved target</strong><small>Take no action. The update is recorded in the Audit log.</small></button>
  <button data-model-update="review"><strong>Review the newer model in context</strong><small>See what changed against this portfolio's approved target, without starting a draft.</small></button>
  <button class="primary" data-model-update="draft"><strong>Start a revised target draft</strong><small>Open a draft using the newer model. Still needs review and approval.</small></button>
 </div></section>`;
}
function reviewModelUpdate(c){
 const p=approved(c).plan,m=models.find(x=>x.id===p.base.modelId),v=latest(m);
 show(`<div class="target-review-dialog"><span class="section-step">Model update · review only</span><h2>${esc(v.data.name)} against this approved target</h2>
 <p class="muted">${esc(c.name)} · nothing here changes the approved target. Starting a draft is a separate, explicit action.</p>
 <div class="tablewrap"><table><thead><tr><th>Allocation</th><th>Approved client target</th><th>Newer model</th></tr></thead><tbody>${changes(effective(p),v.data)}</tbody></table></div>
 <p class="note">Client adjustments on this portfolio are kept by allocation path if you later start a draft. Any adjustment whose path no longer exists in the newer model blocks approval until it is resolved.</p>
 <div class="actions"><button onclick="closeModal()">Keep current approved target</button><button class="primary" data-model-update="draft">Start a revised target draft</button></div></div>`);
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button[data-model-update]');if(!b||!activeClient)return;
 const c=client(),choice=b.dataset.modelUpdate;
 closeModal();
 if(choice==='keep'){notify('Current approved target kept. The model update remains available.');return}
 if(choice==='review'){reviewModelUpdate(c);return}
 portfolioArea='target';editClient();notify('Draft started from the newer model. It is not approved yet.');
});

// Insert context and the model-update panel into the client target screen,
// and drop the old one-line notice that offered no choice.
const targetContentBeforeContext=targetPlanContent;
targetPlanContent=function(p){
 const html=targetContentBeforeContext(p);
 return html
  .replace('${targetDistribution(p)}','')
  .replace(targetPlanStatus(p),targetPlanStatus(p)+modelUpdatePanel(client()))
  .replace(targetModelSection(p),contextDetail(p)+targetModelSection(p));
};
const renderClientBeforeContext=renderClient;
renderClient=function(){
 renderClientBeforeContext();
 const old=[...document.querySelectorAll('main > .note.warning')].find(n=>/Model changes available/.test(n.textContent));
 if(old)old.remove();
 // Choosing a distribution inside Allocation is a deliberate move into the
 // bucket explorer, so open it rather than leaving it collapsed.
 if(portfolioArea!=='allocation'||activeLens==='ac')return;
 const details=document.querySelector('.all-exposures');
 if(!details)return;
 details.open=true;
 details.classList.add('is-primary');
 const summary=details.querySelector('summary');
 if(summary)summary.textContent='All exposure buckets, by lens';
};

// --- Review rules: exposure flags may be excluded, as in the original ----
let exposureTriggersReview=true;
try{const saved=localStorage.getItem('portfolio-exposure-trigger');if(saved!==null)exposureTriggersReview=saved==='true'}catch{}
const recordsBeforeExposureToggle=dashboardRecords;
dashboardRecords=function(){
 return recordsBeforeExposureToggle().map(r=>({...r,
  flagged:r.drift!==null&&(r.drift>r.threshold||(exposureTriggersReview&&r.exposureFlags.length>0))}));
};
const renderClientsBeforeToggle=renderClients;
renderClients=function(){
 renderClientsBeforeToggle();
 document.querySelector('.threshold-rules p')?.insertAdjacentHTML('beforebegin',
  `<label class="check-filter rules-toggle"><input id="exposureTrigger" type="checkbox" ${exposureTriggersReview?'checked':''}> Exposure flags also require review</label>
   <p class="rules-note">${exposureTriggersReview?'A portfolio is flagged when asset-class drift passes its threshold <strong>or</strong> any exposure bucket is outside its limit.':'Only asset-class drift flags a portfolio. Exposure buckets are still measured and listed, but do not set the review state.'}</p>`);
};
document.addEventListener('change',e=>{
 if(e.target.id!=='exposureTrigger')return;
 exposureTriggersReview=e.target.checked;
 try{localStorage.setItem('portfolio-exposure-trigger',String(exposureTriggersReview))}catch{}
 renderClients();document.querySelector('.threshold-rules').open=true;$('exposureTrigger').focus();
});

// --- Holding dialog: lead with position against the client target -------
const showHoldingBeforePosition=showHolding;
showHolding=function(id){
 showHoldingBeforePosition(id);
 if(!activeClient)return;
 const p=approved(client()).plan,asset=p.assets.find(a=>a.id===id);
 if(!asset)return;
 const total=scopeValue(p),row=alignedPortfolioRows(p).find(x=>!x.children&&x.names.at(-1)===asset.name);
 const percent=total?asset.value/total*100:null,target=row?row.values[1]:null;
 const drift=target===null||percent===null?null:percent-target;
 const gap=target===null||percent===null?null:total*target/100-asset.value;
 const state=drift===null?null:allocationState(drift,2,activeClient);
 const modal=$('modal'),anchor=modal.querySelector('p');
 anchor?.insertAdjacentHTML('afterend',
  `<h3 class="holding-heading">Position vs client target</h3><div class="tablewrap"><table><tbody>
   <tr><th>Value</th><td class="numeric">${money(asset.value)}</td></tr>
   <tr><th>Share of value under advice</th><td class="numeric">${percent===null?'—':fmt(percent)+'%'}</td></tr>
   <tr><th>Client target</th><td class="numeric">${target===null?'Not specified':fmt(target)+'%'}</td></tr>
   <tr><th>Drift</th><td class="numeric">${drift===null?'—':signed(drift)+' pp'}</td></tr>
   <tr><th>Value gap</th><td class="numeric">${gap===null?'—':signed(gap)+' L'}</td></tr>
   <tr><th>Review state</th><td>${state?`<span class="state-pill ${state.tone}">${state.label}</span>`:'—'}</td></tr>
  </tbody></table></div>
  <p class="chart-key">A value gap is the distance to target in rupees. It is not a suggested trade, and this holding's liquidity may prevent one.</p>
  <h3 class="holding-heading">Cost and tax · illustrative</h3>`);
};
