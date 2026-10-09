'use strict';
// Assets & liabilities, and the planning half of Cash & planning.
//
// Income, liabilities and recurring needs are household facts, so an account
// shows its household's plan and says so. Editing here changes that plan; it
// never changes a holding, an approved client target or a model.

const PLAN_KEY='portfolio-financial-plans-v1';
let financialPlans;
try{financialPlans=JSON.parse(localStorage.getItem(PLAN_KEY))||null}catch{financialPlans=null}
if(!financialPlans)financialPlans=copy(financialPlanData.plans);
function savePlans(){
 try{localStorage.setItem(PLAN_KEY,JSON.stringify(financialPlans))}
 catch{notify('Browser saving unavailable. Plan edits remain in this session only.')}
}
const planSettings=()=>financialPlanData.settings;
const planOf=record=>financialPlans[record.householdId];
const householdNameOf=id=>originalData.households.find(h=>h.id===id).name;
const householdAccounts=id=>clientRecords.filter(c=>c.householdId===id);

// The household balance sheet is every account's recorded holdings, counted once
// and aligned to the security list the calculations expect.
function householdVector(id){
 const vector=originalData.securities.map(()=>0);
 for(const record of householdAccounts(id))
  for(const asset of approved(record).plan.assets){
   const index=originalData.securities.findIndex(s=>s.id===asset.securityId);
   if(index>=0)vector[index]+=asset.value;
  }
 return vector;
}

const lakh=v=>'₹'+fmt(v)+' L';
const lakh2=v=>'₹'+Number(v).toFixed(2)+' L';
const signed2=v=>(v>0?'+':'')+Number(v).toFixed(2);
const tile=(label,value,tone)=>`<div><small>${label}</small><strong${tone?` class="${tone}"`:''}>${value}</strong></div>`;
let balanceExpanded=new Set(),monthExpanded=new Set(),categoryExpanded=new Set(),liabilityExpanded=new Set();
let coverChoice='6',coverCustom=20;

// Whose plan this is, and why the reader is looking at it. On the household
// page there is nothing to explain; on an account there is.
function planContext(record){
 const accounts=householdAccounts(record.householdId).length;
 const household=esc(householdNameOf(record.householdId));
 if(record.kind==='Household')
  return `Household plan for <strong>${household}</strong>. Income, liabilities and needs are held here and use all ${accounts} account${accounts===1?'':'s'} together.`;
 return accounts===1
  ?`Household plan for <strong>${household}</strong>.`
  :`Showing the household plan for <strong>${household}</strong>, because income, liabilities and needs are held at household level. <strong>${esc(record.name)}</strong> is one of ${accounts} accounts in it, and an edit here applies to the whole household.`;
}

// The financial plan belongs to the household, so these screens are reachable
// from the household page as well as from an account inside it.
const planRecord=()=>activeClient?client()
 :(typeof reviewHouseholdId!=='undefined'&&reviewHouseholdId?{...reviewRecord(reviewHouseholdId),householdId:reviewHouseholdId}:null);
const planRerender=()=>{if(typeof renderReviewSurface==='function')renderReviewSurface();else renderClient()};

// ---- Assets & liabilities --------------------------------------------------
function balanceArea(record){
 const plan=planOf(record),vector=householdVector(record.householdId);
 const calc=FinancialPlan.project(plan,vector);
 const total=calc.assets;
 const byLiquidity=[0,0,0];
 originalData.securities.forEach((s,i)=>{byLiquidity[s.liquidityCode]+=vector[i]});
 const income=plan.incomeContinuesYears>=1?plan.monthlyIncomeLakh:0;
 const investable=income-calc.commitmentsMonthly;
 return `<section class="card"><div class="target-section-heading"><div><span class="section-step">Balance sheet</span><h2>Assets and liabilities</h2><p>${planContext(record)}</p></div></div>
 <div class="scope-summary">
  ${tile('Total assets',lakh(total))}${tile('Liabilities',lakh(calc.liabilitiesTotal))}${tile('Net worth',lakh(calc.netWorth))}
  ${tile('Liquid assets <small>sellable in about 3 days</small>',lakh(byLiquidity[0]))}
  ${tile('Monthly income',lakh2(income))}${tile('Monthly commitments',lakh2(calc.commitmentsMonthly))}
  ${tile('Monthly investable',signed2(investable)+' L',investable<0?'errors':'ok')}
  ${tile('Liquidity runway',fmt(Math.min(calc.runwayMonths,99))+' months',calc.runwayMonths>=6?'ok':'errors')}
  ${tile('Debt to assets',fmt(total>0?calc.liabilitiesTotal/total*100:0)+'%')}
 </div>
 <div class="liquidity-bar">${['Liquid','Semi-liquid','Locked'].map((label,k)=>`<span style="width:${total?byLiquidity[k]/total*100:0}%;background:${['var(--green)','#b08a2e','#8d9a95'][k]}" title="${label} ${lakh(byLiquidity[k])}"></span>`).join('')}</div>
 <small class="legend">${['Liquid','Semi-liquid','Locked'].map((label,k)=>`<span><i class="dot" style="background:${['var(--green)','#b08a2e','#8d9a95'][k]}"></i>${label} ${lakh(byLiquidity[k])} · ${fmt(total?byLiquidity[k]/total*100:0)}%</span>`).join('')}</small>
 </section>
 ${balanceAssets(vector,total)}
 ${balanceLiabilities(plan,calc,income,byLiquidity[0])}
 ${balanceCashFlow(plan)}
 ${balanceYearly(plan)}`;
}

function balanceAssets(vector,total){
 const rows=[];
 for(const assetClass of originalData.assetHierarchy){
  const classValue=assetClass.c.reduce((sum,type)=>sum+type.c.reduce((s,leaf)=>{
   const i=originalData.securities.findIndex(x=>x.name===leaf.n);return s+(i>=0?vector[i]:0)},0),0);
  if(classValue<=0)continue;
  rows.push({depth:0,key:assetClass.n,name:assetClass.n,value:classValue,hasChildren:true});
  if(!balanceExpanded.has(assetClass.n))continue;
  for(const type of assetClass.c){
   const typeKey=assetClass.n+' / '+type.n;
   const typeValue=type.c.reduce((s,leaf)=>{const i=originalData.securities.findIndex(x=>x.name===leaf.n);return s+(i>=0?vector[i]:0)},0);
   if(typeValue<=0)continue;
   rows.push({depth:1,key:typeKey,name:type.n,value:typeValue,hasChildren:true});
   if(!balanceExpanded.has(typeKey))continue;
   for(const leaf of type.c){
    const i=originalData.securities.findIndex(x=>x.name===leaf.n);
    if(i<0||vector[i]<=0)continue;
    rows.push({depth:2,key:typeKey+' / '+leaf.n,name:leaf.n,value:vector[i],security:originalData.securities[i],index:i});
   }
  }
 }
 return `<section class="card"><div class="flex between"><h2>Assets</h2><div class="flex"><button data-balance="expand">Expand all</button><button data-balance="collapse">Collapse all</button></div></div>
 <div class="tablewrap"><table><thead><tr><th>Asset</th><th class="numeric-head">Value (₹ L)</th><th class="numeric-head">% of assets</th><th>Liquidity</th><th class="numeric-head">Days to cash</th></tr></thead><tbody>${rows.map(row=>{
  const caret=row.hasChildren?`<button class="chev" aria-expanded="${balanceExpanded.has(row.key)}" aria-label="${balanceExpanded.has(row.key)?'Collapse':'Expand'} ${esc(row.name)}" data-balance-node="${esc(row.key)}">${balanceExpanded.has(row.key)?'⌄':'›'}</button>`:'<span class="chev"></span>';
  const s=row.security;
  return `<tr class="${row.depth?'child':'rowtop'}"><td style="padding-left:${8+row.depth*20}px">${caret}${esc(row.name)}${s?.physical?'<span class="holding-tag physical">Physical</span>':''}</td>
  <td class="numeric">${fmt(row.value)}</td><td class="numeric">${fmt(total?row.value/total*100:0)}</td>
  <td>${s?`<span class="state-pill ${s.liquidity==='Locked'?'over':s.liquidity==='Semi-liquid'?'under':'ok'}">${esc(s.liquidity)}</span>`:''}</td>
  <td class="numeric">${s?(s.liquidityCode<2?FinancialPlan.daysToCash(row.index):'—'):''}</td></tr>`;
 }).join('')}<tr class="rowtop"><td><strong>Total assets</strong></td><td class="numeric"><strong>${fmt(total)}</strong></td><td class="numeric">100</td><td></td><td></td></tr></tbody></table></div>
 <p class="note">Days to cash is an expected settlement time by instrument type, not a guarantee. A locked asset has no meaningful number: it cannot be sold on demand at all.</p></section>`;
}

function balanceLiabilities(plan,calc,income,liquid){
 return `<section class="card"><h2>Liabilities</h2>
 <div class="tablewrap"><table><thead><tr><th>Liability</th><th>Type</th><th class="numeric-head">Outstanding (₹ L)</th><th class="numeric-head">Rate</th><th class="numeric-head">EMI a month (₹ L)</th><th class="numeric-head">Months left</th></tr></thead><tbody>${plan.liabilities.length?plan.liabilities.map((l,i)=>{
  const open=liabilityExpanded.has(i);
  const interest=Math.max(0,l.emiLakh*l.monthsLeft-l.outstandingLakh);
  const ends=new Date(2026,9+l.monthsLeft,1);
  return `<tr><td><button class="chev" aria-expanded="${open}" aria-label="Details for ${esc(l.name)}" data-liability="${i}">${open?'⌄':'›'}</button>${esc(l.name)}</td><td>${esc(l.type)}</td><td class="numeric">${fmt(l.outstandingLakh)}</td><td class="numeric">${fmt(l.ratePercent)}%</td><td class="numeric">${l.emiLakh.toFixed(2)}</td><td class="numeric">${l.monthsLeft}</td></tr>`+
  (open?`<tr class="child"><td colspan="6"><div class="mini-facts"><span>Interest still to pay, approximately <strong>${lakh(interest)}</strong></span><span>Ends <strong>${planSettings().monthNames[ends.getMonth()]} ${ends.getFullYear()}</strong></span><span>EMI as a share of income <strong>${income>0?fmt(l.emiLakh/income*100)+'%':'no income recorded'}</strong></span></div></td></tr>`:'');
 }).join(''):'<tr><td colspan="6" class="muted">No liabilities recorded.</td></tr>'}</tbody></table></div>
 <p class="note">Net worth ${lakh(calc.netWorth)} is assets ${lakh(calc.assets)} less liabilities ${lakh(calc.liabilitiesTotal)}. Liquid assets cover ${fmt(calc.liabilitiesTotal>0?liquid/calc.liabilitiesTotal*100:100)}% of what is owed. Edit liabilities on Cash &amp; planning.</p></section>`;
}

function balanceCashFlow(plan){
 const months=FinancialPlan.monthlyPlan(plan);
 const names=planSettings().monthNames;
 const peak=months.reduce((a,m)=>m.outflow>a.outflow?m:a,months[0]);
 const top=Math.max(...months.map(m=>Math.max(m.income,m.outflow)),0.1);
 const colours=['#2f5fa8','#246c53','#b08a2e'],series=['Debt service','Regular needs','Yearly and quarterly bills'];
 const W=720,H=210,left=46,right=10,padTop=12,bottom=26;
 const barWidth=(W-left-right)/12,x=k=>left+barWidth*k+barWidth*0.19,y=v=>padTop+(H-padTop-bottom)*(1-v/(top*1.12));
 const chart=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Projected monthly outflow against income for the next twelve months">
 ${[0,0.5,1].map(g=>`<line x1="${left}" x2="${W-right}" y1="${y(top*g)}" y2="${y(top*g)}" stroke="#dde5df"/><text x="${left-5}" y="${y(top*g)+3}" text-anchor="end" font-size="10" fill="#697a74">${fmt(top*g)}</text>`).join('')}
 ${months.map((m,k)=>{let base=0;const bars=[m.debtService,m.regular,m.periodic].map((v,j)=>{const bar=v>0?`<rect x="${x(k)}" y="${y(base+v)}" width="${barWidth*0.62}" height="${Math.max(0,y(base)-y(base+v))}" fill="${colours[j]}"><title>${names[m.calendarMonth-1]}: ${series[j]} ${lakh2(v)}</title></rect>`:'';base+=v;return bar}).join('');
  return bars+`<line x1="${x(k)-3}" x2="${x(k)+barWidth*0.62+3}" y1="${y(m.income)}" y2="${y(m.income)}" stroke="#20352f" stroke-width="2"><title>${names[m.calendarMonth-1]}: income ${lakh2(m.income)}</title></line><text x="${x(k)+barWidth*0.31}" y="${H-8}" text-anchor="middle" font-size="10" fill="#697a74">${names[m.calendarMonth-1]}</text>`}).join('')}
 </svg><small class="legend">${series.map((n,j)=>`<span><i class="dot" style="background:${colours[j]}"></i>${n}</span>`).join('')}<span><i class="dot dash"></i>Income</span></small>`;
 return `<section class="card"><h2>Projected monthly cash flow, next 12 months</h2>${chart}
 <div class="tablewrap"><table><thead><tr><th>Month</th><th class="numeric-head">Income</th><th class="numeric-head">Debt service</th><th class="numeric-head">Regular needs</th><th class="numeric-head">Yearly and quarterly bills</th><th class="numeric-head">Total outflow</th><th class="numeric-head">Net</th><th class="numeric-head">Cumulative</th></tr></thead><tbody>${months.map((m,k)=>{
  const open=monthExpanded.has(k);
  return `<tr><td><button class="chev" aria-expanded="${open}" aria-label="Items due in ${names[m.calendarMonth-1]}" data-month="${k}">${open?'⌄':'›'}</button>${names[m.calendarMonth-1]} ${m.year}${m.periodic>0?' <span class="holding-tag">bills due</span>':''}</td>
  <td class="numeric">${m.income.toFixed(2)}</td><td class="numeric">${m.debtService.toFixed(2)}</td><td class="numeric">${m.regular.toFixed(2)}</td><td class="numeric">${m.periodic.toFixed(2)}</td><td class="numeric"><strong>${m.outflow.toFixed(2)}</strong></td>
  <td class="numeric ${m.net<0?'errors':'ok'}">${signed2(m.net)}</td><td class="numeric ${m.cumulative<0?'errors':''}">${m.cumulative.toFixed(2)}</td></tr>`+
  (open?`<tr class="child"><td colspan="8"><div class="mini-facts">${m.items.map(x=>`<span>${esc(x.name)} <small class="muted">${esc(x.category)}</small> <strong>${lakh2(x.amount)}</strong></span>`).join('')||'<span class="muted">Nothing due this month.</span>'}</div></td></tr>`:'');
 }).join('')}</tbody></table></div>
 <p class="note">Year one only, before inflation. The heaviest month is <strong>${names[peak.calendarMonth-1]}</strong> at ${lakh2(peak.outflow)}, because yearly and quarterly bills fall then. An average would hide that.</p></section>`;
}

function balanceYearly(plan){
 const y=FinancialPlan.yearlyExpenses(plan);
 const domestic=planSettings().domesticCategories;
 return `<section class="card"><h2>Yearly expenses</h2>
 <div class="scope-summary">${tile('Needs this year',lakh(y.needsThisYear))}${tile('Debt service this year',lakh(y.debtThisYear))}${tile('Total yearly outflow',lakh(y.totalThisYear))}${tile('Domestic running costs',lakh(y.domestic))}${tile('Total in 5 years <small>inflated</small>',lakh(y.needsInFiveYears+y.debtInFiveYears))}</div>
 <div class="tablewrap"><table><thead><tr><th>Category</th><th class="numeric-head">This year (₹ L)</th><th class="numeric-head">Per month (₹ L)</th><th class="numeric-head">Share of outflow</th><th class="numeric-head">In 5 years (₹ L)</th></tr></thead><tbody>${y.categories.map(group=>{
  const open=categoryExpanded.has(group.category),share=y.totalThisYear>0?group.thisYear/y.totalThisYear*100:0;
  return `<tr><td><button class="chev" aria-expanded="${open}" aria-label="Items in ${esc(group.category)}" data-category="${esc(group.category)}">${open?'⌄':'›'}</button>${esc(group.category)}${domestic.includes(group.category)?' <span class="holding-tag">running cost</span>':''}</td>
  <td class="numeric">${fmt(group.thisYear)}</td><td class="numeric">${(group.thisYear/12).toFixed(2)}</td>
  <td class="numeric"><span class="share-bar"><i style="width:${Math.min(share*2,100)}%"></i></span>${fmt(share)}%</td>
  <td class="numeric">${fmt(group.inFiveYears)}</td></tr>`+
  (open?`<tr class="child"><td colspan="5"><div class="mini-facts">${group.items.map(({need,thisYear})=>`<span>${esc(need.name)} <small class="muted">${need.frequency==='Monthly'?'monthly':need.frequency.toLowerCase()+', '+planSettings().monthNames[(need.dueMonth??4)-1]}</small> <strong>${thisYear?lakh(thisYear):'not active this year'}</strong></span>`).join('')}</div></td></tr>`:'');
 }).join('')}
 <tr class="rowtop"><td><strong>Needs total</strong></td><td class="numeric"><strong>${fmt(y.needsThisYear)}</strong></td><td class="numeric">${(y.needsThisYear/12).toFixed(2)}</td><td></td><td class="numeric">${fmt(y.needsInFiveYears)}</td></tr>
 <tr><td>Debt service</td><td class="numeric">${fmt(y.debtThisYear)}</td><td class="numeric">${(y.debtThisYear/12).toFixed(2)}</td><td></td><td class="numeric">${fmt(y.debtInFiveYears)}</td></tr>
 <tr class="rowtop"><td><strong>Total yearly outflow</strong></td><td class="numeric"><strong>${fmt(y.totalThisYear)}</strong></td><td class="numeric">${(y.totalThisYear/12).toFixed(2)}</td><td></td><td class="numeric">${fmt(y.needsInFiveYears+y.debtInFiveYears)}</td></tr>
 </tbody></table></div>
 <p class="note">The five-year column applies each item's own inflation rate and includes needs that start by then, such as education. Add or edit items on Cash &amp; planning.</p></section>`;
}

// ---- Cash & planning: the plan behind the cash events -----------------------
// Named for what it is rather than for its tab. `planningArea` is already a
// global: planning.js declares one for the gap summary and trade
// recommendations, and this file loads after it, so sharing the name meant this
// function silently replaced that one and tab 3 rendered the financial plan.
function financialPlanArea(record){
 const plan=planOf(record),vector=householdVector(record.householdId);
 const calc=FinancialPlan.project(plan,vector);
 const flags=FinancialPlan.flags(plan,calc);
 const reserveRatio=calc.emergencyTarget>0?calc.reserve/calc.emergencyTarget:2;
 const income=plan.incomeContinuesYears>=1?plan.monthlyIncomeLakh:0;
 const investable=Math.max(0,income-calc.commitmentsMonthly);
 const field=(key,label,value,step,placeholder)=>`<label class="field">${label}<input type="number" min="0" step="${step}" data-plan-field="${key}" value="${value??''}"${placeholder?` placeholder="${esc(placeholder)}"`:''}></label>`;
 return `<section class="card"><div class="target-section-heading"><div><span class="section-step">Household plan</span><h2>Income and assumptions</h2><p>${planContext(record)}</p></div></div>
 <div class="scope-summary">${tile('Net worth',lakh(calc.netWorth))}${tile('Liabilities',lakh(calc.liabilitiesTotal))}${tile('Monthly commitments',lakh2(calc.commitmentsMonthly))}${tile('Emergency buffer',fmt(Math.min(reserveRatio,9.99)*100)+'% of target',reserveRatio>=1?'ok':'errors')}${tile('Plan',calc.gapYear?'Gap from year '+calc.gapYear:'Funded for '+calc.horizonYears+' years',calc.gapYear?'errors':'ok')}</div>
 <div class="plan-inputs">
  ${field('monthlyIncomeLakh','Monthly income (₹ L)',plan.monthlyIncomeLakh,'0.1')}
  ${field('incomeContinuesYears','Income continues (years)',plan.incomeContinuesYears,'1')}
  ${field('incomeGrowthPercent','Income growth % a year',plan.incomeGrowthPercent,'0.5')}
  ${field('monthlyInvestmentTargetLakh','Monthly investment target (₹ L)',plan.monthlyInvestmentTargetLakh,'0.05',(investable*0.8).toFixed(2)+' — 80% of investable')}
  ${field('portfolioReturnPercent','Portfolio return % a year',plan.portfolioReturnPercent,'0.5',calc.blendedReturn.toFixed(1)+' — blended from holdings')}
 </div>
 <p class="note">Leave the last two blank to use the defaults shown. The ${planSettings().emergencyMonths}-month emergency target and the sources for raising cash use investable holdings only: EPF, AIF and real estate are left out because they cannot be sold on demand. Every figure is illustrative.</p></section>
 <section class="card"><h2>Planning flags</h2>${flags.map(f=>`<div class="plan-flag"><span class="state-pill ${f.level==='attention'?'over':f.level==='check'?'under':'ok'}">${f.level==='attention'?'Attention':f.level==='check'?'Check':'OK'}</span><div>${f.text}${f.shortfallLakh?`, a shortfall of ${lakh(f.shortfallLakh)}. <button class="primary" data-plan-raise="${f.shortfallLakh.toFixed(1)}">Plan a cash raise</button>`:f.text.startsWith('Next 12 months')?'.':''}</div></div>`).join('')}</section>
 ${projectionCard(calc)}
 ${contingencyCard(record,vector,calc)}
 ${recurringCard(record,plan,calc,vector)}
 ${liabilityEditor(plan)}
 ${needsEditor(plan)}`;
}

// The long projection, shown as the shape of the balance rather than 30 rows.
function projectionCard(calc){
 const years=calc.years,W=720,H=170,left=52,right=10,padTop=12,bottom=24;
 const peak=Math.max(...years.map(y=>y.balance),1);
 const low=Math.min(0,...years.map(y=>y.balance));
 const x=i=>left+(W-left-right)*(i/(years.length-1));
 const y=v=>padTop+(H-padTop-bottom)*(1-(v-low)/((peak-low)||1));
 const line=years.map((p,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(p.balance).toFixed(1)}`).join(' ');
 return `<section class="card"><h2>Projected investable portfolio, next ${calc.horizonYears} years</h2>
 <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Projected investable portfolio over ${calc.horizonYears} years">
  <line x1="${left}" x2="${W-right}" y1="${y(0)}" y2="${y(0)}" stroke="#c9d6cd"/>
  <text x="${left-6}" y="${y(0)+3}" text-anchor="end" font-size="10" fill="#697a74">0</text>
  <text x="${left-6}" y="${y(peak)+3}" text-anchor="end" font-size="10" fill="#697a74">${fmt(peak)}</text>
  <path d="${line}" fill="none" stroke="${calc.gapYear?'#9c422a':'#246c53'}" stroke-width="2"/>
  ${calc.gapYear?`<line x1="${x(calc.gapYear-1)}" x2="${x(calc.gapYear-1)}" y1="${padTop}" y2="${H-bottom}" stroke="#9c422a" stroke-dasharray="4 3"/><text x="${x(calc.gapYear-1)+5}" y="${padTop+11}" font-size="11" fill="#9c422a">Gap from year ${calc.gapYear}</text>`:''}
  ${[0,9,19,29].filter(i=>i<years.length).map(i=>`<text x="${x(i)}" y="${H-7}" text-anchor="middle" font-size="10" fill="#697a74">yr ${i+1}</text>`).join('')}
 </svg>
 <p class="note">${calc.gapYear?`Income, debt service and needs exhaust the investable portfolio in year ${calc.gapYear} at about ${fmt(calc.returnPercent)}% a year. It is a projection on today's assumptions, not a forecast.`:`Funded across the full horizon at about ${fmt(calc.returnPercent)}% a year, with ${lakh(years.at(-1).balance)} left in year ${calc.horizonYears}.`} Locked assets are excluded, so the real position is stronger than the line suggests.</p></section>`;
}

function contingencyCard(record,vector,calc){
 const cover=coverChoice==='c'?{custom:true,amountLakh:coverCustom}:{months:Number(coverChoice)};
 const k=FinancialPlan.contingency(vector,calc,cover);
 const why=u=>u.penalty?'Breaking a deposit early forfeits interest':u.gain<=0.001?'No gain to tax':u.security.illustrativeTaxRatePercent===20?'Short-term gain, taxed at 20%':'Long-term gain';
 return `<section class="card"><h2>Contingency: raise cash</h2>
 <div class="flex toolbar"><span class="muted">Cover</span><div class="segmented" role="group" aria-label="How much cover to raise">${[['3','3 months'],['6','6 months'],['12','12 months'],['c','Custom']].map(([v,l])=>`<button data-cover="${v}" aria-pressed="${coverChoice===v}">${l}</button>`).join('')}</div>
 ${coverChoice==='c'?`<label class="field">Amount (₹ L)<input type="number" min="0.5" step="0.5" id="coverCustom" value="${coverCustom}"></label>`:`<small class="muted">of commitments at ${lakh2(calc.commitmentsMonthly)} a month, so ${lakh(k.amount)}</small>`}</div>
 <div class="scope-summary">${tile('Raised',lakh(k.amount-k.shortfall))}${tile('Tax and penalty cost',lakh2(k.costLakh))}${tile('Cash in',k.days+' days')}${tile('Holdings used',String(k.used.length))}</div>
 ${k.used.length?`<div class="tablewrap"><table><thead><tr><th class="numeric-head">Order</th><th>Source</th><th class="numeric-head">Days to cash</th><th class="numeric-head">Amount (₹ L)</th><th class="numeric-head">Tax and penalty (₹ L)</th><th class="numeric-head">Cumulative (₹ L)</th><th>Why this order</th></tr></thead><tbody>${k.used.map((u,i)=>`<tr><td class="numeric">${i+1}</td><td>${esc(u.security.name)}</td><td class="numeric">${u.days}</td><td class="numeric">${fmt(u.amountLakh)}</td><td class="numeric">${u.costLakh.toFixed(2)}</td><td class="numeric">${fmt(u.cumulativeLakh)}</td><td>${why(u)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Nothing needs to be raised.</p>'}
 ${k.shortfall>0.05?`<div class="note warning">Short by ${lakh(k.shortfall)}. Liquid and semi-liquid holdings total ${lakh(k.available)}; locked assets are left out. A loan against securities, or a smaller or phased amount, may be worth comparing.</div>`:''}
 <p class="note">Ordered cheapest first by the estimated tax and exit penalty on each holding's gain, then by how fast it settles. The estimate ignores the long-term exemption and loss set-off, so the real cost is usually lower. First-line reserve: ${lakh(calc.emergencyTarget)} for ${planSettings().emergencyMonths} months, against ${lakh(calc.reserve)} held in deposits and bonds today. Nothing here places a trade.</p>
 <div class="flex"><button class="primary" data-plan-raise="${k.amount.toFixed(1)}" ${k.amount>0?'':'disabled'}>Plan this cash raise</button></div></section>`;
}

function recurringCard(record,plan,calc,vector){
 const classes=originalData.assetHierarchy.map(assetClass=>{
  const valueLakh=assetClass.c.reduce((sum,type)=>sum+type.c.reduce((s,leaf)=>{
   const i=originalData.securities.findIndex(x=>x.name===leaf.n);return s+(i>=0?vector[i]:0)},0),0);
  return {name:assetClass.n,valueLakh,targetPercent:assetClass.tg};
 });
 const r=FinancialPlan.recurring(plan,calc,classes);
 return `<section class="card"><h2>Recurring investment</h2>
 <div class="scope-summary">${tile('Monthly income',lakh2(r.income))}${tile('Commitments',lakh2(calc.commitmentsMonthly))}${tile('Monthly investable',signed2(r.surplus)+' L',r.surplus<0?'errors':'ok')}${tile('Monthly investment target',lakh2(r.monthly)+(r.surplus>0?' · '+fmt(r.monthly/r.surplus*100)+'% of investable':''))}</div>
 ${r.monthly<=0
  ?`<div class="note warning">${r.surplus<=0?`Commitments exceed income by ${lakh2(-r.surplus)} a month, so the portfolio is being drawn down rather than added to. See the planning flags and the contingency plan above.`:'Set a monthly investment target above zero to see where it would go.'}</div>`
  :(r.monthly>Math.max(0,r.surplus)+0.005?`<div class="note warning">The target is ${lakh2(r.monthly-Math.max(0,r.surplus))} a month above what is investable, so the difference would have to come out of existing holdings.</div>`:'')+
 `<div class="tablewrap"><table><thead><tr><th>Asset class</th><th class="numeric-head">Current %</th><th class="numeric-head">Target %</th><th class="numeric-head">Below target by (₹ L)</th><th class="numeric-head">Monthly investment (₹ L)</th></tr></thead><tbody>${classes.map((c,i)=>`<tr><td>${esc(c.name)}</td><td class="numeric">${fmt(r.total?c.valueLakh/r.total*100:0)}</td><td class="numeric">${fmt(c.targetPercent)}</td><td class="numeric">${r.gaps[i]>0.005?fmt(r.gaps[i]):'—'}</td><td class="numeric">${r.allocation[i]>0.005?r.allocation[i].toFixed(2):'—'}</td></tr>`).join('')}</tbody></table></div>
 <p class="note">Directed at the asset classes furthest below the approved client target. A plan, not an instruction: nothing is bought until it goes through Gap summary and trades.</p>`}</section>`;
}

function liabilityEditor(plan){
 const input=(i,key,value,kind)=>`<input ${kind==='text'?'':'type="number" min="0" step="any" class="target"'} data-liability-index="${i}" data-liability-field="${key}" value="${esc(value)}">`;
 return `<section class="card"><div class="flex between"><h2>Liabilities</h2><button data-plan-add="liability">＋ Add liability</button></div>
 <div class="tablewrap plan-editor"><table><thead><tr><th>Liability</th><th>Type</th><th class="numeric-head">Outstanding (₹ L)</th><th class="numeric-head">Rate %</th><th class="numeric-head">EMI a month (₹ L)</th><th class="numeric-head">Months left</th><th></th></tr></thead><tbody>${plan.liabilities.length?plan.liabilities.map((l,i)=>`<tr><td>${input(i,'name',l.name,'text')}</td><td><select data-liability-index="${i}" data-liability-field="type">${planSettings().liabilityTypes.map(t=>`<option ${t===l.type?'selected':''}>${esc(t)}</option>`).join('')}</select></td><td>${input(i,'outstandingLakh',l.outstandingLakh)}</td><td>${input(i,'ratePercent',l.ratePercent)}</td><td>${input(i,'emiLakh',l.emiLakh)}</td><td>${input(i,'monthsLeft',l.monthsLeft)}</td><td><button data-plan-remove="liability" data-index="${i}">Remove</button></td></tr>`).join(''):'<tr><td colspan="7" class="muted">No liabilities recorded.</td></tr>'}</tbody></table></div></section>`;
}

function needsEditor(plan){
 const input=(i,key,value,kind)=>`<input ${kind==='text'?'':'type="number" min="0" step="any" class="target"'} data-need-index="${i}" data-need-field="${key}" value="${esc(value)}">`;
 const months=planSettings().monthNames;
 return `<section class="card"><div class="flex between"><h2>Recurring needs</h2><button data-plan-add="need">＋ Add need</button></div>
 <div class="tablewrap plan-editor-wide"><table><thead><tr><th>Need</th><th>Category</th><th class="numeric-head">Amount (₹ L)</th><th>Frequency</th><th>Due month</th><th class="numeric-head">Starts in (yrs)</th><th class="numeric-head">Lasts (yrs)</th><th class="numeric-head">Inflation %</th><th></th></tr></thead><tbody>${plan.recurringNeeds.length?plan.recurringNeeds.map((n,i)=>`<tr><td>${input(i,'name',n.name,'text')}</td>
 <td><select data-need-index="${i}" data-need-field="category">${planSettings().needCategories.map(c=>`<option ${c===n.category?'selected':''}>${esc(c)}</option>`).join('')}</select></td>
 <td>${input(i,'amountLakh',n.amountLakh)}</td>
 <td><select data-need-index="${i}" data-need-field="frequency">${Object.keys(planSettings().frequencyPerYear).map(f=>`<option ${f===n.frequency?'selected':''}>${esc(f)}</option>`).join('')}</select></td>
 <td>${n.frequency==='Monthly'?'<span class="muted">every month</span>':`<select data-need-index="${i}" data-need-field="dueMonth">${months.map((m,k)=>`<option value="${k+1}" ${k+1===(n.dueMonth??4)?'selected':''}>${m}</option>`).join('')}</select>`}</td>
 <td>${input(i,'startsInYears',n.startsInYears)}</td><td>${input(i,'lastsYears',n.lastsYears)}</td><td>${input(i,'inflationPercent',n.inflationPercent)}</td>
 <td><button data-plan-remove="need" data-index="${i}">Remove</button></td></tr>`).join(''):'<tr><td colspan="9" class="muted">No recurring needs recorded.</td></tr>'}</tbody></table></div>
 <p class="note">A need with a start year and a duration is how a goal is recorded: school fees beginning in three years and lasting four are the same shape as a cost that runs throughout. Each carries its own inflation rate.</p></section>`;
}

// ---- Wiring ----------------------------------------------------------------
// Five tabs: the revised mockup's four, plus the client-target surface it does
// not have because it approves nothing. Exposure drift is gone as a tab — it was
// never a view of its own, only a second way into Allocation's exposure mode —
// and target history now sits beside the approval it belongs to.
portfolioTabs=function(){return `<nav class="portfolio-tabs portfolio-tabs-five" aria-label="Portfolio work areas">${[
 ['balance','1 Assets & liabilities'],['allocation','2 Allocation & drift'],['planning','3 Gap summary & trades'],
 ['cash','4 Cash & planning'],['target','5 Client target']
].map(([key,label])=>`<button data-portfolio-area="${key}" aria-current="${portfolioArea===key?'page':'false'}">${label}${key==='target'&&client().draft?' <span class="draft-dot" aria-label="Draft exists"></span>':''}</button>`).join('')}</nav>`};

const renderClientBeforeFinancial=renderClient;
renderClient=function(){
 // The balance sheet replaces the workspace body, so render a known area first
 // and swap the content, rather than teaching every earlier layer a new area.
 const requested=portfolioArea;
 if(requested==='balance')portfolioArea='allocation';
 renderClientBeforeFinancial();
 portfolioArea=requested;
 if(!activeClient)return;
 document.querySelectorAll('[data-portfolio-area]').forEach(b=>b.setAttribute('aria-current',b.dataset.portfolioArea===requested?'page':'false'));
 const record=client();
 if(requested==='balance'){
  const tabs=document.querySelector('.portfolio-tabs');
  if(!tabs)return;
  let node=tabs.nextElementSibling;
  while(node){const next=node.nextElementSibling;node.remove();node=next}
  tabs.insertAdjacentHTML('afterend',balanceArea(record));
  $('footer').innerHTML='';
  return;
 }
 if(requested==='cash'&&!$('app').querySelector('.plan-inputs')){
  $('app').insertAdjacentHTML('beforeend',financialPlanArea(record));
 }
};

const financialPlanRerender=()=>{savePlans();planRerender()};
document.addEventListener('click',e=>{
 const button=e.target.closest('button');
 const record=planRecord();
 if(!button||!record)return;
 const plan=planOf(record);
 const toggle=(set,key)=>{set.has(key)?set.delete(key):set.add(key);planRerender()};
 if(button.dataset.balanceNode!==undefined)return toggle(balanceExpanded,button.dataset.balanceNode);
 if(button.dataset.month!==undefined)return toggle(monthExpanded,Number(button.dataset.month));
 if(button.dataset.category!==undefined)return toggle(categoryExpanded,button.dataset.category);
 if(button.dataset.liability!==undefined)return toggle(liabilityExpanded,Number(button.dataset.liability));
 if(button.dataset.balance==='expand'){
  balanceExpanded=new Set(originalData.assetHierarchy.flatMap(c=>[c.n,...c.c.map(t=>c.n+' / '+t.n)]));
  planRerender();return;
 }
 if(button.dataset.balance==='collapse'){balanceExpanded=new Set();planRerender();return}
 if(button.dataset.cover){coverChoice=button.dataset.cover;planRerender();return}
 if(button.dataset.planAdd==='liability'){
  plan.liabilities.push({name:'New liability',type:'Personal loan',outstandingLakh:0,ratePercent:10,emiLakh:0,monthsLeft:12});
  financialPlanRerender();return;
 }
 if(button.dataset.planAdd==='need'){
  plan.recurringNeeds.push({name:'New need',category:'Other',amountLakh:0,frequency:'Monthly',startsInYears:0,lastsYears:5,inflationPercent:6,dueMonth:4});
  financialPlanRerender();return;
 }
 if(button.dataset.planRemove){
  (button.dataset.planRemove==='liability'?plan.liabilities:plan.recurringNeeds).splice(Number(button.dataset.index),1);
  financialPlanRerender();return;
 }
 if(button.dataset.planRaise){
  // Carry the amount into the cash workflow instead of making the adviser
  // read it off one card and retype it into another.
  portfolioArea='cash';planRerender();
  const amount=$('cashAmount')||document.querySelector('[data-cash-field="amount"]');
  if(amount){amount.value=button.dataset.planRaise;amount.dispatchEvent(new Event('change',{bubbles:true}));amount.scrollIntoView({behavior:'smooth',block:'center'});amount.focus()}
  else notify('Enter '+lakh(Number(button.dataset.planRaise))+' as the amount to raise.');
 }
});

document.addEventListener('change',e=>{
 const target=e.target;
 const record=planRecord();
 if(!record)return;
 if(target.id==='coverCustom'){coverCustom=Math.max(0.5,Number(target.value)||20);planRerender();return}
 const plan=planOf(record);
 if(target.dataset.planField){
  const key=target.dataset.planField;
  const blank=target.value==='';
  // Return and investment target fall back to a derived default when cleared;
  // the rest are plain numbers.
  plan[key]=blank&&['portfolioReturnPercent','monthlyInvestmentTargetLakh'].includes(key)?null:Math.max(0,Number(target.value)||0);
  financialPlanRerender();return;
 }
 if(target.dataset.liabilityIndex!==undefined){
  const liability=plan.liabilities[Number(target.dataset.liabilityIndex)],key=target.dataset.liabilityField;
  liability[key]=['name','type'].includes(key)?target.value:Math.max(0,Number(target.value)||0);
  financialPlanRerender();return;
 }
 if(target.dataset.needIndex!==undefined){
  const need=plan.recurringNeeds[Number(target.dataset.needIndex)],key=target.dataset.needField;
  need[key]=['name','category','frequency'].includes(key)?target.value:Math.max(0,Number(target.value)||0);
  financialPlanRerender();
 }
});
