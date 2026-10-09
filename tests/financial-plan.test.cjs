const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/original-mockup.json'),'utf8'));
const plans=JSON.parse(fs.readFileSync(path.join(root,'data/financial-plans.json'),'utf8'));

// The engine is pure, so it needs no DOM: only the two datasets.
function engine(){
 const originalData=structuredClone(data),financialPlanData=structuredClone(plans);
 const ctx=vm.createContext({originalData,financialPlanData,console});
 vm.runInContext(fs.readFileSync(path.join(root,'financial-plan.js'),'utf8'),ctx);
 // Every account in a household, aligned to the security list.
 ctx.vectorFor=id=>{
  const vector=originalData.securities.map(()=>0);
  for(const account of originalData.accounts.filter(a=>a.householdId===id))
   for(const holding of account.holdings){
    const i=originalData.securities.findIndex(s=>s.id===holding.securityId);
    if(i>=0)vector[i]+=holding.valueLakh;
   }
  return vector;
 };
 return {run:code=>vm.runInContext(code,ctx),ctx,originalData,financialPlanData};
}

test('Every household has a plan, held at household level',()=>{
 assert.equal(Object.keys(plans.plans).length,6);
 for(const household of data.households){
  const plan=plans.plans[household.id];
  assert.ok(plan,'no plan for '+household.name);
  assert.equal(plan.householdName,household.name);
  assert.ok(plan.monthlyIncomeLakh>=0&&Number.isFinite(plan.incomeContinuesYears));
  for(const need of plan.recurringNeeds){
   assert.ok(plans.settings.needCategories.includes(need.category),need.category);
   assert.ok(plans.settings.frequencyPerYear[need.frequency],need.frequency);
   // A monthly need has no due month; anything periodic must have one.
   if(need.frequency!=='Monthly')assert.ok(need.dueMonth>=1&&need.dueMonth<=12,need.name);
  }
  for(const liability of plan.liabilities)assert.ok(plans.settings.liabilityTypes.includes(liability.type),liability.type);
 }
});

test('The projection finds the year a household runs out, or confirms it does not',()=>{
 const {run}=engine();
 const gaps={};
 for(const id of Object.keys(plans.plans))gaps[id]=run(`FinancialPlan.project(financialPlanData.plans["${id}"],vectorFor("${id}")).gapYear`);
 // Nair has no continuing income, so the portfolio is drawn down early.
 assert.equal(gaps.h5,5);
 assert.equal(gaps.h2,16);
 assert.equal(gaps.h4,30);
 for(const id of ['h1','h3','h6'])assert.equal(gaps[id],null,id+' should be funded across the horizon');
 const nair=run('FinancialPlan.project(financialPlanData.plans.h5,vectorFor("h5"))');
 assert.equal(nair.years.length,plans.settings.horizonYears);
 assert.ok(nair.years[nair.gapYear-1].balance<0&&nair.years[nair.gapYear-2].balance>=0,'the gap year is the first negative one');
 // Locked assets are excluded from what can fund the plan.
 assert.ok(nair.investable<nair.assets);
});

test('Net worth, runway and the emergency target come off the holdings',()=>{
 const {run}=engine();
 const mehta=run('FinancialPlan.project(financialPlanData.plans.h1,vectorFor("h1"))');
 assert.equal(Math.round(mehta.netWorth),315);
 assert.equal(Math.round(mehta.assets-mehta.liabilitiesTotal),315);
 assert.ok(Math.abs(mehta.runwayMonths-53.6)<0.1);
 assert.ok(Math.abs(mehta.emergencyTarget-mehta.commitmentsMonthly*plans.settings.emergencyMonths)<1e-9);
 assert.ok(mehta.commitmentsMonthly>0&&mehta.emiMonthly>0&&mehta.needsMonthly>0);
 // The reserve counts debt holdings that are not locked, nothing else.
 assert.ok(mehta.reserve>0&&mehta.reserve<=mehta.investable);
});

test('The twelve-month plan keeps periodic bills in the month they fall',()=>{
 const {run}=engine();
 const months=run('FinancialPlan.monthlyPlan(financialPlanData.plans.h1)');
 assert.equal(months.length,12);
 // Starts at the top of the financial year, not the calendar year.
 assert.equal(months[0].calendarMonth,plans.settings.financialYearMonthOrder[0]);
 const heaviest=months.reduce((a,m)=>m.outflow>a.outflow?m:a,months[0]);
 assert.ok(heaviest.periodic>0,'the heaviest month is heavy because of periodic bills');
 assert.ok(months.some(m=>m.periodic===0),'not every month carries them');
 for(const m of months){
  assert.ok(Math.abs(m.outflow-(m.debtService+m.regular+m.periodic))<1e-9);
  assert.ok(Math.abs(m.net-(m.income-m.outflow))<1e-9);
 }
 const total=months.reduce((s,m)=>s+m.net,0);
 assert.ok(Math.abs(months.at(-1).cumulative-total)<1e-9,'cumulative is the running sum of net');
});

test('Yearly expenses separate running costs from goals and inflate each on its own rate',()=>{
 const {run}=engine();
 const yearly=run('FinancialPlan.yearlyExpenses(financialPlanData.plans.h1)');
 assert.ok(Math.abs(yearly.totalThisYear-(yearly.needsThisYear+yearly.debtThisYear))<1e-9);
 assert.ok(Math.abs(yearly.needsThisYear-yearly.categories.reduce((s,c)=>s+c.thisYear,0))<1e-9);
 assert.ok(yearly.categories.every((c,i,a)=>i===0||a[i-1].thisYear>=c.thisYear),'sorted by this year descending');
 assert.ok(yearly.domestic>0&&yearly.domestic<yearly.needsThisYear);
 // Education starts in year 3, so it costs nothing this year and something later.
 const education=yearly.categories.find(c=>c.category==='Education');
 const later=education.items.find(i=>i.need.startsInYears>0);
 assert.ok(later&&later.thisYear===0&&later.inFiveYears>0,'a need that starts later shows up only in the five-year column');
});

test('Raising cash never touches a locked asset and goes cheapest first',()=>{
 const {run}=engine();
 const calc=run('FinancialPlan.project(financialPlanData.plans.h1,vectorFor("h1"))');
 const plan=run('FinancialPlan.contingency(vectorFor("h1"),FinancialPlan.project(financialPlanData.plans.h1,vectorFor("h1")),{months:6})');
 assert.ok(Math.abs(plan.amount-calc.commitmentsMonthly*6)<1e-9);
 assert.equal(plan.shortfall,0);
 assert.ok(plan.used.length>0);
 assert.ok(!plan.used.some(u=>u.security.liquidityCode===2),'a locked asset is never sold');
 assert.ok(plan.used.every((u,i,a)=>i===0||a[i-1].costRate<=u.costRate),'cheapest first');
 const raised=plan.used.reduce((s,u)=>s+u.amountLakh,0);
 assert.ok(Math.abs(raised-plan.amount)<0.001,'it raises exactly what was asked for');
 assert.ok(Math.abs(plan.used.at(-1).cumulativeLakh-raised)<0.001);
 // Asking for more than exists reports a shortfall rather than inventing cash.
 const huge=run('FinancialPlan.contingency(vectorFor("h1"),FinancialPlan.project(financialPlanData.plans.h1,vectorFor("h1")),{custom:true,amountLakh:100000})');
 assert.ok(huge.shortfall>0);
 assert.ok(Math.abs(huge.available-huge.used.reduce((s,u)=>s+u.amountLakh,0))<0.001);
});

test('Recurring investment goes to the classes furthest below target',()=>{
 const {run,ctx}=engine();
 ctx.classes=[{name:'Equity',valueLakh:50,targetPercent:50},{name:'Fixed income',valueLakh:10,targetPercent:25},
  {name:'Alternatives',valueLakh:30,targetPercent:5},{name:'Real assets',valueLakh:10,targetPercent:20}];
 const calc=run('FinancialPlan.project(financialPlanData.plans.h1,vectorFor("h1"))');
 ctx.calc=calc;
 const result=run('FinancialPlan.recurring(financialPlanData.plans.h1,calc,classes)');
 assert.ok(result.monthly>0);
 assert.ok(Math.abs(result.allocation.reduce((a,b)=>a+b,0)-result.monthly)<1e-9,'the whole target is allocated');
 // Alternatives is far above target, so it gets nothing.
 assert.equal(result.allocation[2],0);
 assert.ok(result.allocation[1]>0&&result.allocation[3]>0);
 // A household with no surplus allocates nothing.
 ctx.broke={...plans.plans.h5,monthlyInvestmentTargetLakh:0};
 const none=run('FinancialPlan.recurring(broke,calc,classes)');
 assert.equal(none.monthly,0);
 assert.ok(none.allocation.every(a=>a===0));
});

test('Flags call out a funding gap, a thin buffer, costly debt and missing cover',()=>{
 const {run}=engine();
 const text=id=>run(`FinancialPlan.flags(financialPlanData.plans["${id}"],FinancialPlan.project(financialPlanData.plans["${id}"],vectorFor("${id}")))`).map(f=>f.text).join(' | ');
 assert.match(text('h5'),/outrun the investable portfolio from year 5/);
 assert.match(text('h5'),/No insurance premium is recorded/);
 assert.match(text('h1'),/Funded for the full 30-year horizon/);
 // Mehta's home loan at 8.6% against about 7% on debt holdings.
 assert.match(text('h1'),/Prepaying from deposits may beat holding them/);
 const shortfall=run('FinancialPlan.flags(financialPlanData.plans.h5,FinancialPlan.project(financialPlanData.plans.h5,vectorFor("h5")))').at(-1);
 assert.ok(shortfall.shortfallLakh>0,'a household with no income this year has a shortfall');
});

test('The engine reads holdings and never writes to them',()=>{
 const {run,originalData,financialPlanData}=engine();
 const before=JSON.stringify({securities:originalData.securities,accounts:originalData.accounts,plans:financialPlanData.plans});
 run('FinancialPlan.project(financialPlanData.plans.h1,vectorFor("h1"))');
 run('FinancialPlan.monthlyPlan(financialPlanData.plans.h1)');
 run('FinancialPlan.yearlyExpenses(financialPlanData.plans.h1)');
 run('FinancialPlan.contingency(vectorFor("h1"),FinancialPlan.project(financialPlanData.plans.h1,vectorFor("h1")),{months:12})');
 assert.equal(JSON.stringify({securities:originalData.securities,accounts:originalData.accounts,plans:financialPlanData.plans}),before);
});

test('A stated return assumption overrides the blend implied by holdings',()=>{
 const {run,ctx}=engine();
 const blended=run('FinancialPlan.project(financialPlanData.plans.h1,vectorFor("h1"))');
 ctx.fixed={...plans.plans.h1,portfolioReturnPercent:4};
 const stated=run('FinancialPlan.project(fixed,vectorFor("h1"))');
 assert.ok(Math.abs(blended.returnPercent-blended.blendedReturn)<1e-9);
 assert.equal(stated.returnPercent,4);
 assert.ok(stated.years.at(-1).balance<blended.years.at(-1).balance,'a lower return leaves less');
});
