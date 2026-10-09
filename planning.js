'use strict';
// Planning: turn a gap into a reviewable scenario. Nothing here changes
// recorded holdings, the approved client target, or any other portfolio, and
// approval never implies that a trade was placed.
// Algorithms are ported from the original mockup, retargeted from the model to
// the approved client target. Tax figures are illustrative placeholders.

const MIN_TRADE_DEFAULT=0.5,LTCG_EXEMPTION_DEFAULT=1.25;
const SHORT_TERM_RATE=20; // the original marks a 20% rate as a short-term gain
const scenarioKey=c=>c.id;
const scenariosFor=c=>(c.scenarios=c.scenarios||[]);
const liveScenario=c=>scenariosFor(c).find(s=>s.status==='Draft')||null;

function planningHoldings(plan){
 const total=scopeValue(plan);
 return alignedPortfolioRows(plan).filter(r=>!r.children).map(row=>{
  const name=row.names.at(-1),asset=plan.assets.find(a=>a.name===name&&a.included);
  if(!asset)return null;
  const sec=originalData.securities.find(s=>s.name===name)||{};
  const target=row.values[1];
  return {name,category:row.names[0],value:asset.value,cost:asset.costBasis??asset.value,
   rate:sec.illustrativeTaxRatePercent??0,liquidity:sec.liquidity||'Unclassified',
   locked:(sec.liquidityCode??0)>1,semi:(sec.liquidityCode??0)===1,
   shortTerm:(sec.illustrativeTaxRatePercent??0)===SHORT_TERM_RATE,
   note:sec.originalNote||'',target,targetValue:target===null?null:total*target/100,
   gain:asset.value-(asset.costBasis??asset.value)};
 }).filter(Boolean);
}

// Losses offset the highest-rated gains first, then the long-term exemption is
// applied. Mirrors the original mockup's taxOf().
function estimateTax(trades,{carryForward=0,exemption=LTCG_EXEMPTION_DEFAULT}={}){
 let losses=carryForward,harvested=0;const gains=[];
 for(const t of trades){
  if(t.amount>=0)continue;
  const realised=t.value>0?t.gain*(-t.amount)/t.value:0;
  if(realised<0){losses-=realised;harvested-=realised}
  else if(realised>0)gains.push({gain:realised,rate:t.rate});
 }
 gains.sort((a,b)=>b.rate-a.rate);
 for(const g of gains){const used=Math.min(g.gain,losses);g.gain-=used;losses-=used}
 let left=exemption;
 for(const g of gains.filter(x=>x.rate===12.5)){const used=Math.min(g.gain,left);g.gain-=used;left-=used}
 return {tax:gains.reduce((s,g)=>s+g.gain*g.rate/100,0),harvested,exemptionUsed:exemption-left,
  lossesUsed:carryForward-Math.max(0,losses),taxable:gains.reduce((s,g)=>s+g.gain,0)};
}

function sellable(h,o){
 if(o.skipLocked&&h.locked)return false;
 if(o.avoidShortTerm&&h.shortTerm&&h.gain>0)return false;
 return true;
}

// Asset-class drift is what the review threshold measures, so a trade that
// closes a leaf gap while pushing its class further out is not an improvement.
// Sells come only from classes at or above their target; buys go only to
// classes below theirs.
function classPositions(plan){
 const total=scopeValue(plan),actual=actualValues(plan),target=leafValues(effective(plan));
 const map=new Map();
 for(const c of originalData.assetHierarchy){
  const have=actual.filter(x=>x.category===c.n).reduce((s,x)=>s+x.value,0);
  const want=target.filter(x=>x.category===c.n).reduce((s,x)=>s+x.value,0);
  map.set(c.n,{actual:total?have/total*100:0,target:want,gap:total*want/100-have});
 }
 return map;
}

function rebalanceScenario(plan,o){
 const holdings=planningHoldings(plan),classes=classPositions(plan),notes=[],trades=[];
 let lockedOverweight=0,blockedShortTerm=0,blockedByClass=0;
 const gaps=holdings.map(h=>({h,gap:h.targetValue===null?0:h.targetValue-h.value,cls:classes.get(h.category)}));
 for(const {h,gap,cls} of gaps){
  if(gap>=-o.minTrade)continue;
  if(cls&&cls.gap>0.05){blockedByClass+=-gap;continue}
  if(o.skipLocked&&h.locked){lockedOverweight+=-gap;continue}
  if(o.avoidShortTerm&&h.shortTerm&&h.gain>0){blockedShortTerm+=-gap;continue}
  trades.push({name:h.name,amount:gap,value:h.value,gain:h.gain,rate:h.rate,liquidity:h.liquidity,
   locked:h.locked,semi:h.semi,shortTerm:h.shortTerm,note:h.note,reason:'Above client target',excluded:false});
 }
 // A rebalance is cash-neutral by definition, so size both sides to whichever
 // is smaller. Selling more than can be redeployed would book tax to create
 // idle cash, which is a worse outcome than the drift it is meant to fix.
 const wanted=gaps.filter(({h,gap,cls})=>gap>o.minTrade&&!(o.skipLocked&&h.locked)&&cls&&cls.gap>0.05);
 const sellCapacity=trades.reduce((s,t)=>s-t.amount,0);
 const buyCapacity=wanted.reduce((s,x)=>s+x.gap,0);
 const moved=Math.min(sellCapacity,buyCapacity);
 const sellScale=sellCapacity>0?moved/sellCapacity:0,buyScale=buyCapacity>0?moved/buyCapacity:0;
 for(const t of trades)t.amount*=sellScale;
 for(const {h,gap} of wanted){
  const amount=gap*buyScale;
  if(amount<=0.001)continue;
  trades.push({name:h.name,amount,value:h.value,gain:0,rate:h.rate,liquidity:h.liquidity,
   locked:h.locked,semi:h.semi,shortTerm:h.shortTerm,note:h.note,reason:'Below client target',excluded:false});
 }
 for(let i=trades.length-1;i>=0;i--)if(Math.abs(trades[i].amount)<0.005)trades.splice(i,1);
 if(sellScale<0.999&&sellCapacity>0.05)notes.push({tone:'info',text:`Sells were capped at ${money(moved)}, the most that can be redeployed. ${money(sellCapacity-moved)} more could be sold, but it would sit in cash and still book an estimated tax charge.`});
 if(buyScale<0.999&&buyCapacity>0.05)notes.push({tone:'warn',text:`Buys cover ${Math.round(buyScale*100)}% of the shortfall because only ${money(sellCapacity)} could be sold. The portfolio will not reach target from this scenario alone.`});
 const stuck=[...classes].filter(([,c])=>c.gap<-0.05).map(([name,c])=>({name,c}));
 const lockedUnder=gaps.filter(({h,gap,cls})=>gap>o.minTrade&&o.skipLocked&&h.locked&&cls&&cls.gap>0.05).reduce((s,x)=>s+x.gap,0);
 if(lockedOverweight>0.05)notes.push({tone:'warn',text:`${money(lockedOverweight)} is above target in locked holdings and was not sold. Real estate, EPF and the AIF cannot be sold quickly.`});
 if(blockedShortTerm>0.05)notes.push({tone:'warn',text:`${money(blockedShortTerm)} was not sold because it would realise a short-term gain. Turn off "Avoid short-term gains" to widen the pool.`});
 if(blockedByClass>0.05)notes.push({tone:'info',text:`${money(blockedByClass)} sits above target inside asset classes that are themselves below target, so selling it would widen the class gap. It was left alone.`});
 if(lockedUnder>0.05)notes.push({tone:'warn',text:`${money(lockedUnder)} of the shortfall sits in locked holdings and was not bought.`});
 for(const {name,c} of stuck){
  const sellable=holdings.filter(h=>h.category===name&&!(o.skipLocked&&h.locked)&&h.targetValue!==null&&h.value-h.targetValue>o.minTrade)
   .reduce((s,h)=>s+(h.value-h.targetValue),0);
  if(sellable<-c.gap-0.05)notes.push({tone:'warn',text:`${esc(name)} is ${money(-c.gap)} above target but only ${money(Math.max(0,sellable))} of it can be sold under these constraints. The rest is locked or illiquid, so this gap cannot be closed by trading alone \u2014 it needs new money elsewhere, or a decision about the restricted holding itself.`});
 }
 trades.sort((a,b)=>a.amount-b.amount);
 return {type:'rebalance',options:o,trades,notes,request:null};
}

// "Net" means the client receives the amount after tax, so the sale has to be
// larger. One corrective pass is enough at these rates.
function cashScenario(plan,o){
 if(o.direction==='raise'&&o.net==='net'){
  const first=rawCashScenario(plan,{...o,net:'gross'});
  const tax=estimateTax(first.trades,o).tax;
  if(tax>0.005){
   const grossed=rawCashScenario(plan,{...o,net:'gross',amount:(o.amount||0)+tax});
   grossed.request={amount:o.amount,reason:o.reason,stages:o.stages,net:'net'};
   grossed.notes.push({tone:'info',text:`Sales were sized to ${money((o.amount||0)+tax)} so that about ${money(o.amount)} is left after an estimated ${money(tax)} of tax.`});
   return grossed;
  }
 }
 return rawCashScenario(plan,o);
}
function rawCashScenario(plan,o){
 const holdings=planningHoldings(plan),notes=[],trades=[];
 const raise=o.direction==='raise',amount=Math.max(0,o.amount||0);
 const total=scopeValue(plan),projectedTotal=raise?total-amount:total+amount;
 if(raise){
  const eligible=holdings.filter(h=>sellable(h,o)&&h.value>0.05);
  const skippedLocked=holdings.filter(h=>o.skipLocked&&h.locked).length;
  const taken=new Map();let need=amount;
  const take=(h,cash)=>{if(cash<=0.001)return;taken.set(h,(taken.get(h)||0)+cash);need-=cash};
  const room=h=>h.value-(taken.get(h)||0);
  const cost=h=>{const frac=h.value>0?h.gain/h.value:0;return (h.gain<0?frac:frac*h.rate/100)+(h.semi?0.02:0)+(h.locked?0.05:0)};
  if(o.harvestLosses)for(const h of eligible.filter(x=>x.gain<0).sort((a,b)=>cost(a)-cost(b)))take(h,Math.min(room(h),need));
  if(o.strategy==='target'){
   const excess=h=>h.targetValue===null?0:h.value-(h.targetValue*projectedTotal/total)-(taken.get(h)||0);
   for(const h of eligible.filter(x=>excess(x)>0.001).sort((a,b)=>excess(b)-excess(a)))take(h,Math.min(excess(h),room(h),need));
  } else if(o.strategy==='prorata'){
   const pool=eligible.reduce((s,h)=>s+room(h),0),start=need;
   if(pool>0)for(const h of eligible)take(h,Math.min(room(h),start*room(h)/pool));
  }
  for(const h of [...eligible].sort((a,b)=>cost(a)-cost(b)))take(h,Math.min(room(h),need));
  for(const [h,cash] of taken)if(cash>=0.05)trades.push({name:h.name,amount:-cash,value:h.value,gain:h.gain,rate:h.rate,
   liquidity:h.liquidity,locked:h.locked,semi:h.semi,shortTerm:h.shortTerm,note:h.note,
   reason:o.strategy==='target'?'Above client target':o.harvestLosses&&h.gain<0?'Loss harvested':'Lowest estimated tax cost',excluded:false});
  if(need>0.01)notes.push({tone:'warn',text:`Short by ${money(need)}. The eligible holdings cannot cover this amount. Turn off "Avoid short-term gains" or "Skip locked assets" to widen the pool.`});
  if(skippedLocked)notes.push({tone:'warn',text:`${skippedLocked} locked holdings were skipped.`});
 } else {
  const eligible=holdings.filter(h=>!(o.skipLocked&&h.locked));
  const gap=h=>h.targetValue===null?0:(h.targetValue*projectedTotal/total)-h.value;
  const under=eligible.filter(h=>gap(h)>0.001),shortfall=under.reduce((s,h)=>s+gap(h),0);
  if(shortfall>=amount){for(const h of under)trades.push({name:h.name,amount:amount*gap(h)/shortfall,value:h.value,gain:0,rate:h.rate,
   liquidity:h.liquidity,locked:h.locked,semi:h.semi,shortTerm:h.shortTerm,note:h.note,reason:'Below client target',excluded:false});
  } else {
   for(const h of under)trades.push({name:h.name,amount:gap(h),value:h.value,gain:0,rate:h.rate,liquidity:h.liquidity,
    locked:h.locked,semi:h.semi,shortTerm:h.shortTerm,note:h.note,reason:'Below client target',excluded:false});
   const rest=amount-shortfall,weight=eligible.reduce((s,h)=>s+(h.target||0),0);
   if(weight>0)for(const h of eligible){const extra=rest*(h.target||0)/weight;if(extra>0.001){
    const existing=trades.find(t=>t.name===h.name);
    if(existing)existing.amount+=extra;
    else trades.push({name:h.name,amount:extra,value:h.value,gain:0,rate:h.rate,liquidity:h.liquidity,locked:h.locked,
     semi:h.semi,shortTerm:h.shortTerm,note:h.note,reason:'Spread to client target weights',excluded:false});
   }}
   notes.push({tone:'info',text:'The shortfall to target is smaller than the amount being invested, so the remainder is spread across the client target weights.'});
  }
  const lockedGap=holdings.filter(h=>o.skipLocked&&h.locked).reduce((s,h)=>s+Math.max(0,gap(h)),0);
  if(lockedGap>0.05)notes.push({tone:'warn',text:`${money(lockedGap)} of the shortfall sits in locked holdings and was not bought.`});
  if(o.stages>1)notes.push({tone:'info',text:`Staged over ${o.stages} months: about ${money(amount/o.stages)} a month. Cash waiting to be invested is held outside the portfolio and any interest on it is taxable. Staging is an instruction you chose, not an inherently better option.`});
 }
 trades.sort((a,b)=>a.amount-b.amount);
 return {type:o.direction,options:o,trades,notes,request:{amount,reason:o.reason,stages:o.stages,net:o.net}};
}

// Totals, tax and the projected portfolio for whatever trades survive editing.
function scenarioOutcome(plan,scenario){
 const live=scenario.trades.filter(t=>!t.excluded&&Math.abs(t.amount)>=0.005);
 const sells=live.filter(t=>t.amount<0),buys=live.filter(t=>t.amount>0);
 const sellTotal=sells.reduce((s,t)=>s-t.amount,0),buyTotal=buys.reduce((s,t)=>s+t.amount,0);
 const tax=estimateTax(live,scenario.options);
 const missingLots=live.filter(t=>t.amount<0&&!Number.isFinite(t.gain)).length;
 const delta=new Map(live.map(t=>[t.name,t.amount]));
 const before=actualValues(plan);
 const after=before.map(x=>({...x,value:x.value+(delta.get(x.name)||0)}));
 // portfolioMetrics measures against node targets. leafValues returns a
 // per-security array, which indexes as nothing, so every target read as 0 and
 // the gap summary reported the whole portfolio as its own drift. The trades
 // were never affected — they read the target off the allocation rows — but
 // every before/after figure on the screen was.
 const target=planTargets(plan),threshold=portfolioThreshold(activeClient);
 const model=plan.base&&plan.base.data&&plan.base.data.name;
 const metricsBefore=portfolioMetrics(before,target,threshold,plan.treeOverrides,model);
 const metricsAfter=portfolioMetrics(after,target,threshold,plan.treeOverrides,model);
 const request=scenario.request?scenario.request.amount:0;
 const netCash=scenario.type==='raise'?sellTotal-buyTotal-tax.tax:scenario.type==='invest'?request-buyTotal:sellTotal-buyTotal;
 const net=scenario.request&&scenario.request.net==='net';
 const shortfall=scenario.type==='raise'?Math.max(0,(net?request+tax.tax:request)-sellTotal):0;
 const unfunded=scenario.type==='rebalance'?Math.max(0,buyTotal-sellTotal):0;
 return {live,sells,buys,sellTotal,buyTotal,tax,missingLots,metricsBefore,metricsAfter,
  netCash,shortfall,unfunded,residual:scenario.type==='rebalance'?Math.max(0,sellTotal-buyTotal):0};
}

// --- Screens -------------------------------------------------------------
let planningOptions={skipLocked:true,avoidShortTerm:true,harvestLosses:false,minTrade:MIN_TRADE_DEFAULT,
 exemption:LTCG_EXEMPTION_DEFAULT,carryForward:0,strategy:'target',direction:'raise',amount:20,stages:1,
 reason:originalData.cashPlanning.reasons.raise[0],net:'gross'};
const asOfNote=()=>`Holdings and valuations dated ${sourceDate()}. If either were stale in a real system, these suggestions would be unsafe to act on.`;

function tradeTable(scenario,outcome,editable){
 const showTax=scenario.type!=='invest';
 return `<div class="tablewrap"><table class="trade-table"><caption class="sr-only">Suggested trades</caption><thead><tr>
  ${editable?'<th class="col-include">Include</th>':''}<th>Holding</th><th>Action</th><th class="numeric-head">Amount (₹ L)</th>
  ${showTax?'<th class="numeric-head">Est. gain (₹ L)</th><th class="numeric-head">Rate</th><th class="numeric-head">Est. tax (₹ L)</th>':''}
  <th>Why, and what constrains it</th></tr></thead><tbody>
  ${scenario.trades.map((t,i)=>{
   const realised=t.amount<0&&t.value>0?t.gain*(-t.amount)/t.value:0;
   const flags=[];
   if(t.locked)flags.push('<span class="holding-tag locked">Locked</span>');
   else if(t.semi)flags.push('<span class="holding-tag semi">Semi-liquid</span>');
   if(t.amount<0&&t.shortTerm&&realised>0)flags.push('<span class="holding-tag warn-tag">Short-term gain</span>');
   if(t.amount<0&&realised<0)flags.push('<span class="holding-tag ok-tag">Loss harvested</span>');
   return `<tr class="${t.excluded?'is-excluded':''}">
   ${editable?`<td class="col-include"><input type="checkbox" data-trade-include="${i}" ${t.excluded?'':'checked'} aria-label="Include ${esc(t.name)} in this scenario"></td>`:''}
   <td><strong>${esc(t.name)}</strong></td>
   <td><span class="state-pill ${t.amount<0?'over':'ok'}">${t.amount<0?'Sell':'Buy'}</span></td>
   <td class="numeric">${editable?`<input class="target" type="number" step="0.1" min="0" value="${fmt(Math.abs(t.amount))}" data-trade-amount="${i}" aria-label="Amount for ${esc(t.name)}">`:fmt(Math.abs(t.amount))}</td>
   ${showTax?`<td class="numeric">${t.amount<0?signed(realised):'—'}</td><td class="numeric">${t.amount<0?fmt(t.rate)+'%':'—'}</td><td class="numeric">${t.amount<0&&realised>0?fmt(realised*t.rate/100):'—'}</td>`:''}
   <td class="trade-why">${esc(t.reason)}${flags.length?'<div class="trade-flags">'+flags.join('')+'</div>':''}${t.note&&(t.locked||t.semi)?`<small>${esc(t.note)}</small>`:''}</td></tr>`;
  }).join('')||`<tr><td colspan="${editable?8:7}" class="empty-state"><strong>No feasible trade under these constraints</strong><p class="muted">Nothing can be sold from the asset classes that are above target, so there are no proceeds to redeploy. The constraints below explain why.</p></td></tr>`}
 </tbody></table></div>
 <p class="chart-key">Estimated tax is applied trade by trade here; the scenario total below also applies loss offsets and the long-term exemption, so it can be lower. Rates and cost basis are the original mockup's illustrative placeholders, not current tax guidance.</p>`;
}

function impactPanel(scenario,outcome){
 const b=outcome.metricsBefore,a=outcome.metricsAfter;
 const cls=(x,i)=>x.classes[i];
 const kpi=(label,value,hint,tone)=>`<div class="${tone||''}"><small>${label}</small><strong>${value}</strong>${hint?`<span>${hint}</span>`:''}</div>`;
 const move=(before,after)=>after<before-0.05?'is-better':after>before+0.05?'is-worse':'';
 return `<section class="card impact-card"><div class="target-section-heading"><div><span class="section-step">Scenario impact</span><h2>Projected, not recorded</h2><p>The projection assumes every included trade is executed in full at today's values. Recorded holdings are unchanged.</p></div></div>
 <div class="impact-kpis">
  ${kpi('Total sells',money(outcome.sellTotal))}
  ${kpi('Total buys',money(outcome.buyTotal))}
  ${kpi('Estimated tax',money(outcome.tax.tax),outcome.tax.lossesUsed||outcome.tax.exemptionUsed?`after ${money(outcome.tax.lossesUsed+outcome.tax.harvested)} of losses and ${money(outcome.tax.exemptionUsed)} exemption`:'no offsets applied')}
  ${kpi(scenario.type==='raise'?'Net cash raised':scenario.type==='invest'?'Cash still to deploy':'Residual cash',money(Math.abs(outcome.netCash)))}
  ${kpi('Aggregated drift',`${fmt(b.drift)} → ${fmt(a.drift)} pp`,`threshold ${fmt(portfolioThreshold(activeClient))} pp`,move(b.drift,a.drift))}
  ${kpi('Exposure flags',`${b.exposureFlags.length} → ${a.exposureFlags.length}`,a.exposureFlags.length>b.exposureFlags.length?'this scenario creates new flags':'',move(b.exposureFlags.length,a.exposureFlags.length))}
 </div>
 <div class="tablewrap"><table class="impact-table"><thead><tr><th>Asset class</th><th class="numeric-head">Actual now</th><th class="numeric-head">Client target</th><th class="numeric-head">Projected</th><th class="numeric-head">Drift after</th></tr></thead><tbody>
 ${b.classes.map((c,i)=>{const after=cls(a,i),drift=after.actual===null?null:after.actual-after.target;
  const state=drift===null?null:allocationState(drift,0,activeClient);
  return `<tr><td>${esc(c.name)}</td><td class="numeric">${c.actual===null?'—':fmt(c.actual)+'%'}</td><td class="numeric">${fmt(c.target)}%</td><td class="numeric"><strong>${after.actual===null?'—':fmt(after.actual)+'%'}</strong></td><td class="numeric">${drift===null?'—':`<span class="state-pill ${state.tone}">${signed(drift)} pp</span>`}</td></tr>`}).join('')}
 </tbody></table></div>
 ${outcome.unfunded>0.05?`<div class="note warning"><strong>${money(outcome.unfunded)} of buys is unfunded.</strong> Excluding a sell leaves the remaining buys without proceeds. Reduce the buys, restore a sell, or fund the difference with new cash.</div>`:''}
 ${outcome.shortfall>0.05?`<div class="note warning"><strong>${money(outcome.shortfall)} short of the requested amount</strong> after estimated tax. Widen the eligible pool or lower the request.</div>`:''}
 ${scenario.request&&scenario.type==='raise'?`<p class="chart-key">The request was read as <strong>${scenario.request.net==='net'?'net cash after estimated tax':'gross sale proceeds'}</strong>. ${scenario.request.net==='net'?'Sales were sized to cover the estimated tax as well.':'Estimated tax is deducted from the proceeds and reduces the usable cash.'}</p>`:''}
 ${a.drift>b.drift+0.05?`<div class="note warning"><strong>This scenario moves the portfolio further from its client target</strong> — aggregated drift rises from ${fmt(b.drift)} to ${fmt(a.drift)} pp. That can be the right trade-off when raising cash for a known need, but it is a trade-off, not an improvement.</div>`:''}
 <p class="chart-key">${asOfNote()}</p></section>`;
}

function notesPanel(scenario,outcome){
 const notes=[...scenario.notes];
 if(outcome.missingLots)notes.push({tone:'warn',text:`${outcome.missingLots} holdings have no usable cost basis, so this is an incomplete estimate.`});
 if(!notes.length)return '';
 return `<section class="card"><h2>Constraints and warnings</h2><ul class="scenario-notes">${notes.map(n=>`<li class="${n.tone}">${n.text}</li>`).join('')}</ul></section>`;
}

function scenarioHeader(c,scenario,outcome){
 const a=approved(c);
 return `<section class="target-status ${scenario.status==='Approved'?'is-approved':'is-draft'}">
 <div><span class="target-status-label">${scenario.status==='Approved'?'Approved recommendation':'Draft scenario'}</span>
 <h2>${esc({rebalance:'Rebalance towards the approved client target',raise:'Raise cash',invest:'Invest cash'}[scenario.type])}${scenario.request?' · '+money(scenario.request.amount):''}</h2>
 <p>${scenario.status==='Approved'?`Approved ${esc(scenario.approvedAt||'')} by ${esc(scenario.approver||'')}. Approval records a decision; it does not place a trade.`:`Holdings ${esc(sourceDate())} · client target revision ${a.number} of ${esc(a.effectiveDate)} · nothing is executed.`}</p>${outcome.live.length?'':'<p class="scenario-infeasible">This scenario produces no trades. Read the constraints before concluding that nothing needs doing.</p>'}</div>
 ${scenario.status==='Approved'?'':`<div class="flex"><button data-scenario="discard">Discard</button><button class="primary" data-scenario="review">Review & approve →</button></div>`}</section>`;
}

function optionControls(kind){
 const o=planningOptions;
 const common=`<label class="check-filter"><input type="checkbox" data-opt="skipLocked" ${o.skipLocked?'checked':''}> Skip locked assets (EPF, AIF, real estate)</label>
  <label class="check-filter"><input type="checkbox" data-opt="avoidShortTerm" ${o.avoidShortTerm?'checked':''}> Avoid realising short-term gains</label>
  <div class="option-grid"><label class="field">Minimum trade size (₹ L)<input type="number" min="0" step="0.5" data-opt="minTrade" value="${o.minTrade}"></label>
  <label class="field">Long-term exemption left (₹ L)<input type="number" min="0" step="0.25" data-opt="exemption" value="${o.exemption}"></label>
  <label class="field">Carry-forward losses (₹ L)<input type="number" min="0" step="0.5" data-opt="carryForward" value="${o.carryForward}"></label></div>`;
 if(kind==='rebalance')return common;
 return `<div class="option-grid">
  <label class="field">Event<select data-opt="direction"><option value="raise" ${o.direction==='raise'?'selected':''}>Raise cash</option><option value="invest" ${o.direction==='invest'?'selected':''}>Invest cash</option></select></label>
  <label class="field">Amount (₹ L)<input type="number" min="0.5" step="0.5" data-opt="amount" value="${o.amount}"></label>
  <label class="field">Reason<select data-opt="reason">${originalData.cashPlanning.reasons[o.direction].map(r=>`<option ${o.reason===r?'selected':''}>${esc(r)}</option>`).join('')}</select></label>
  ${o.direction==='raise'?`<label class="field">Amount means<select data-opt="net"><option value="gross" ${o.net==='gross'?'selected':''}>Gross sale proceeds</option><option value="net" ${o.net==='net'?'selected':''}>Net cash after estimated tax</option></select></label>
  <label class="field">Selection strategy<select data-opt="strategy"><option value="target" ${o.strategy==='target'?'selected':''}>Keep closest to client target</option><option value="tax" ${o.strategy==='tax'?'selected':''}>Lowest estimated tax</option><option value="prorata" ${o.strategy==='prorata'?'selected':''}>Pro-rata across holdings</option></select></label>`
  :`<label class="field">Deployment<select data-opt="stages"><option value="1" ${o.stages==1?'selected':''}>Lump sum</option><option value="3" ${o.stages==3?'selected':''}>3-month staged</option><option value="6" ${o.stages==6?'selected':''}>6-month staged</option></select></label>`}
 </div>${common}
 ${o.direction==='raise'?`<label class="check-filter"><input type="checkbox" data-opt="harvestLosses" ${o.harvestLosses?'checked':''}> Sell loss-making holdings first to harvest losses</label>`:''}`;
}

function planningArea(c){
 const plan=approved(c).plan,scenario=liveScenario(c);
 if(!scenario||scenario.type!=='rebalance'){
  const preview=rebalanceScenario(plan,planningOptions);
  const outcome=scenarioOutcome(plan,preview);
  const metrics=outcome.metricsBefore;
  return `<section class="card"><div class="target-section-heading"><div><span class="section-step">Gap summary</span><h2>${metrics.drift>portfolioThreshold(activeClient)?`Largest gap is ${fmt(metrics.drift)} pp`:'Every asset class is within its threshold'}</h2><p>Against the approved client target. A gap is not a trade recommendation; a scenario is only created when you ask for one.</p></div></div>
  <div class="tablewrap"><table class="impact-table"><thead><tr><th>Asset class</th><th class="numeric-head">Actual</th><th class="numeric-head">Client target</th><th class="numeric-head">Drift</th><th class="numeric-head">Value gap (₹ L)</th></tr></thead><tbody>
  ${metrics.classes.map(x=>{const drift=x.actual===null?null:x.actual-x.target,state=drift===null?null:allocationState(drift,0,activeClient);
   return `<tr><td>${esc(x.name)}</td><td class="numeric">${x.actual===null?'—':fmt(x.actual)+'%'}</td><td class="numeric">${fmt(x.target)}%</td><td class="numeric">${drift===null?'—':`<span class="state-pill ${state.tone}">${signed(drift)} pp</span>`}</td><td class="numeric">${drift===null?'—':signed(scopeValue(plan)*x.target/100-scopeValue(plan)*x.actual/100)}</td></tr>`}).join('')}
  </tbody></table></div></section>
  <section class="card"><div class="target-section-heading"><div><span class="section-step">Generate a scenario</span><h2>Rebalance towards the approved client target</h2><p>Sells what is above target to fund what is below it, within the constraints you set.</p></div></div>
  ${optionControls('rebalance')}
  <div class="flex" style="margin-top:16px"><button class="primary" data-scenario="create-rebalance">Suggest trades</button></div>
  <p class="chart-key">${asOfNote()} Suggestions appear only after you ask for them.</p></section>
  ${preview.trades.length?`<details class="card"><summary>Preview the trades this would suggest · ${preview.trades.length}</summary>${tradeTable(preview,outcome,false)}</details>`:''}`;
 }
 const outcome=scenarioOutcome(plan,scenario);
 return `${scenarioHeader(c,scenario,outcome)}
 <section class="card"><div class="target-section-heading"><div><span class="section-step">Suggested trades</span><h2>Adjust, exclude, then recalculate</h2><p>Unticking a sell leaves its buys unfunded; the impact panel says so rather than silently rebalancing.</p></div><button data-scenario="regenerate">Regenerate from options</button></div>
 ${tradeTable(scenario,outcome,scenario.status!=='Approved')}</section>
 ${notesPanel(scenario,outcome)}
 ${impactPanel(scenario,outcome)}`;
}

function cashArea(c){
 const plan=approved(c).plan,scenario=liveScenario(c),events=scenariosFor(c).filter(s=>s.type!=='rebalance');
 const history=`<section class="card"><h2>Cash events for this portfolio</h2>
 ${events.length?`<div class="event-list">${events.map((s,i)=>{
  const o=scenarioOutcome(plan,s);
  return `<details class="event"><summary><span class="state-pill ${s.status==='Approved'?'ok':s.status==='Dismissed'?'none':'under'}">${esc(s.status)}</span><strong>${s.type==='raise'?'Raise':'Invest'} ${money(s.request.amount)}</strong><span class="event-meta">${esc(s.request.reason)} · created ${esc(s.created)}${s.type==='raise'?' · est. tax '+money(o.tax.tax):''} · drift ${fmt(o.metricsBefore.drift)} → ${fmt(o.metricsAfter.drift)} pp</span></summary>${tradeTable(s,o,false)}${notesPanel(s,o)}</details>`;
 }).join('')}</div>`:'<p class="muted">No cash events yet. Create one above to see suggested trades, an estimated tax figure and the projected allocation.</p>'}</section>`;
 if(scenario&&scenario.type!=='rebalance'){
  const outcome=scenarioOutcome(plan,scenario);
  return `${scenarioHeader(c,scenario,outcome)}
  <section class="card"><div class="target-section-heading"><div><span class="section-step">Suggested trades</span><h2>Adjust, exclude, then recalculate</h2></div><button data-scenario="regenerate">Regenerate from options</button></div>${tradeTable(scenario,outcome,scenario.status!=='Approved')}</section>
  ${notesPanel(scenario,outcome)}${impactPanel(scenario,outcome)}${history}`;
 }
 return `<section class="card"><div class="target-section-heading"><div><span class="section-step">New cash event</span><h2>Raise or invest cash</h2><p>The scenario is a proposal. It does not move money, change holdings or alter the approved client target.</p></div></div>
 ${optionControls('cash')}
 <div class="flex" style="margin-top:16px"><button class="primary" data-scenario="create-cash">Suggest trades</button></div>
 <p class="chart-key">${asOfNote()}</p></section>${history}`;
}

// --- Lifecycle -----------------------------------------------------------
function makeScenario(c,kind){
 const plan=approved(c).plan;
 const built=kind==='rebalance'?rebalanceScenario(plan,{...planningOptions}):cashScenario(plan,{...planningOptions});
 const scenario={...built,id:'sc-'+Date.now(),status:'Draft',created:today(),
  options:{...planningOptions},request:built.request};
 scenariosFor(c).unshift(scenario);
 saveClients();renderClient();
}
function reviewScenario(c){
 const scenario=liveScenario(c),plan=approved(c).plan,o=scenarioOutcome(plan,scenario);
 show(`<div class="target-review-dialog"><span class="section-step">Final review</span><h2>Approve this recommendation</h2>
 <p class="muted">${esc(c.name)} · approval records the decision and writes an audit entry. It does not place a trade, move cash or change recorded holdings.</p>
 <div class="review-impact-grid"><div><small>Sells</small><strong>${money(o.sellTotal)}</strong></div><div><small>Buys</small><strong>${money(o.buyTotal)}</strong></div><div><small>Estimated tax</small><strong>${money(o.tax.tax)}</strong></div><div><small>Drift</small><strong>${fmt(o.metricsBefore.drift)} → ${fmt(o.metricsAfter.drift)} pp</strong></div></div>
 ${o.unfunded>0.05?`<p class="note warning">${money(o.unfunded)} of buys is unfunded. Approving records an infeasible plan.</p>`:''}
 <details class="review-detail" open><summary>Trades · ${o.live.length}</summary>${tradeTable({...scenario,trades:o.live},o,false)}</details>
 <details class="review-detail"><summary>Tax assumptions</summary><dl class="audit-facts"><div><dt>Taxable gain after offsets</dt><dd>${money(o.tax.taxable)}</dd></div><div><dt>Losses used</dt><dd>${money(o.tax.lossesUsed+o.tax.harvested)}</dd></div><div><dt>Exemption used</dt><dd>${money(o.tax.exemptionUsed)}</dd></div></dl><p class="note">Rates and cost basis are the original mockup's illustrative placeholders. A real estimate needs lot-level data and the client's tax profile; treat this as incomplete.</p></details>
 <label class="field">Reason for this recommendation<textarea id="scenarioReason" placeholder="Why this is appropriate for the portfolio"></textarea></label>
 <label class="field">Approver<input id="scenarioApprover" value="${esc(originalData.audit.user)}"></label>
 <p id="scenarioError" class="errors"></p>
 <div class="actions"><button onclick="closeModal()">Back to scenario</button><button class="primary" data-scenario="approve">Approve recommendation</button></div></div>`);
}
function approveScenario(c){
 const reason=$('scenarioReason').value.trim(),approver=$('scenarioApprover').value.trim();
 if(!reason||!approver){$('scenarioError').textContent='Enter a reason and an approver.';return}
 const scenario=liveScenario(c);
 scenario.status='Approved';scenario.reason=reason;scenario.approver=approver;
 scenario.approvedAt=today();scenario.trades=scenario.trades.filter(t=>!t.excluded);
 saveClients();closeModal();renderClient();
 notify('Recommendation approved and recorded. No trade has been placed and holdings are unchanged.');
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button[data-scenario]');if(!b||!activeClient)return;
 const c=client(),action=b.dataset.scenario;
 if(action==='create-rebalance')return makeScenario(c,'rebalance');
 if(action==='create-cash')return makeScenario(c,'cash');
 if(action==='regenerate'){const s=liveScenario(c);if(s){scenariosFor(c).splice(scenariosFor(c).indexOf(s),1);makeScenario(c,s.type==='rebalance'?'rebalance':'cash')}return}
 if(action==='discard'){const s=liveScenario(c);if(s){s.status='Dismissed';saveClients();renderClient();notify('Scenario dismissed. Nothing was changed.')}return}
 if(action==='review')return reviewScenario(c);
 if(action==='approve')return approveScenario(c);
});
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.dataset.opt!==undefined){
  const key=t.dataset.opt;
  planningOptions[key]=t.type==='checkbox'?t.checked:(['minTrade','exemption','carryForward','amount','stages'].includes(key)?Number(t.value)||0:t.value);
  if(key==='direction')planningOptions.reason=originalData.cashPlanning.reasons[planningOptions.direction][0];
  renderClient();return;
 }
 if(!activeClient)return;
 const c=client(),s=liveScenario(c);if(!s)return;
 if(t.dataset.tradeInclude!==undefined){s.trades[Number(t.dataset.tradeInclude)].excluded=!t.checked;saveClients();renderClient();return}
 if(t.dataset.tradeAmount!==undefined){
  const trade=s.trades[Number(t.dataset.tradeAmount)],magnitude=Math.max(0,Number(t.value)||0);
  trade.amount=trade.amount<0?-magnitude:magnitude;saveClients();renderClient();
 }
});

// Replace the two placeholders with the real workspaces.
const renderClientBeforePlanning=renderClient;
renderClient=function(){
 renderClientBeforePlanning();
 if(!activeClient||!['planning','cash'].includes(portfolioArea))return;
 const panel=document.querySelector('.planning-placeholder');
 if(!panel)return;
 const c=client();
 panel.outerHTML=portfolioArea==='planning'?planningArea(c):cashArea(c);
};
