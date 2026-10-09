const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');

// The drift table is assembled by several layers patching one another, so the
// whole chain is loaded against a DOM stub that records markup. Nothing here
// renders: the editing rules are pure functions over the plan.
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
  'console-extensions.js','planning.js','security-master.js','financial-workspace.js','portfolios-overview.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
 const raw=code=>vm.runInContext(code,ctx);
 const run=code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',ctx));
 // Open a portfolio with a draft in progress, as the Adjust targets button does.
 raw('activeClient=clientRecords[0].id;portfolioArea="allocation"');
 raw('(()=>{const c=client();c.draft=c.draft||copy(approved(c).plan);allocationDraft=true})()');
 return {run,raw,classes:()=>run('effective(allocationPlan()).allocations.map(n=>({name:n.name,target:n.target}))')};
}
const sum=xs=>xs.reduce((a,b)=>a+b.target,0);

test('Editing an asset class moves its siblings, not the total',()=>{
 const c=console_();
 const before=c.classes();
 assert.ok(Math.abs(sum(before)-100)<0.01);
 c.raw('editAllocationTarget(allocationPlan(),["Equity"],40)');
 const after=c.classes();
 assert.equal(after.find(x=>x.name==='Equity').target,40);
 assert.ok(Math.abs(sum(after)-100)<0.01,'the portfolio still totals 100%');
 // Every other asset class absorbed the change; none kept its old number.
 for(const row of after.filter(x=>x.name!=='Equity'))
  assert.notEqual(row.target,before.find(x=>x.name===row.name).target);
});

test('Editing a child leaves the level above exactly where it was',()=>{
 const c=console_();
 const equity=()=>c.classes().find(x=>x.name==='Equity').target;
 const was=equity();
 const child=c.run('effective(allocationPlan()).allocations.find(n=>n.name==="Equity").children[0].name');
 c.raw(`editAllocationTarget(allocationPlan(),["Equity",${JSON.stringify(child)}],12)`);
 assert.equal(equity(),was,'the parent does not move when a child is edited');
 assert.equal(c.run(`effective(allocationPlan()).allocations.find(n=>n.name==="Equity").children.find(n=>n.name===${JSON.stringify(child)}).target`),12);
 assert.deepEqual(c.run('validation(effective(allocationPlan()))'),[],'parents still reconcile with their children');
});

test('Clearing a box returns the whole sibling group to the model',()=>{
 const c=console_();
 const before=c.classes();
 c.raw('editAllocationTarget(allocationPlan(),["Equity"],40)');
 assert.notDeepEqual(c.classes(),before);
 c.raw('resetAllocationBranch(allocationPlan(),["Equity"])');
 assert.deepEqual(c.classes(),before,'the siblings that moved together come back together');
});

test('Reset to model reproduces the model exactly and clears every override',()=>{
 const c=console_();
 const model=c.run('TAX.targetsFromTree(effective(allocationPlan()).allocations)');
 c.raw('editAllocationTarget(allocationPlan(),["Equity"],33);setAllocationBand(allocationPlan(),["Equity","Cyclical"],1.5)');
 assert.ok(c.run('allocationOverrideCount(allocationPlan())')>0);
 c.raw('allocationPlan().overrides={}');
 assert.deepEqual(c.run('TAX.targetsFromTree(effective(allocationPlan()).allocations)'),model);
 assert.equal(c.run('allocationOverrideCount(allocationPlan())'),0);
});

test('The count reports what the adviser decided, not every rescaled leaf',()=>{
 const c=console_();
 c.raw('editAllocationTarget(allocationPlan(),["Equity"],40)');
 // Four asset classes now differ from the model. The hundred-odd nodes beneath
 // them moved pro rata and are not separate decisions.
 assert.equal(c.run('allocationOverrideCount(allocationPlan())'),4);
 assert.deepEqual([...c.run('[...allocationOverrideKeys(allocationPlan())]')].sort(),
  c.classes().map(x=>x.name).sort());
});

test('Edits land in the draft; the approved target does not move',()=>{
 const c=console_();
 const approvedBefore=c.run('TAX.targetsFromTree(effective(approved(client()).plan).allocations)');
 c.raw('editAllocationTarget(allocationPlan(),["Equity"],40)');
 assert.deepEqual(c.run('TAX.targetsFromTree(effective(approved(client()).plan).allocations)'),approvedBefore);
 assert.notDeepEqual(c.run('TAX.targetsFromTree(effective(allocationPlan()).allocations)'),approvedBefore);
 // And the draft is in a state Client target will accept for approval.
 assert.deepEqual(c.run('targetIssues(allocationPlan())'),[]);
});

test('A band override tightens the row it is set on, and only that row',()=>{
 const c=console_();
 const key='["Equity","Cyclical"]';
 c.raw('clientExpanded=new Set(alignedPortfolioRows(allocationPlan()).filter(r=>r.children).map(r=>r.key))');
 const band=c.run('allocationBand(1,activeClient,allocationNodes(allocationPlan()).get("Equity / Cyclical").band)');
 assert.equal(band,originalDefault(c,1),'the default comes from the tree, not a hardcoded depth table');
 c.raw('setAllocationBand(allocationPlan(),["Equity","Cyclical"],0.1)');
 assert.equal(c.run('allocationBand(1,activeClient,allocationNodes(allocationPlan()).get("Equity / Cyclical").band)'),0.1);
 assert.equal(c.run('allocationBand(1,activeClient,allocationNodes(allocationPlan()).get("Equity / Defensive").band)'),band,
  'a sibling keeps the model band');
 c.raw('setAllocationBand(allocationPlan(),["Equity","Cyclical"],null)');
 assert.equal(c.run('"Equity / Cyclical" in allocationPlan().overrides'),false,'clearing the band removes the override entirely');
});
function originalDefault(c,level){return c.run(`originalData.settings.defaultBandsByLevel[${level}]`)}

test('The asset-class row is judged against the portfolio threshold, not a node band',()=>{
 const c=console_();
 const threshold=c.run('portfolioThreshold(activeClient)');
 assert.equal(c.run('allocationBand(0,activeClient,99)'),threshold);
});

test('The table offers editing only while a draft is open',()=>{
 const c=console_();
 c.raw('clientExpanded=new Set(alignedPortfolioRows(allocationPlan()).filter(r=>r.children).map(r=>r.key))');
 const editing=c.run('allocationTable(allocationPlan())');
 assert.match(editing,/data-allocation-target/);
 assert.match(editing,/data-allocation-band/);
 assert.match(editing,/Band ±/);
 assert.match(editing,/Draft target %/);
 c.raw('allocationDraft=false');
 const readOnly=c.run('allocationTable(approved(client()).plan)');
 assert.ok(!/data-allocation-target/.test(readOnly),'the approved view is read-only');
 assert.match(readOnly,/Band ±/,'but it still states the band each row is judged against');
 assert.match(readOnly,/Client target %/);
});

test('A row carries a reset only once it differs from the model',()=>{
 const c=console_();
 c.raw('clientExpanded=new Set(alignedPortfolioRows(allocationPlan()).filter(r=>r.children).map(r=>r.key))');
 assert.ok(!/data-allocation-reset/.test(c.run('allocationTable(allocationPlan())')));
 c.raw('editAllocationTarget(allocationPlan(),["Equity"],40)');
 assert.match(c.run('allocationTable(allocationPlan())'),/data-allocation-reset/);
});

test('Expanding to breaches opens the ancestors of every row outside its band',()=>{
 const c=console_();
 c.raw('allocationDraft=false');
 // Construct the breach rather than assume the sample holds one: move the
 // approved target far enough from what is actually held.
 const breached=c.run(`(()=>{
  const plan=approved(client()).plan,total=scopeValue(plan);
  const row=alignedPortfolioRows(plan).find(r=>r.names.length===3&&r.actual/total*100>2);
  editAllocationTarget(plan,row.names,0);
  return row.names;
 })()`);
 const keys=c.run('[...breachKeys(approved(client()).plan)]');
 assert.ok(keys.includes(JSON.stringify(breached.slice(0,1))),'the asset class is opened');
 assert.ok(keys.includes(JSON.stringify(breached.slice(0,2))),'and the level between it and the breach');
 // Opening exactly those keys is enough to see the breach without expanding all.
 c.raw('clientExpanded=breachKeys(approved(client()).plan)');
 const shown=c.run('allocationTable(approved(client()).plan)');
 assert.ok(shown.includes('data-allocation-toggle="'+c.run('esc(JSON.stringify('+JSON.stringify(breached)+'))')+'"')
  ||shown.includes(breached.at(-1)),'the breaching row is on screen');
 assert.match(shown,/state-pill (over|under)/);
});
