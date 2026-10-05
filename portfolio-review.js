'use strict';
// Portfolio review presentation state; model, target and holding records remain independent.
const rowReviewTabs=new Map(),rowReviewShowAll=new Set();
const reviewDomId=id=>'review-'+encodeURIComponent(id);
const reviewHeading=lens=>lenses.find(([key])=>key===lens)?.[1]||lens;
const reviewPercent=n=>n===null?'—':fmt(n)+'%';
function reviewTabsFor(r){return [['allocation','Allocation'],['accounts',r.kind==='Household'?'Accounts':'Account details'],['exposures','Exposure flags']]}
function reviewSummary(r){
  if(r.drift===null)return {title:'Allocation data needs a check',detail:'A reliable comparison is unavailable for the current included holdings.',tone:'muted'};
  const largest=[...r.classes].sort((a,b)=>Math.abs(b.actual-b.target)-Math.abs(a.actual-a.target))[0];
  const delta=largest.actual-largest.target;
  if(!r.flagged)return {title:'Allocations are within the sample review defaults',detail:`Largest asset-class difference: ${largest.name}, ${fmt(Math.abs(delta))} pp ${delta>=0?'above':'below'} target.`,tone:'clear'};
  if(Math.abs(delta)>r.threshold)return {title:`${largest.name} is ${fmt(Math.abs(delta))} pp ${delta>0?'above':'below'} target`,detail:`Largest asset-class difference · ${fmt(r.threshold)} pp review threshold${r.exposureFlags.length?' · '+r.exposureFlags.length+' exposure '+(r.exposureFlags.length===1?'bucket also needs':'buckets also need')+' review':''}.`,tone:'attention'};
  return {title:`${r.exposureFlags.length} exposure ${r.exposureFlags.length===1?'bucket needs':'buckets need'} review`,detail:`Asset-class differences stay within the ${fmt(r.threshold)} pp sample threshold. Check the exposure breakdown for the contributing buckets.`,tone:'attention'};
}
function reviewAllocation(r){return `<div class="review-allocation-header"><h3>Actual against approved target</h3><div class="review-bar-legend"><span><i class="review-key actual"></i>Actual</span><span><i class="review-key is-target"></i>Target</span></div></div><div class="review-allocation-grid"><div class="review-grid-head">Asset class</div><div class="review-grid-head">Allocation · 0–100%</div><div class="review-grid-head align-right">Actual</div><div class="review-grid-head align-right">Target</div><div class="review-grid-head align-right">Difference</div>${r.classes.map(c=>{const gap=c.actual===null?null:c.actual-c.target,flag=gap!==null&&Math.abs(gap)>r.threshold;return `<div class="review-class-name"><strong>${esc(c.name)}</strong>${flag?'<span class="review-small-flag">Outside threshold</span>':''}</div><div class="review-bar-pair" aria-hidden="true"><div class="review-track"><span style="width:${Math.max(0,Math.min(100,c.actual??0))}%"></span></div><div class="review-track review-target-track"><span style="width:${Math.max(0,Math.min(100,c.target))}%"></span></div></div><div class="review-number"><span class="mobile-label">Actual</span>${reviewPercent(c.actual)}</div><div class="review-number"><span class="mobile-label">Target</span>${reviewPercent(c.target)}</div><div class="review-number"><span class="mobile-label">Difference</span><span class="${flag?'difference-flag':''}">${gap===null?'—':pp(gap)}</span></div>`}).join('')}</div><p class="review-footnote">Positive = above target; negative = below. Sample review threshold: ±${fmt(r.threshold)} pp. ${r.kind==='Household'?'Targets combine the accounts below, weighted by value under advice.':'Percentages use the approved assets under advice.'}</p>`}
function reviewAccounts(r){
  if(r.kind!=='Household'){
    const c=r.members[0],p=approved(c).plan;
    return `<h3>Account context</h3><dl class="review-account-context"><div><dt>Ownership type</dt><dd>${esc(c.type)}</dd></div><div><dt>Household</dt><dd><button class="link" data-household="${esc(c.householdId)}">${esc(c.household)} →</button></dd></div><div><dt>Assigned model</dt><dd>${esc(baseRef(p))}</dd></div><div><dt>Under advice</dt><dd>${money(scopeValue(p))}</dd></div></dl><p class="review-footnote">Ownership labels are from the original example; beneficial-owner shares are not supplied.</p>`;
  }
  return `<div class="review-allocation-header"><h3>Accounts in this household</h3><small>Each account counted once</small></div><div class="review-account-list">${r.members.map(c=>{const p=approved(c).plan;return `<button class="review-account-card" data-client="${esc(c.id)}"><span class="review-account-icon" aria-hidden="true">${c.type==='Individual'?'I':c.type==='Joint account'?'J':'A'}</span><span class="review-account-identity"><strong>${esc(c.name)}</strong><small>${esc(c.type)}</small></span><span class="review-account-model"><small>Model</small>${esc(baseRef(p))}</span><span class="review-account-amount"><small>Under advice</small><strong>${money(scopeValue(p))}</strong></span><span aria-hidden="true">→</span></button>`}).join('')}</div>`;
}
function reviewExposures(r){
  const sorted=[...r.exposureFlags].sort((a,b)=>Math.abs(b.drift)-Math.abs(a.drift)||a.name.localeCompare(b.name));
  const all=rowReviewShowAll.has(r.id),visible=all?sorted:sorted.slice(0,4),groups=new Map();
  for(const flag of visible){if(!groups.has(flag.lens))groups.set(flag.lens,[]);groups.get(flag.lens).push(flag)}
  return `<div class="review-allocation-header"><div><h3>Exposure buckets outside the defaults</h3><small>${sorted.length?`Showing ${visible.length} of ${sorted.length} flags · largest differences first`:'No flags for this portfolio'}</small></div><details class="review-method"><summary>Calculated using Look-through <span aria-hidden="true">ⓘ</span></summary><p>Funds are split across the original sample’s underlying exposures. These flags use a consistent Look-through method, independent of display choices elsewhere.</p></details></div>${sorted.length?`<div class="review-exposure-groups">${[...groups].map(([lens,flags])=>`<section class="review-exposure-group"><div class="review-exposure-title"><h4>${esc(reviewHeading(lens))}</h4><small>Sample threshold ±${fmt(originalData.settings.originalLensBands[lens]?.at(-1)||5)} pp${lens==='cr'?' · debt only':lens==='th'?' · themes overlap':''}</small></div><div class="review-exposure-grid"><span class="review-grid-head">Bucket</span><span class="review-grid-head align-right">Actual</span><span class="review-grid-head align-right">Target</span><span class="review-grid-head align-right">Difference</span>${flags.map(x=>`<strong class="review-bucket">${esc(x.name)}</strong><span class="review-number"><span class="mobile-label">Actual</span>${fmt(x.actual)}%</span><span class="review-number"><span class="mobile-label">Target</span>${fmt(x.target)}%</span><span class="review-number"><span class="mobile-label">Difference</span><span class="difference-flag">${pp(x.drift)}</span></span>`).join('')}</div></section>`).join('')}</div>${sorted.length>4?`<button class="review-show-all" data-review-all="${esc(r.id)}" aria-expanded="${all}">${all?'Show fewer flags':'Show all '+sorted.length+' flags'} ${all?'↑':'↓'}</button>`:''}`:'<div class="review-clear-state"><strong>No exposure review flags</strong><p>All measured exposure differences are within the original sample defaults.</p></div>'}<p class="review-footnote">Flags across dimensions can overlap. ${sorted.length||'Multiple'} flags do not necessarily mean ${sorted.length||'multiple'} separate investments. These are prompts to review, not trade instructions.</p>`;
}
function reviewPanel(r){
  const active=rowReviewTabs.get(r.id)||'allocation',summary=reviewSummary(r),id=reviewDomId(r.id),household=r.kind==='Household';
  return `<section class="row-review-panel" aria-label="Review of ${esc(r.name)}"><div class="review-summary ${summary.tone}"><span class="review-summary-icon" aria-hidden="true">${summary.tone==='attention'?'!':summary.tone==='clear'?'✓':'—'}</span><div><div class="eyebrow">Review snapshot</div><h2>${esc(summary.title)}</h2><p>${esc(summary.detail)}</p></div></div><div role="tablist" aria-label="${esc(r.name)} review details" class="row-review-tabs">${reviewTabsFor(r).map(([key,label])=>`<button role="tab" id="${id}-tab-${key}" aria-controls="${id}-content" aria-selected="${active===key}" tabindex="${active===key?'0':'-1'}" data-review-tab="${key}" data-review-record="${esc(r.id)}">${label}${key==='accounts'&&household?`<span>${r.members.length}</span>`:key==='exposures'?`<span>${r.exposureFlags.length}</span>`:''}</button>`).join('')}</div><div role="tabpanel" id="${id}-content" aria-labelledby="${id}-tab-${active}" tabindex="0" class="row-review-content">${active==='allocation'?reviewAllocation(r):active==='accounts'?reviewAccounts(r):reviewExposures(r)}</div><div class="row-review-footer"><small>Approved targets · sample as of ${sourceDate()}</small><button class="review-open" ${household?`data-household="${esc(r.id)}"`:`data-client="${esc(r.id)}"`}>${household?'Open household overview':'Open portfolio'} →</button></div></section>`;
}
dashboardRow=function(r){
  const household=r.kind==='Household',open=dashboardExpanded.has(r.id);
  const row=`<tr class="${open?'review-parent-open':''}"><td><div class="portfolio-name"><button class="chev" data-dashboard-expand="${esc(r.id)}" aria-label="${open?'Hide':'Show'} breakdown for ${esc(r.name)}" aria-expanded="${open}">${open?'⌄':'›'}</button><div><button class="link" ${household?`data-household="${esc(r.id)}"`:`data-client="${esc(r.id)}"`}>${esc(r.name)}</button><small>${household?r.members.length+' '+(r.members.length===1?'account':'accounts'):esc(r.kind)+' · '+esc(r.household)}</small></div></div></td><td>${esc(r.model)}<small>Risk profile: ${esc(r.risk)}</small></td><td class="numeric">${fmt(r.total)}</td><td>${r.drift===null?'Unavailable':fmt(r.drift)+' pp'}</td><td><span class="badge ${r.flagged?'draft':''}">${reviewLabel(r)}</span><button class="review-flags-link" data-review-open="${esc(r.id)}">${r.exposureFlags.length?r.exposureFlags.length+' exposure flags':'No exposure flags'}</button></td></tr>`;
  return row+(open?`<tr class="review-panel-row"><td colspan="5">${reviewPanel(r)}</td></tr>`:'');
};
function activateReviewTab(id,tab,focus=true){rowReviewTabs.set(id,tab);dashboardExpanded.add(id);renderClients();if(focus)$(reviewDomId(id)+'-tab-'+tab)?.focus()}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.reviewTab)activateReviewTab(b.dataset.reviewRecord,b.dataset.reviewTab);
  if(b.dataset.reviewOpen)activateReviewTab(b.dataset.reviewOpen,'exposures');
  if(b.dataset.reviewAll){const id=b.dataset.reviewAll;rowReviewShowAll.has(id)?rowReviewShowAll.delete(id):rowReviewShowAll.add(id);renderReviewSurface();document.querySelector(`[data-review-all="${id}"]`)?.focus()}
});
document.addEventListener('keydown',e=>{
  const b=e.target.closest('[role="tab"][data-review-tab]');if(!b||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  const keys=[...b.parentElement.querySelectorAll('[role="tab"]')].map(t=>t.dataset.reviewTab),index=keys.indexOf(b.dataset.reviewTab);
  const next=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowRight'?1:2))%3;
  e.preventDefault();activateReviewTab(b.dataset.reviewRecord,keys[next]);
});

'use strict';
let reviewHouseholdId=null;
function reviewRecord(id){const previous=clientView;try{clientView=id.startsWith('h')?'households':'accounts';return dashboardRecords().find(r=>r.id===id)}finally{clientView=previous}}
function detailSummary(r){const s=reviewSummary(r);return `<section class="detail-review-summary review-summary ${s.tone}"><span class="review-summary-icon" aria-hidden="true">${s.tone==='attention'?'!':s.tone==='clear'?'✓':'—'}</span><div><div class="eyebrow">Review snapshot</div><h2>${esc(s.title)}</h2><p>${esc(s.detail)}</p></div></section>`}
function quickReview(r){const s=reviewSummary(r),household=r.kind==='Household';return `<section id="${reviewDomId(r.id)}-quick" class="quick-review" aria-label="Quick review of ${esc(r.name)}"><div class="quick-review-copy"><span class="eyebrow">Quick review</span><h3>${esc(s.title)}</h3><p>${r.exposureFlags.length} exposure flags${household?' · '+r.members.length+' accounts':''} · ${esc(s.tone==='clear'?'Within sample defaults':'Review details before considering any action')}</p></div><div class="quick-review-actions"><button class="quiet" data-review-detail="${esc(r.id)}">${household?'Review household':'Review portfolio'} →</button></div></section>`}
dashboardRow=function(r){
 const household=r.kind==='Household',open=dashboardExpanded.has(r.id),label=open?'Hide review':'Quick review';
 return `<tr class="${open?'review-parent-open':''}"><td><div class="portfolio-name"><button class="chev" id="${reviewDomId(r.id)}-toggle" data-quick-toggle="${esc(r.id)}" aria-label="${open?'Collapse':'Expand'} ${esc(r.name)}" aria-expanded="${open}"><span aria-hidden="true">${open?'⌄':'›'}</span></button><div><button class="link" ${household?`data-household="${esc(r.id)}"`:`data-client="${esc(r.id)}"`}>${esc(r.name)}</button><small>${household?r.members.length+' '+(r.members.length===1?'account':'accounts'):esc(r.kind)+' · '+esc(r.household)}</small></div></div></td><td>${esc(r.model)}<small>Risk profile: ${esc(r.risk)}</small></td><td class="numeric">${fmt(r.total)}</td><td>${driftBar(r)}</td><td>${thresholdInput(r)}</td><td><span class="badge ${r.flagged?'draft':''}">${reviewLabel(r)}</span><button class="review-flags-link" data-review-open="${esc(r.id)}">${r.exposureFlags.length?r.exposureFlags.length+' exposure flags':'No exposure flags'}</button></td></tr>${open?`<tr class="review-panel-row quick-review-row"><td colspan="6">${quickReview(r)}</td></tr>`:''}`;
};
const previewClientNav=clientNav,previewOpenClient=openClient,previewRenderClient=renderClient;
clientNav=function(){reviewHouseholdId=null;previewClientNav()};
openClient=function(id){reviewHouseholdId=null;previewOpenClient(id)};
function reviewFullExposures(r,context,opened=false){return `${reviewExposures(r)}<details class="all-exposures" ${opened?'open':''}><summary>Explore all exposure buckets</summary><p class="muted">Include buckets within the defaults and explore different classification views.</p><div class="analysis-toolbar"><label>Lens <select id="${context==='household'?'householdLens':'portfolioLens'}">${lenses.filter(([key])=>key!=='ac').map(([key,label])=>`<option value="${key}" ${activeLens===key?'selected':''}>${label}</option>`).join('')}</select></label>${['sec','mc','geo','tree'].includes(activeLens)?`<label>Funds and ETFs <select id="${context==='household'?'householdFundMode':'portfolioFundMode'}"><option value="look" ${fundMode==='look'?'selected':''}>Look-through</option><option value="tag" ${fundMode==='tag'?'selected':''}>Single tag</option></select></label>`:''}</div>${lensContent(r.actual,r.target)}</details>`}
renderClient=function(){
 const opened=!!document.querySelector('.all-exposures')?.open;
 previewRenderClient();if(portfolioArea!=='allocation')return;
 const r=reviewRecord(activeClient),chart=document.querySelector('.distribution-card'),section=document.querySelector('.allocation-section');
 chart.insertAdjacentHTML('beforebegin',detailSummary(r));
 if(activeLens!=='ac')section.innerHTML=`<h2>Allocation review</h2><div class="analysis-toolbar"><div class="segmented" role="group" aria-label="Allocation view"><button data-lens="ac" data-context="portfolio" aria-pressed="false">Asset allocation</button><button data-workspace="exposures" aria-pressed="true">Exposure analysis</button></div></div>${reviewFullExposures(r,'account',opened)}`;
};
householdPage=function(id){
 leaveModels();clientEditing=false;activeClient=null;reviewHouseholdId=id;comparisonState.active=false;navState('portfolios');
 const r=reviewRecord(id),tab=rowReviewTabs.get(id)||'allocation';if(tab==='exposures'&&activeLens==='ac')activeLens='sec';
 const opened=!!document.querySelector('.all-exposures')?.open,dom=reviewDomId(id);
 $('footer').innerHTML='';$('app').innerHTML=`<button class="quiet" data-action="back">← All portfolios</button><div class="portfolio-heading"><div><div class="eyebrow">Household portfolio</div><h1>${esc(r.name)}</h1><p class="muted">${r.members.length} accounts · ${money(r.total)} under advice · Risk label: ${esc(r.risk)}</p></div><span class="source-stamp">Illustrative data · ${sourceDate()}</span></div>${detailSummary(r)}<div role="tablist" aria-label="Household review" class="row-review-tabs household-review-tabs">${[['allocation','Asset allocation'],['exposures','Exposure analysis'],['accounts','Accounts · '+r.members.length]].map(([key,label])=>`<button role="tab" id="${dom}-tab-${key}" data-review-record="${esc(id)}" data-review-tab="${key}" aria-controls="${dom}-detail" aria-selected="${tab===key}" tabindex="${tab===key?'0':'-1'}">${label}</button>`).join('')}</div><section class="card household-review-content" role="tabpanel" id="${dom}-detail" aria-labelledby="${dom}-tab-${tab}">${tab==='allocation'?distribution(r.actual,r.target,'Combined client targets'):tab==='accounts'?reviewAccounts(r):reviewFullExposures(r,'household',opened)}</section><p class="note">This household combines approved account targets, weighted by value under advice. It does not have a separate target or approval. Open an account to edit its Target plan, view Planning or inspect History.</p>`;
};
function openReviewDetail(id,tab='allocation'){
 if(id.startsWith('h')){rowReviewTabs.set(id,tab);householdPage(id)}else{openClient(id);if(tab==='exposures'){activeLens='sec';renderClient()}}
 scrollWorkspace();
}
activateReviewTab=function(id,tab,focus=true){
 if(reviewHouseholdId===id){rowReviewTabs.set(id,tab);householdPage(id);if(focus)$(reviewDomId(id)+'-tab-'+tab)?.focus()}
 else openReviewDetail(id,tab);
};
function renderReviewSurface(){if(reviewHouseholdId)householdPage(reviewHouseholdId);else if(activeClient)renderClient();else renderClients()}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.quickToggle){const id=b.dataset.quickToggle;dashboardExpanded.has(id)?dashboardExpanded.delete(id):dashboardExpanded.add(id);renderClients();$(reviewDomId(id)+'-toggle')?.focus()}
 if(b.dataset.reviewDetail)openReviewDetail(b.dataset.reviewDetail);
});
document.addEventListener('change',e=>{
 if(e.target.id==='householdLens'){activeLens=e.target.value;householdPage(reviewHouseholdId)}
 if(e.target.id==='householdFundMode'){fundMode=e.target.value;householdPage(reviewHouseholdId)}
});

'use strict';
const REVIEW_RULES_KEY='portfolio-review-rules-v1';
const initialReviewRules=()=>({firm:originalData.settings.firmThresholdPP,overrides:Object.fromEntries([...originalData.households,...originalData.accounts].filter(r=>r.originalThresholdPP!=null).map(r=>[r.id,r.originalThresholdPP]))});
function validThreshold(value){return Number.isFinite(value)&&value>=0.5&&Math.abs(value*2-Math.round(value*2))<1e-8}
let reviewRules=initialReviewRules(),reviewRulesSaved=true;
try{const saved=JSON.parse(localStorage.getItem(REVIEW_RULES_KEY)||'null');if(saved&&validThreshold(saved.firm)&&saved.overrides&&Object.values(saved.overrides).every(validThreshold))reviewRules=saved}catch{reviewRulesSaved=false}
function saveReviewRules(){try{localStorage.setItem(REVIEW_RULES_KEY,JSON.stringify(reviewRules));reviewRulesSaved=true}catch{reviewRulesSaved=false}}
const recordsBeforeReviewRules=dashboardRecords;
dashboardRecords=function(){return recordsBeforeReviewRules().map(r=>{const threshold=reviewRules.overrides[r.id]??reviewRules.firm;return {...r,threshold,flagged:r.drift!==null&&(r.drift>threshold||r.exposureFlags.length>0)}})};
function driftBar(r){if(r.drift===null)return 'Unavailable';const breach=r.drift>r.threshold,width=Math.min(100,r.drift/(r.threshold*2)*100);return `<div class="aggregated-drift"><span class="threshold-bar ${breach?'over':''}" role="img" aria-label="Aggregated drift ${fmt(r.drift)} pp; threshold ${fmt(r.threshold)} pp; ${breach?'above':'within'} threshold" title="Midline = ${fmt(r.threshold)} pp threshold"><span style="width:${width}%"></span><i aria-hidden="true"></i></span><strong class="${breach?'drift-over':''}">${fmt(r.drift)}</strong></div>`}
function thresholdInput(r){const override=reviewRules.overrides[r.id];return `<input class="threshold-input" id="threshold-${esc(r.id)}" data-review-threshold="${esc(r.id)}" type="number" min="0.5" step="0.5" value="${override??''}" placeholder="${reviewRules.firm}" aria-label="Threshold for ${esc(r.name)}" aria-describedby="threshold-hint-${esc(r.id)}"><small id="threshold-hint-${esc(r.id)}">${override==null?'Firm default · '+fmt(reviewRules.firm)+' pp':'Portfolio override'}</small><small id="threshold-error-${esc(r.id)}" class="errors" role="alert"></small>`}
const renderBeforeRules=renderClients;
renderClients=function(){
 renderBeforeRules();
 $('app').innerHTML=$('app').innerHTML.replace('Max drift ↕','Aggregated drift (pp) ↕').replace('<th>Attention</th>','<th>Threshold (pp)</th><th>Attention</th>').replace('colspan="5"','colspan="6"').replace('Max drift is','Aggregated drift is').replace('Review flags use the original illustrative thresholds and Look-through exposure method.','Review flags use the effective portfolio threshold and the original Look-through exposure defaults.');
 document.querySelector('.overview-card .tablewrap').insertAdjacentHTML('beforebegin',`<details class="threshold-rules"><summary>Review rules · firm default ${fmt(reviewRules.firm)} pp</summary><label>Firm default threshold (pp) <input id="firmReviewThreshold" class="threshold-input" type="number" min="0.5" step="0.5" value="${reviewRules.firm}"></label><small id="firm-threshold-error" class="errors" role="alert"></small><p>Blank portfolio inputs inherit this default. Explicit overrides stay unchanged when the default changes. Household and account thresholds are independent.</p></details>`);
 document.querySelector('.overview-card').insertAdjacentHTML('beforeend',`<p class="drift-explanation">Aggregated drift is the largest absolute drift in any asset class. The bar’s midpoint is that portfolio’s threshold; its end is twice the threshold. Bars are threshold-relative, not absolute comparisons. <strong>Blank threshold = firm default (${fmt(reviewRules.firm)} pp).</strong> Exposure flags can still require review when this bar is within threshold.</p><p class="rules-storage">${reviewRulesSaved?'Rule changes are saved locally in this preview.':'Local saving unavailable; rule changes last for this session only.'} Targets and holdings are unchanged.</p>`);
};
document.addEventListener('change',e=>{
 const input=e.target,id=input.dataset.reviewThreshold,isFirm=input.id==='firmReviewThreshold';if(!id&&!isFirm)return;
 const raw=input.value.trim(),value=Number(raw),blank=raw===''&&!input.validity.badInput;
 const error=$(isFirm?'firm-threshold-error':'threshold-error-'+id);
 if((isFirm&&blank)||input.validity.badInput||(!blank&&!validThreshold(value))){input.setAttribute('aria-invalid','true');error.textContent='Enter at least 0.5 pp in steps of 0.5'+(isFirm?'.':', or leave blank to use the firm default.');return}
 if(isFirm)reviewRules.firm=value;else if(blank)delete reviewRules.overrides[id];else reviewRules.overrides[id]=value;
 saveReviewRules();renderClients();if(isFirm){document.querySelector('.threshold-rules').open=true;$('firmReviewThreshold').focus()}else $('threshold-'+id)?.focus();
});
