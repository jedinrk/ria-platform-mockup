const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');

// The overview is assembled by several layers patching one another, so the whole
// chain is loaded against a DOM stub that records markup.
function overview(){
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
  'console-extensions.js','planning.js','security-master.js','financial-workspace.js','portfolios-overview.js','household-detail.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
 return {run:code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',ctx)),raw:code=>vm.runInContext(code,ctx)};
}

test('A household row states its plan and an account row states its household plan',()=>{
 const {run,raw}=overview();
 raw('clientView="households"');
 const mehta=run('dashboardRow(dashboardRecords().find(r=>r.name==="Mehta Family"))');
 assert.match(mehta,/data-label="Financial plan"/);
 assert.match(mehta,/Funded/);
 assert.match(mehta,/months of runway/);
 // A household speaks for itself, so it does not name another household's plan.
 assert.ok(!/Mehta Family plan/.test(mehta));
 raw('clientView="accounts"');
 const account=run('dashboardRow(dashboardRecords().find(r=>r.name==="Lakshmi Nair"))');
 assert.match(account,/data-label="Financial plan"/);
 // Nair has no continuing income, so the plan runs out early.
 assert.match(account,/Gap from year 6/);
 assert.match(account,/Nair Household plan/,'an account says whose plan it is showing');
});

test('A thin liquidity runway is called out',()=>{
 const {run,raw}=overview();
 raw('clientView="households"');
 // Push commitments far above what is liquid.
 raw('financialPlans.h5.recurringNeeds.push({name:"Test",category:"Other",amountLakh:40,frequency:"Monthly",startsInYears:0,lastsYears:30,inflationPercent:0,dueMonth:null});savePlans()');
 const row=run('dashboardRow(dashboardRecords().find(r=>r.name==="Nair Household"))');
 assert.match(row,/under six/,'a runway below six months is flagged');
 assert.match(row,/errors/);
});

test('Editing a plan changes what the list says',()=>{
 const {run,raw}=overview();
 raw('clientView="households"');
 const before=run('dashboardRow(dashboardRecords().find(r=>r.name==="Nair Household"))');
 assert.match(before,/Gap from year 6/);
 raw('financialPlans.h5.monthlyIncomeLakh=4;financialPlans.h5.incomeContinuesYears=30;savePlans()');
 const after=run('dashboardRow(dashboardRecords().find(r=>r.name==="Nair Household"))');
 assert.match(after,/Funded/,'the cached summary is dropped when a plan is saved');
});

test('The list filters by model, and the risk profile stays visible',()=>{
 const {run,raw}=overview();
 raw('clientView="accounts";modelFilter=""');
 const all=run('visibleRecords().length');
 assert.equal(all,12);
 raw('modelFilter="Conservative"');
 const filtered=run('visibleRecords().map(r=>r.model)');
 assert.ok(filtered.length>0&&filtered.length<all);
 assert.ok(filtered.every(m=>m==='Conservative'));
 // Filtering on a model does not drop the risk profile from the row.
 const row=run('dashboardRow(visibleRecords()[0])');
 assert.match(row,/Risk profile:/);
});

test('The Core / Satellite lens is gone, with no empty bucket left behind',()=>{
 const {run}=overview();
 assert.ok(!run('EXPOSURE_LENSES').includes('cu'));
 assert.ok(!run('lenses.map(l=>l[0])').includes('cu'));
 // Every security lost its custom tag with the revised classification, so the
 // lens could only ever have reported one meaningless bucket.
 assert.ok(run('originalData.securities.every(s=>s.tags.custom===null)'));
 const flags=run('(clientView="accounts",dashboardRecords().flatMap(r=>r.exposureFlags.map(f=>f.lens)))');
 assert.ok(!flags.includes('cu'));
 assert.ok(flags.length>0,'the remaining lenses still report');
});
