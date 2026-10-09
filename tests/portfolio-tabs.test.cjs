const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');

function workspace(){
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
 vm.runInContext('activeClient=clientRecords[0].id',ctx);
 return {run:code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',ctx)),raw:code=>vm.runInContext(code,ctx)};
}

const areas=markup=>[...markup.matchAll(/data-portfolio-area="([a-z]+)"/g)].map(m=>m[1]);

test('The workspace has five tabs, named as the revised mockup names them',()=>{
 const {run}=workspace();
 const tabs=run('portfolioTabs()');
 assert.deepEqual(areas(tabs),['balance','allocation','planning','cash','target']);
 for(const label of ['1 Assets & liabilities','2 Allocation & drift','3 Gap summary & trades','4 Cash & planning','5 Client target'])
  assert.ok(tabs.includes(label),'missing tab: '+label);
});

test('Exposure drift is no longer a tab, because it was never a separate view',()=>{
 const {run,raw}=workspace();
 const tabs=run('portfolioTabs()');
 assert.ok(!areas(tabs).includes('exposure'));
 // It only ever set the allocation area and flipped a lens, which the toggle
 // inside Allocation already does.
 raw('portfolioArea="allocation";activeLens="ac"');
 const asAllocation=run('allocationControls()');
 assert.match(asAllocation,/Asset allocation/);
 assert.match(asAllocation,/Exposure analysis/);
 assert.match(asAllocation,/aria-pressed="true"[^>]*>Asset allocation/);
 raw('activeLens="sec"');
 const asExposure=run('allocationControls()');
 assert.match(asExposure,/data-workspace="exposures" aria-pressed="true"/);
 // The lens picker offers every distribution the old tab offered.
 for(const lens of ['Sector','Market cap','Geography','Theme','Credit & duration'])
  assert.ok(asExposure.includes(lens),'missing distribution: '+lens);
});

test('Target history sits with the approval it belongs to',()=>{
 const {run,raw}=workspace();
 assert.ok(!areas(run('portfolioTabs()')).includes('history'));
 raw('portfolioArea="target";clientEditing=false');
 const target=run('targetPlanContent(approved(client()).plan)');
 assert.match(target,/target-history-card/);
 assert.match(target,/Approved target revisions/);
 // The revisions themselves are still the client record's, unchanged.
 assert.match(target,/Target revision 1/);
});

test('Switching to a distribution opens the bucket explorer, as the tab used to',()=>{
 const {raw}=workspace();
 // The hook ran against the old exposure area; it now keys off the lens.
 const source=fs.readFileSync(path.join(root,'console-extensions.js'),'utf8');
 assert.ok(!source.includes("portfolioArea!=='exposure'"),'the retired area is no longer referenced');
 assert.match(source,/portfolioArea!=='allocation'\|\|activeLens==='ac'/);
 raw('portfolioArea="allocation";activeLens="sec"');
});

test('No module still routes to a tab that no longer exists',()=>{
 for(const file of ['portfolio-workspace.js','portfolio-review.js','target-plan-preview.js','console-extensions.js','financial-workspace.js','planning.js']){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  assert.ok(!/portfolioArea\s*=\s*['"]exposure['"]/.test(source),file+' still sets the exposure area');
  assert.ok(!/portfolioArea\s*=\s*['"]history['"]/.test(source),file+' still sets the history area');
 }
});
