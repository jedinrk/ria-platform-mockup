'use strict';
// The household detail page.
//
// A household is a portfolio. It holds securities, it drifts, it has a balance
// sheet and a financial plan. The revised mockup makes that literal — households
// and accounts run through one detail page and differ only in wording — so a
// household gets the same five numbered work areas an account has, reusing the
// same screens rather than reimplementing them.
//
// Two of those screens were household screens all along. Income, liabilities and
// recurring needs are held per household, which is why the account page has to
// apologise for showing them. Here it does not have to.
//
// What a household does not get is editing or approval, and the reason is the
// same in both cases: its allocation target is the value-weighted blend of the
// approved account targets. There is nothing here to edit, because an edit
// belongs to the account whose target it changes.

const householdRecord=id=>{const r=reviewRecord(id);return r?{...r,householdId:id}:null};
const currentHousehold=()=>reviewHouseholdId?householdRecord(reviewHouseholdId):null;
// scenarioOutcome and portfolioThreshold read the open account from a global, so
// rolling a household up means loading each account in turn.
function forAccount(c,fn){const prior=activeClient;activeClient=c.id;try{return fn()}finally{activeClient=prior}}

const HOUSEHOLD_AREAS=[['balance','1 Assets & liabilities'],['allocation','2 Allocation & drift'],
 ['planning','3 Gap summary & trades'],['cash','4 Cash & planning'],['target','5 Client target']];
function householdTabs(){
 return `<nav class="portfolio-tabs portfolio-tabs-five" aria-label="Household work areas">${HOUSEHOLD_AREAS
  .map(([key,label])=>`<button data-household-area="${key}" aria-current="${portfolioArea===key?'page':'false'}">${label}</button>`)
  .join('')}</nav>`;
}
// The accounts are navigation, not a work area, so they sit under the heading
// rather than competing with the five tabs for the adviser's attention.
function householdAccountsStrip(r){
 return `<div class="household-accounts-strip"><span class="eyebrow">Accounts</span>${r.members.map(c=>{
  const p=approved(c).plan;
  return `<button class="household-account-chip" data-client="${esc(c.id)}"><strong>${esc(c.name)}</strong><small>${esc(c.type)} · ${money(scopeValue(p))} · ${esc(baseRef(p))}</small></button>`;
 }).join('')}</div>`;
}
const householdOnly=r=>r.members.length===1;
function householdScopeNote(r){
 return householdOnly(r)
  ? `<p class="note"><strong>${esc(r.name)}</strong> holds one account, <strong>${esc(r.members[0].name)}</strong>. Everything below is that account's position; there is nothing to combine.</p>`
  : `<p class="note">Combined across ${r.members.length} accounts, each counted once. The allocation target is the value-weighted blend of the approved account targets — a household has no target of its own, and nothing here is editable or approvable. Open an account to change or approve its target.</p>`;
}

// ---- 2 Allocation & drift --------------------------------------------------
function householdBreachKeys(r){
 const {total,rows}=householdAllocationRows(r),out=new Set();
 if(!total)return out;
 for(const row of rows){
  if(row.target===null)continue;
  const depth=row.names.length-1;
  if(Math.abs(row.actual/total*100-row.target)<=allocationBand(depth,r.id))continue;
  for(let i=1;i<row.names.length;i++)out.add(JSON.stringify(row.names.slice(0,i)));
 }
 return out;
}
function householdAllocationArea(r){
 const reachable=householdBreachKeys(r).size;
 return distribution(r.actual,r.target,'Combined client targets')
  +`<div class="analysis-toolbar"><h3 class="household-table-heading">Allocation review</h3><div class="flex allocation-tools">`
  +`<button data-household-expand="all">Expand all</button>`
  +`<button data-household-expand="breaches" ${reachable?'':'disabled'} title="${reachable?'Open only the branches holding a row outside its band':'Nothing below an asset class is outside its band'}">Expand to breaches</button>`
  +`<button data-household-expand="none">Collapse all</button></div></div>`
  +householdAllocationTable(r);
}

// ---- 3 Gap summary ---------------------------------------------------------
// Rolled up from each account's own scenario rather than from the pooled
// holdings. Cost basis and tax are per account, and "sell ₹4 L of HDFC Bank" is
// not actionable unless it says which account to sell it in.
function householdGaps(r){
 return r.members.map(c=>forAccount(c,()=>{
  const plan=approved(c).plan,preview=rebalanceScenario(plan,planningOptions);
  const outcome=scenarioOutcome(plan,preview);
  const live=scenariosFor(c).find(s=>s.status==='Draft'&&s.type==='rebalance')||null;
  return {c,plan,preview,outcome,live,total:scopeValue(plan),
   drift:outcome.metricsBefore.drift,breaches:outcome.metricsBefore.exposureFlags.length};
 }));
}
function householdGapArea(r){
 const parts=householdGaps(r);
 const sells=parts.reduce((s,x)=>s+x.outcome.sellTotal,0);
 const buys=parts.reduce((s,x)=>s+x.outcome.buyTotal,0);
 const tax=parts.reduce((s,x)=>s+x.outcome.tax.tax,0);
 const trades=parts.reduce((s,x)=>s+x.outcome.live.length,0);
 const worst=[...parts].sort((a,b)=>(b.drift??0)-(a.drift??0))[0];
 const drafts=parts.filter(x=>x.live).length;
 const tile=(label,value,note)=>`<div><small>${label}</small><strong>${value}</strong>${note?`<small>${note}</small>`:''}</div>`;
 return `<section class="card"><div class="target-section-heading"><div><span class="section-step">Gap summary</span>
  <h2>${worst&&worst.drift>portfolioThreshold(worst.c.id)?`${esc(worst.c.name)} has the largest gap, ${fmt(worst.drift)} pp`:'Every account is within its threshold'}</h2>
  <p>Each account measured against its own approved client target, then added up. A household is not rebalanced as one portfolio: every trade belongs to the account that holds the position.</p></div></div>
  <div class="scope-summary household-gap-tiles">${tile('Accounts',String(parts.length))}${tile('Would sell',money(sells),'if every account rebalanced')}${tile('Would buy',money(buys))}${tile('Est. tax',money(tax),'illustrative')}${tile('Suggested trades',String(trades))}</div>
  <div class="tablewrap"><table class="impact-table"><caption class="sr-only">Gap and suggested rebalance by account</caption>
  <thead><tr><th>Account</th><th class="numeric-head">Under advice (₹ L)</th><th class="numeric-head">Largest gap (pp)</th><th class="numeric-head">Outside band</th><th class="numeric-head">Sell (₹ L)</th><th class="numeric-head">Buy (₹ L)</th><th class="numeric-head">Est. tax (₹ L)</th><th>State</th></tr></thead>
  <tbody>${parts.map(x=>{
   const over=x.drift!=null&&x.drift>portfolioThreshold(x.c.id);
   return `<tr><th scope="row"><button class="link" data-client="${esc(x.c.id)}">${esc(x.c.name)}</button><small>${esc(baseRef(x.plan))}</small></th>
   <td class="numeric">${fmt(x.total)}</td>
   <td class="numeric">${x.drift==null?'—':`<span class="state-pill ${over?'over':'ok'}">${fmt(x.drift)}</span>`}</td>
   <td class="numeric">${x.breaches||'—'}</td>
   <td class="numeric">${x.outcome.sellTotal>0.005?fmt(x.outcome.sellTotal):'—'}</td>
   <td class="numeric">${x.outcome.buyTotal>0.005?fmt(x.outcome.buyTotal):'—'}</td>
   <td class="numeric">${x.outcome.tax.tax>0.005?fmt(x.outcome.tax.tax):'—'}</td>
   <td>${x.live?`<span class="state-pill over">Draft scenario</span>`:x.outcome.live.length?'Nothing generated yet':'<span class="state-pill ok">No trades needed</span>'}</td></tr>`;
  }).join('')}</tbody></table></div>
  <p class="chart-key">${asOfNote()} These are previews of what each account's own rebalance would suggest, not a household scenario. Nothing is generated, approved or recorded from here${drafts?`. ${drafts} account${drafts===1?' has a draft scenario':'s have draft scenarios'} already open`:''}. Open an account's <strong>Gap summary &amp; trades</strong> tab to generate, adjust or approve one.</p>
  </section>`;
}

// ---- 4 Cash & planning -----------------------------------------------------
function householdCashArea(r){
 const events=r.members.map(c=>({c,list:scenariosFor(c).filter(s=>s.type!=='rebalance')}));
 const open=events.reduce((n,x)=>n+x.list.filter(s=>s.status==='Draft').length,0);
 const recorded=events.reduce((n,x)=>n+x.list.length,0);
 return financialPlanArea(r)
  +`<section class="card"><div class="target-section-heading"><div><span class="section-step">Cash events</span><h2>Raising or investing cash happens in an account</h2>
  <p>The plan above is the household's. A cash event is not: it sells or buys specific positions, with that account's cost basis and tax.</p></div></div>
  ${recorded?`<div class="tablewrap"><table class="impact-table"><thead><tr><th>Account</th><th class="numeric-head">Cash events</th><th>Latest</th></tr></thead><tbody>${events.filter(x=>x.list.length).map(x=>{
   const last=x.list[x.list.length-1];
   return `<tr><th scope="row"><button class="link" data-client="${esc(x.c.id)}">${esc(x.c.name)}</button></th><td class="numeric">${x.list.length}</td><td>${esc(last.type==='raise'?'Raise':'Invest')} · ${esc(last.status)}</td></tr>`;
  }).join('')}</tbody></table></div>${open?`<p class="note warning">${open} draft cash event${open===1?'':'s'} across this household.</p>`:''}`
   :'<p class="note">No cash events recorded in this household yet. Open an account to raise or invest cash.</p>'}
  </section>`;
}

// ---- 5 Client target -------------------------------------------------------
// Read-only by design. The household allocation is the blend of what each
// account already approved, so the question worth answering here is not "what
// should this be" but "do these accounts agree with each other".
function householdTargetArea(r){
 const parts=r.members.map(c=>{
  const plan=approved(c).plan,record=approved(c);
  return {c,plan,record,total:scopeValue(plan),
   overrides:allocationOverrideCount(plan),
   classes:TAX.assetClassRows(TAX.rowsFor({vector:vectorOf(actualValues(plan)),targets:planTargets(plan),modelName:c.modelName}))};
 });
 const models=[...new Set(parts.map(x=>baseRef(x.plan)))];
 const classes=originalData.assetHierarchy.map(c=>c.n);
 const total=parts.reduce((s,x)=>s+x.total,0);
 const blended=classes.map(name=>({name,
  target:total?parts.reduce((s,x)=>s+(x.classes.find(c=>c.label===name)?.target||0)*x.total,0)/total:0}));
 return `<section class="card"><div class="target-section-heading"><div><span class="section-step">Client target</span>
  <h2>${models.length===1?`Every account follows ${esc(models[0])}`:`${models.length} different models across ${parts.length} accounts`}</h2>
  <p>A household has no target of its own. What it shows is the blend of the approved account targets, weighted by value under advice. Approval belongs to the account.</p></div></div>
  ${models.length>1?`<p class="note">Accounts in one household following different models is not wrong — a trust and an individual account can have different mandates — but it is worth knowing when reading the combined allocation below.</p>`:''}
  <div class="tablewrap"><table class="impact-table"><caption class="sr-only">Approved target by account</caption>
  <thead><tr><th>Account</th><th>Model</th><th class="numeric-head">Under advice (₹ L)</th><th class="numeric-head">Weight</th>${classes.map(n=>`<th class="numeric-head">${esc(n)} %</th>`).join('')}<th>Target source</th><th></th></tr></thead>
  <tbody>${parts.map(x=>`<tr><th scope="row">${esc(x.c.name)}<small>${esc(x.c.type)}</small></th><td>${esc(baseRef(x.plan))}</td>
   <td class="numeric">${fmt(x.total)}</td><td class="numeric">${fmt(total?x.total/total*100:0)}%</td>
   ${classes.map(n=>`<td class="numeric">${fmt(x.classes.find(c=>c.label===n)?.target||0)}</td>`).join('')}
   <td>${x.overrides?`<span class="state-pill over">${x.overrides} override${x.overrides===1?'':'s'}</span>`:'<span class="state-pill ok">Follows the model</span>'}</td>
   <td><button data-client="${esc(x.c.id)}">Open target →</button></td></tr>`).join('')}
  <tr class="rowtop"><th scope="row">Blended household target</th><td>${models.length===1?esc(models[0]):'Mixed models'}</td>
   <td class="numeric">${fmt(total)}</td><td class="numeric">100%</td>
   ${blended.map(b=>`<td class="numeric"><strong>${fmt(b.target)}</strong></td>`).join('')}<td colspan="2">Weighted by value under advice</td></tr>
  </tbody></table></div>
  <p class="chart-key">Percentages are each account's own approved client target, including any portfolio override it carries. The blended row is what the Allocation &amp; drift tab measures this household against.</p>
  </section>`;
}

// ---- The page --------------------------------------------------------------
householdPage=function(id){
 leaveModels();clientEditing=false;allocationDraft=false;activeClient=null;
 reviewHouseholdId=id;comparisonState.active=false;navState('portfolios');
 const r=householdRecord(id);
 if(!HOUSEHOLD_AREAS.some(([key])=>key===portfolioArea))portfolioArea='allocation';
 const exposures=activeLens!=='ac'&&portfolioArea==='allocation';
 const opened=!!document.querySelector('.all-exposures')?.open;
 $('footer').innerHTML='';
 $('app').innerHTML=`<button class="quiet" data-action="back">← All portfolios</button>
  <div class="portfolio-heading"><div><div class="eyebrow">Household portfolio</div><h1>${esc(r.name)}</h1>
  <p class="muted">${r.members.length} account${r.members.length===1?'':'s'} · ${money(r.total)} under advice · Risk label: ${esc(r.risk)}</p></div>
  <span class="source-stamp">Illustrative data · ${sourceDate()}</span></div>
  ${householdAccountsStrip(r)}${detailSummary(r)}${householdTabs()}
  <section class="card household-review-content">${
   portfolioArea==='balance'?balanceArea(r)
   :portfolioArea==='planning'?householdGapArea(r)
   :portfolioArea==='cash'?householdCashArea(r)
   :portfolioArea==='target'?householdTargetArea(r)
   :`<div class="analysis-toolbar"><div class="segmented" role="group" aria-label="Allocation view"><button data-household-lens="ac" aria-pressed="${!exposures}">Asset allocation</button><button data-household-lens="sec" aria-pressed="${exposures}">Exposure analysis</button></div></div>`
    +(exposures?reviewFullExposures(r,'household',opened):householdAllocationArea(r))
  }</section>
  ${householdScopeNote(r)}`;
};

document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||!reviewHouseholdId)return;
 if(b.dataset.householdArea){portfolioArea=b.dataset.householdArea;activeLens='ac';householdPage(reviewHouseholdId);scrollWorkspace();return}
 if(b.dataset.householdLens){activeLens=b.dataset.householdLens;householdPage(reviewHouseholdId);return}
 if(b.dataset.householdExpand==='breaches'){
  const r=householdRecord(reviewHouseholdId);
  householdExpanded.clear();for(const key of householdBreachKeys(r))householdExpanded.add(key);
  householdPage(reviewHouseholdId);return;
 }
});
