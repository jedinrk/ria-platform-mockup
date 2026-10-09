const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');

function console_(){
 const elements=new Map(),storage=new Map();
 const stub=()=>({innerHTML:'',textContent:'',dataset:{},open:false,value:'',checked:false,
  classList:{add(){},remove(){}},setAttribute(){},getAttribute(){return null},hasAttribute(){return false},
  addEventListener(){},insertAdjacentHTML(){},querySelector(){return null},querySelectorAll(){return []},
  focus(){},append(){},showModal(){},close(){},setSelectionRange(){},validity:{badInput:false}});
 const el=id=>{if(!elements.has(id))elements.set(id,stub());return elements.get(id)};
 const ctx=vm.createContext({
  originalData:JSON.parse(fs.readFileSync(path.join(root,'data/original-mockup.json'),'utf8')),
  financialPlanData:JSON.parse(fs.readFileSync(path.join(root,'data/financial-plans.json'),'utf8')),
  crypto:require('node:crypto').webcrypto,
  document:{getElementById:el,addEventListener(){},querySelector(){return null},querySelectorAll(){return []},
   createElement:stub,title:'',body:stub()},
  window:{scrollTo(){},addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  location:{hash:''},setTimeout,clearTimeout,console,CSS:{escape:x=>x},
 });
 ctx.globalThis=ctx;
 for(const file of ['taxonomy.js','financial-plan.js','models.js','portfolio-views.js','portfolios.js','comparison-data.js',
  'portfolio-workspace.js','comparison.js','portfolio-review.js','target-plan-preview.js','models-extensions.js',
  'console-extensions.js','planning.js','security-master.js','financial-workspace.js','portfolios-overview.js',
  'household-detail.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
 const raw=code=>vm.runInContext(code,ctx);
 const run=code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',ctx));
 // h3 Kapoor Family has two accounts; h5 Nair Household has one.
 const page=(id='h3',area='allocation')=>run(`(portfolioArea=${JSON.stringify(area)},householdPage(${JSON.stringify(id)}),$("app").innerHTML)`);
 return {run,raw,page};
}

test('A household has the same five work areas an account has',()=>{
 const {run,page}=console_();
 const markup=page();
 const account=run('HOUSEHOLD_AREAS.map(a=>a[1])');
 assert.deepEqual(account,['1 Assets & liabilities','2 Allocation & drift','3 Gap summary & trades','4 Cash & planning','5 Client target']);
 for(const [key,label] of run('HOUSEHOLD_AREAS')){
  assert.ok(markup.includes('data-household-area="'+key+'"'),'missing tab '+key);
  assert.ok(markup.includes(label),'missing label '+label);
 }
 // The accounts are navigation, so they are out of the tabs and under the heading.
 assert.match(markup,/household-accounts-strip/);
 assert.ok(!markup.includes('data-household-area="accounts"'));
});

test('Each area renders its own screen',()=>{
 const {page}=console_();
 assert.match(page('h3','balance'),/Assets and liabilities/);
 assert.match(page('h3','allocation'),/Allocation review/);
 assert.match(page('h3','planning'),/Gap summary/);
 assert.match(page('h3','cash'),/Income and assumptions/);
 assert.match(page('h3','target'),/Client target/);
});

test('The household balance sheet does not apologise for being the household plan',()=>{
 const {run,raw}=console_();
 raw('activeClient=null;reviewHouseholdId="h2"');
 const asHousehold=run('planContext({...reviewRecord("h2"),householdId:"h2"})');
 assert.match(asHousehold,/Income, liabilities and needs are held here and use all 3 accounts together/);
 assert.ok(!/Showing the household plan/.test(asHousehold));
 // An account still explains whose plan it is showing.
 const asAccount=run('planContext(clientRecords.find(c=>c.householdId==="h2"))');
 assert.match(asAccount,/Showing the household plan/);
 assert.match(asAccount,/one of 3 accounts/);
});

test('The household allocation table states a band and offers no editing',()=>{
 const {page}=console_();
 const markup=page('h3','allocation');
 assert.match(markup,/Band ±/);
 assert.match(markup,/data-household-expand="breaches"/);
 // A household target is the blend of approved account targets, so there is
 // nothing here to edit and nothing to approve.
 assert.ok(!markup.includes('data-allocation-target'));
 assert.ok(!markup.includes('data-allocation-band'));
 assert.ok(!markup.includes('data-workspace="adjust"'));
});

test('The gap summary rolls up each account rather than pooling the holdings',()=>{
 const {run}=console_();
 const parts=run(`(()=>{const r={...reviewRecord("h3"),householdId:"h3"};
  return householdGaps(r).map(x=>({name:x.c.name,sell:x.outcome.sellTotal,buy:x.outcome.buyTotal,tax:x.outcome.tax.tax}))})()`);
 assert.equal(parts.length,2);
 // Every figure on the household screen is the sum of the accounts' own
 // scenarios, so a trade is always attributable to the account that holds it.
 const markup=run('(portfolioArea="planning",householdPage("h3"),$("app").innerHTML)');
 for(const part of parts)assert.ok(markup.includes(part.name),'account missing from the table: '+part.name);
 assert.match(markup,/not a household scenario/);
 assert.ok(!markup.includes('data-scenario="create-rebalance"'),'a household cannot generate a scenario');
});

test('The gap summary measures against the approved target, not against zero',()=>{
 const {run}=console_();
 // scenarioOutcome once passed per-security values where node targets were
 // expected, so every target read as 0 and the drift was the whole portfolio.
 const outcome=run(`(()=>{const c=clientRecords.find(x=>x.name==="Arjun Kapoor");activeClient=c.id;
  const p=approved(c).plan,s=rebalanceScenario(p,planningOptions),o=scenarioOutcome(p,s);
  return {drift:o.metricsBefore.drift,targets:o.metricsBefore.classes.map(x=>x.target)}})()`);
 assert.ok(outcome.targets.some(t=>t>0),'asset-class targets are real');
 assert.ok(Math.abs(outcome.targets.reduce((a,b)=>a+b,0)-100)<0.5,'they total 100%');
 assert.ok(outcome.drift<20,'the largest gap is a drift, not the portfolio itself');
});

test('Gap summary and trade recommendations are what tab 3 renders',()=>{
 const {run}=console_();
 // Two global `planningArea` declarations once collided, and the file that
 // loads last won, so tab 3 rendered the financial plan instead.
 assert.match(run('String(planningArea)'),/Gap summary|create-rebalance/);
 assert.match(run('String(financialPlanArea)'),/householdVector|Income and assumptions|planContext/);
 assert.notEqual(run('String(planningArea)'),run('String(financialPlanArea)'));
});

test('The client target area reports the blend and where accounts disagree',()=>{
 const {run,page}=console_();
 const markup=page('h3','target');
 assert.match(markup,/Blended household target/);
 assert.match(markup,/no target of its own/);
 for(const name of run('reviewRecord("h3").members.map(c=>c.name)'))assert.ok(markup.includes(name));
 // Give one account a different model and the heading says so.
 const mixed=run(`(()=>{const r=reviewRecord("h3"),c=r.members[1];
  const other=models.find(m=>m.name!==approved(c).plan.base.data.name&&latest(m));
  const v=latest(other);approved(c).plan.base={modelId:other.id,version:v.number,name:v.data.name,data:copy(v.data)};
  portfolioArea="target";householdPage("h3");return $("app").innerHTML})()`);
 assert.match(mixed,/different models across 2 accounts/);
 assert.match(mixed,/not wrong/);
});

test('A household holding one account says so instead of pretending to combine',()=>{
 const {page}=console_();
 const one=page('h5','allocation');
 assert.match(one,/holds one account/);
 assert.ok(!/Combined across/.test(one));
 assert.match(page('h3','allocation'),/Combined across 2 accounts/);
});

test('The financial plan is editable from the household page',()=>{
 const {run,raw}=console_();
 raw('activeClient=null;reviewHouseholdId="h2";portfolioArea="cash"');
 // planRecord resolves the household when no account is open, so the plan
 // screens work from either page.
 assert.equal(run('planRecord().householdId'),'h2');
 assert.equal(run('planOf(planRecord())===financialPlans.h2'),true);
 raw('activeClient=clientRecords.find(c=>c.householdId==="h2").id');
 assert.equal(run('planRecord().householdId'),'h2','an open account still resolves its own household');
 raw('activeClient=null;reviewHouseholdId=null');
 assert.equal(run('planRecord()'),null,'and neither page open resolves nothing');
});

test('Opening a household never leaves an account draft in play',()=>{
 const {run,raw}=console_();
 raw(`activeClient=clientRecords[0].id;portfolioArea="allocation";
  (()=>{const c=client();c.draft=c.draft||copy(approved(c).plan);allocationDraft=true;clientEditing=true})()`);
 raw('householdPage("h3")');
 assert.deepEqual(run('[activeClient,allocationDraft,clientEditing,reviewHouseholdId]'),[null,false,false,'h3']);
});
