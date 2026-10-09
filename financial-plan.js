'use strict';
// Household financial planning: the calculations only. Nothing here touches the
// DOM, localStorage, an approved client target or a recorded holding.
//
// Every figure is illustrative. The projection is an annual roll-up, not a
// cash-flow engine, and the tax and penalty costs reuse the same placeholder
// rates as the rest of the prototype.
const FinancialPlan = (() => {
 const settings = () => financialPlanData.settings;
 const FREQUENCY = () => settings().frequencyPerYear;
 const HORIZON = () => settings().horizonYears;
 const EMERGENCY_MONTHS = () => settings().emergencyMonths;

 const securities = () => originalData.securities;
 const liquidityOf = index => securities()[index].liquidityCode;
 const investable = vector => vector.map((value, i) => liquidityOf(i) < 2 ? value : 0);
 const sum = list => list.reduce((a, b) => a + b, 0);

 // Expected return, weighted by what is actually investable. A household may
 // override it with a single assumption.
 function blendedReturn(vector) {
  const usable = investable(vector), total = sum(usable);
  if (total <= 0) return 7;
  const classes = originalData.assetHierarchy.map(c => c.n);
  const byClass = classes.map(name => sum(securities().map((s, i) => s.assetClass === name ? usable[i] : 0)));
  const rates = settings().blendedReturnByClassPercent;
  return sum(byClass.map((value, i) => value * (rates[i] ?? 7))) / total;
 }

 // The long roll-up: the investable portfolio grows, income arrives while it
 // lasts, and debt service and needs are drawn against it. The first year the
 // balance turns negative is the funding gap.
 function project(plan, vector) {
  const assets = sum(vector);
  const investableToday = sum(investable(vector));
  const blend = blendedReturn(vector);
  const rate = (plan.portfolioReturnPercent ?? blend) / 100;
  const horizon = HORIZON();
  let balance = investableToday, gapYear = null;
  const years = [];
  for (let t = 1; t <= horizon; t++) {
   const income = t <= plan.incomeContinuesYears
    ? plan.monthlyIncomeLakh * 12 * Math.pow(1 + plan.incomeGrowthPercent / 100, t - 1) : 0;
   const debtService = sum(plan.liabilities.map(l => {
    const left = l.monthsLeft - 12 * (t - 1);
    return left > 0 ? Math.min(12, left) * l.emiLakh : 0;
   }));
   const needs = sum(plan.recurringNeeds.map(n =>
    (t > n.startsInYears && t <= n.startsInYears + n.lastsYears)
     ? n.amountLakh * FREQUENCY()[n.frequency] * Math.pow(1 + n.inflationPercent / 100, t - 1) : 0));
   balance = balance * (1 + rate) + (income - debtService - needs) * (1 + rate / 2);
   years.push({year: t, income, debtService, needs, balance});
   if (gapYear === null && balance < 0) gapYear = t;
  }
  const liabilitiesTotal = sum(plan.liabilities.map(l => l.outstandingLakh));
  const emiMonthly = sum(plan.liabilities.map(l => l.monthsLeft > 0 ? l.emiLakh : 0));
  const needsMonthly = sum(plan.recurringNeeds.map(n => n.startsInYears === 0 ? n.amountLakh * FREQUENCY()[n.frequency] / 12 : 0));
  const commitmentsMonthly = emiMonthly + needsMonthly;
  const liquid = sum(vector.map((value, i) => liquidityOf(i) === 0 ? value : 0));
  // The emergency reserve is held in deposits and bonds, not in anything that
  // would have to be sold at a bad moment.
  const reserve = sum(vector.map((value, i) => securities()[i].tags.isDebt && liquidityOf(i) < 2 ? value : 0));
  return {
   assets, investable: investableToday, blendedReturn: blend, returnPercent: rate * 100,
   years, gapYear, horizonYears: horizon,
   liabilitiesTotal, emiMonthly, needsMonthly, commitmentsMonthly,
   reserve, emergencyTarget: commitmentsMonthly * EMERGENCY_MONTHS(),
   netWorth: assets - liabilitiesTotal,
   firstYearOutflow: years[0].debtService + years[0].needs,
   liquid, runwayMonths: commitmentsMonthly > 0 ? liquid / commitmentsMonthly : 99,
  };
 }

 // Twelve months from the start of the financial year, so the heavy months —
 // the ones carrying yearly premiums and quarterly fees — stay visible instead
 // of being averaged away.
 function monthlyPlan(plan) {
  const months = settings().financialYearMonthOrder.map((calendarMonth, offset) => {
   const debt = plan.liabilities.filter(l => l.monthsLeft > offset && l.emiLakh > 0)
    .map(l => ({name: l.name, category: 'Debt service', amount: l.emiLakh}));
   const regular = [], periodic = [];
   for (const need of plan.recurringNeeds) {
    if (!(need.startsInYears < 1 && need.startsInYears + need.lastsYears >= 1)) continue;
    const due = need.dueMonth ?? 4;
    if (need.frequency === 'Monthly') regular.push({name: need.name, category: need.category, amount: need.amountLakh});
    else if (need.frequency === 'Quarterly') {
     if ((((calendarMonth - due) % 3) + 3) % 3 === 0) periodic.push({name: need.name, category: need.category, amount: need.amountLakh});
    } else if (calendarMonth === due) periodic.push({name: need.name, category: need.category, amount: need.amountLakh});
   }
   const total = list => sum(list.map(x => x.amount));
   return {
    calendarMonth, year: calendarMonth >= 10 ? 2026 : 2027,
    income: plan.incomeContinuesYears >= 1 ? plan.monthlyIncomeLakh : 0,
    debtService: total(debt), regular: total(regular), periodic: total(periodic),
    items: [...debt, ...regular, ...periodic],
   };
  });
  let cumulative = 0;
  for (const month of months) {
   month.outflow = month.debtService + month.regular + month.periodic;
   month.net = month.income - month.outflow;
   cumulative += month.net;
   month.cumulative = cumulative;
  }
  return months;
 }

 // Yearly cost by category, this year and inflated five years out, keeping
 // ordinary running costs separable from goals.
 function yearlyExpenses(plan) {
  const active = (need, year) => need.startsInYears < year && need.startsInYears + need.lastsYears >= year;
  const groups = new Map();
  for (const need of plan.recurringNeeds) {
   if (!groups.has(need.category)) groups.set(need.category, {category: need.category, thisYear: 0, inFiveYears: 0, items: []});
   const group = groups.get(need.category);
   const perYear = need.amountLakh * FREQUENCY()[need.frequency];
   const thisYear = active(need, 1) ? perYear : 0;
   const inFiveYears = active(need, 6) ? perYear * Math.pow(1 + need.inflationPercent / 100, 5) : 0;
   group.thisYear += thisYear;
   group.inFiveYears += inFiveYears;
   group.items.push({need, thisYear, inFiveYears});
  }
  const categories = [...groups.values()].sort((a, b) => b.thisYear - a.thisYear);
  const debtThisYear = sum(plan.liabilities.map(l => Math.min(12, Math.max(0, l.monthsLeft)) * l.emiLakh));
  const debtInFiveYears = sum(plan.liabilities.map(l => l.monthsLeft - 60 > 0 ? Math.min(12, l.monthsLeft - 60) * l.emiLakh : 0));
  const needsThisYear = sum(categories.map(c => c.thisYear));
  const domestic = sum(categories.filter(c => settings().domesticCategories.includes(c.category)).map(c => c.thisYear));
  return {
   categories, needsThisYear, needsInFiveYears: sum(categories.map(c => c.inFiveYears)),
   debtThisYear, debtInFiveYears, domestic,
   totalThisYear: needsThisYear + debtThisYear,
  };
 }

 // Raising cash in a hurry: cheapest first by the tax and exit penalty the sale
 // would cost, then fastest to settle. Locked assets are never used.
 const DAYS_BY_TYPE = {'Mutual fund': 3, 'Direct equity': 2, ETF: 2, 'Government bond': 3, 'Corporate bond': 3,
  'Fixed deposit': 2, 'REIT / InvIT': 2, 'Debt fund': 2, PMS: 7, Commodity: 2, 'Digital asset': 1};
 function daysToCash(index) {
  const s = securities()[index];
  if (s.assetType === 'Gold') return s.physical ? 7 : 5;
  return DAYS_BY_TYPE[s.assetType] || 5;
 }
 function contingency(vector, calc, cover) {
  const amount = cover.custom ? cover.amountLakh : cover.months * calc.commitmentsMonthly;
  const sources = securities().map((s, index) => {
   const value = vector[index];
   const cost = s.costBasisLakh * value / s.baseValueLakh;
   const gain = Math.max(0, value - cost);
   // A deposit broken early loses part of its interest; nothing else here does.
   const penalty = s.assetType === 'Fixed deposit' ? 0.01 : 0;
   const taxShare = value > 0 ? gain / value * s.illustrativeTaxRatePercent / 100 : 0;
   return {index, security: s, value, gain, days: daysToCash(index), penalty, costRate: taxShare + penalty};
  }).filter(x => x.security.liquidityCode < 2 && x.value > 0.05)
    .sort((a, b) => a.costRate - b.costRate || a.days - b.days);
  let remaining = amount, cumulative = 0;
  const used = [];
  for (const source of sources) {
   if (remaining <= 0.001) break;
   const take = Math.min(source.value, remaining);
   remaining -= take; cumulative += take;
   used.push({...source, amountLakh: take, costLakh: take * source.costRate, cumulativeLakh: cumulative});
  }
  return {
   amount, used, shortfall: Math.max(0, remaining),
   costLakh: sum(used.map(u => u.costLakh)),
   days: Math.max(0, ...used.map(u => u.days)),
   available: sum(sources.map(s => s.value)),
  };
 }

 // The monthly surplus goes where the portfolio is furthest below target.
 function recurring(plan, calc, classes) {
  const income = plan.incomeContinuesYears >= 1 ? plan.monthlyIncomeLakh : 0;
  const surplus = income - calc.emiMonthly - calc.needsMonthly;
  const monthly = plan.monthlyInvestmentTargetLakh != null ? plan.monthlyInvestmentTargetLakh : Math.max(0, surplus) * 0.8;
  const total = sum(classes.map(c => c.valueLakh));
  const projected = total + monthly * 12;
  const gaps = classes.map(c => Math.max(0, c.targetPercent / 100 * projected - c.valueLakh));
  const gapTotal = sum(gaps);
  const allocation = gaps.map(gap => gapTotal > 0 ? monthly * gap / gapTotal : 0);
  return {income, surplus, monthly, total, allocation, gaps};
 }

 // What an adviser should read before anything else on the planning tab.
 function flags(plan, calc) {
  const out = [];
  const reserveRatio = calc.emergencyTarget > 0 ? calc.reserve / calc.emergencyTarget : 2;
  const emiToIncome = plan.monthlyIncomeLakh > 0 ? calc.emiMonthly / plan.monthlyIncomeLakh * 100 : 0;
  const shortfall = Math.max(0, calc.firstYearOutflow - calc.years[0].income);
  const debtRate = settings().blendedReturnByClassPercent[1] ?? 7;
  const months = EMERGENCY_MONTHS();
  out.push(calc.gapYear
   ? {level: 'attention', text: `Debt service and needs outrun the investable portfolio from year ${calc.gapYear}. Review spending, income years or the return assumption.`}
   : {level: 'ok', text: `Funded for the full ${calc.horizonYears}-year horizon at about ${calc.returnPercent.toFixed(1)}% a year.`});
  out.push(reserveRatio >= 1
   ? {level: 'ok', text: `Emergency buffer of ₹${calc.reserve.toFixed(1)} L covers the ${months}-month target of ₹${calc.emergencyTarget.toFixed(1)} L.`}
   : {level: 'attention', text: `Emergency buffer ₹${calc.reserve.toFixed(1)} L is below the ${months}-month target of ₹${calc.emergencyTarget.toFixed(1)} L. Deposits and bonds only.`});
  if (emiToIncome > 40) out.push({level: 'check', text: `EMIs are ${emiToIncome.toFixed(1)}% of income. Above 40% leaves little room for a shock.`});
  for (const l of plan.liabilities) {
   if (l.outstandingLakh > 0 && l.ratePercent > debtRate + 1) {
    out.push({level: 'check', text: `${l.name} costs ${l.ratePercent.toFixed(1)}% against about ${debtRate}% on debt holdings. Prepaying from deposits may beat holding them.`});
   }
  }
  if (!plan.recurringNeeds.some(n => n.category === 'Insurance premium')) {
   out.push({level: 'check', text: 'No insurance premium is recorded. Check life and health cover.'});
  }
  out.push({
   level: shortfall > 0.05 ? 'check' : 'ok',
   text: `Next 12 months: outflows ₹${calc.firstYearOutflow.toFixed(1)} L against income ₹${calc.years[0].income.toFixed(1)} L`,
   shortfallLakh: shortfall > 0.05 ? shortfall : 0,
  });
  return out;
 }

 return {project, monthlyPlan, yearlyExpenses, contingency, recurring, flags, blendedReturn, daysToCash,
  settings, investable, sum};
})();
