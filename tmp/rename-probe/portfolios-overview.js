'use strict';
// The Portfolios overview gains a financial-plan column.
//
// Drift answers "is this portfolio still shaped the way we agreed". It does not
// answer "can this family afford what they are committed to", and a portfolio
// can be perfectly on model while running out of money in year five. The two
// belong side by side so neither is read alone.
//
// The plan is a household fact, so a household row states it and an account row
// reports its household's position, labelled as such.

const planSummaryCache=new Map();
function householdPlanSummary(householdId){
 if(planSummaryCache.has(householdId))return planSummaryCache.get(householdId);
 const plan=financialPlans[householdId];
 if(!plan)return null;
 const calc=FinancialPlan.project(plan,householdVector(householdId));
 const summary={
  gapYear:calc.gapYear,
  runwayMonths:calc.runwayMonths,
  horizonYears:calc.horizonYears,
  commitmentsMonthly:calc.commitmentsMonthly,
  reserveCovered:calc.emergencyTarget<=0||calc.reserve>=calc.emergencyTarget,
 };
 planSummaryCache.set(householdId,summary);
 return summary;
}
// Holdings and plans both change under the adviser's hands, so the cache lives
// only for the render that built it.
const clearPlanSummaries=()=>planSummaryCache.clear();

function financialPlanCell(record){
 // A household row is keyed by the household; an account row carries its client
 // record, which is where the household id lives.
 const householdId=record.kind==='Household'?record.id:record.members[0]?.householdId;
 const summary=householdPlanSummary(householdId);
 if(!summary)return '<td data-label="Financial plan"><span class="muted">Not recorded</span></td>';
 const funded=!summary.gapYear;
 const runway=Math.min(summary.runwayMonths,99);
 const thin=runway<6;
 return `<td data-label="Financial plan"><span class="badge ${funded?'':'draft'}">${funded?'Funded':'Gap from year '+summary.gapYear}</span>
  <small class="${thin?'errors':''}">${fmt(runway)} months of runway${thin?', under six':''}</small>
  ${record.kind==='Household'?'':`<small class="muted">${esc(householdNameOf(householdId))} plan</small>`}</td>`;
}

// Both the header and the body gain one cell, and the expansion row that spans
// the table has to widen with them.
const overviewBeforePlan=renderClients;
renderClients=function(){
 clearPlanSummaries();
 overviewBeforePlan();
 if(activeClient)return;
 const main=$('app');
 main.innerHTML=main.innerHTML
  .replace('<th>Attention</th>','<th>Financial plan</th><th>Attention</th>')
  .replace(/colspan="6"/g,'colspan="7"');
};

const rowBeforePlan=dashboardRow;
dashboardRow=function(record){
 const markup=rowBeforePlan(record);
 const attention=markup.indexOf('<td data-label="Attention">');
 if(attention<0)return markup;
 return markup.slice(0,attention)+financialPlanCell(record)+markup.slice(attention);
};

// A plan edit made inside a portfolio changes what the list should say, so the
// cache is dropped whenever a plan is saved.
const savePlansBeforeOverview=savePlans;
savePlans=function(){clearPlanSummaries();return savePlansBeforeOverview()};
