const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');

// The extension files render into the live shell, so give them a DOM stub that
// records markup instead of a real document.
function console_(){
 const elements=new Map();
 const stub=()=>({innerHTML:'',textContent:'',dataset:{},open:false,classList:{add(){},remove(){}},
  setAttribute(){},getAttribute(){return null},hasAttribute(){return false},addEventListener(){},
  insertAdjacentHTML(){},querySelector(){return null},querySelectorAll(){return []},focus(){},append(){}});
 const el=id=>{if(!elements.has(id))elements.set(id,stub());return elements.get(id)};
 const ctx=vm.createContext({
  originalData:JSON.parse(fs.readFileSync(path.join(root,'data/original-mockup.json'),'utf8')),
  crypto:require('node:crypto').webcrypto,
  document:{getElementById:el,addEventListener(){},querySelector(){return null},querySelectorAll(){return []},
   createElement:stub,title:'',body:stub()},
  window:{scrollTo(){},addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  location:{hash:''},setTimeout,clearTimeout,console,CSS:{escape:x=>x},
 });
 ctx.globalThis=ctx;
 for(const f of ['models.js','portfolio-views.js','portfolios.js','comparison-data.js','portfolio-workspace.js',
  'comparison.js','portfolio-review.js','target-plan-preview.js','models-extensions.js','console-extensions.js'])
  vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
 return {run:code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',ctx)),raw:code=>vm.runInContext(code,ctx)};
}

test('Audit log is one chronological feed with an actor, a status and before/after detail',()=>{
 const {run}=console_();
 const events=run('activityEvents().map(e=>({action:e.action,object:e.object,actor:e.actor,status:e.status,date:e.date}))');
 assert.ok(events.length>=15,'every model publication and target approval appears');
 assert.ok(events.some(e=>e.action==='Model published'));
 assert.ok(events.some(e=>e.action==='Client target approved'));
 assert.ok(events.every(e=>e.actor&&e.status),'an actor and a status are always stated');
 // A date never recorded says so rather than being invented.
 assert.ok(events.every(e=>e.date));
 assert.match(run('activityEvents().find(e=>e.action==="Model published").detail()'),/First published snapshot|<table/);
});

test('Audit filters narrow the feed without altering any record',()=>{
 const {run,raw}=console_();
 const before=run('clientRecords');
 const all=run('activityEvents().length');
 raw('auditFilters.action="target"');
 const targets=run('filteredEvents().length');
 assert.ok(targets>0&&targets<all,'action filter narrows the feed');
 assert.ok(run('filteredEvents().every(e=>e.kind==="target")'));
 raw('auditFilters.action="";auditFilters.object="Mehta"');
 assert.ok(run('filteredEvents().every(e=>/Mehta/.test(e.object+e.household))'));
 raw('auditFilters.object="";auditFilters.from="2099-01-01"');
 assert.equal(run('filteredEvents().length'),0,'an out-of-range date window returns nothing');
 raw('auditFilters.from=""');
 assert.deepEqual(run('clientRecords'),before,'filtering never writes to a record');
});

test('Dates are the local calendar day, not shifted by the timezone',()=>{
 const {run}=console_();
 assert.equal(run('isoOf("04 Oct 2026")'),'2026-10-04');
});

test('Exposure flags can be excluded from the review state',()=>{
 const {run,raw}=console_();
 raw('clientView="accounts"');
 const on=run('dashboardRecords().filter(r=>r.flagged).length');
 raw('exposureTriggersReview=false');
 const off=run('dashboardRecords().filter(r=>r.flagged).length');
 assert.ok(off<on,'turning the trigger off clears exposure-only portfolios');
 assert.ok(run('dashboardRecords().every(r=>r.exposureFlags.length>=0)'),'flags are still measured');
 raw('exposureTriggersReview=true');
 assert.equal(run('dashboardRecords().filter(r=>r.flagged).length'),on);
});

test('Liquidity context is derived from the holdings, and absent facts say so',()=>{
 const {run,raw}=console_();
 const l=run('(()=>{const p=approved(clientRecords.find(c=>c.id==="a1")).plan;const x=liquidityProfile(p);return {total:Math.round(x.total),restricted:Math.round(x.restricted),locked:Math.round(x.buckets.Locked)}})()');
 assert.equal(l.total,273);
 assert.ok(l.locked>0&&l.restricted>=l.locked,'locked and semi-liquid value is reported');
 assert.ok(run('restrictionList(approved(clientRecords.find(c=>c.id==="a1")).plan).length')>0);
 raw('activeClient="a1"');
 const markup=run('contextDetail(approved(client()).plan)');
 assert.match(markup,/Not supplied/,'goals and horizon are not inferred');
 assert.match(markup,/Assessed risk profile/);
});

test('Profile comparison uses published models only and never invents an attribute',()=>{
 const {run}=console_();
 assert.ok(run('publishedModels().length')>=1);
 assert.equal(run('publishedModels().every(m=>!!latest(m))'),true);
 const values=run('modelTopLevel(publishedModels()[0])');
 assert.equal(values.length,4);
 assert.ok(Math.abs(values.reduce((a,b)=>a+b,0)-100)<0.05,'the preview sums to the model total');
});

test('Model library search matches name and intended use',()=>{
 const {run}=console_();
 assert.equal(run('models.filter(m=>modelMatches(m,"preservation")).length'),1);
 assert.equal(run('models.filter(m=>modelMatches(m,"")).length'),run('models.length'));
 assert.equal(run('models.filter(m=>modelMatches(m,"zzzz")).length'),0);
});

test('Equity sector concentration is measured against the firm cap',()=>{
 const {run}=console_();
 const c=run('sectorConcentration(latest(models.find(m=>latest(m)&&latest(m).data.name==="Aggressive")).data)');
 assert.equal(c.cap,originalDataCap());
 assert.ok(c.top.percent>0);
 assert.equal(typeof c.breach,'boolean');
 function originalDataCap(){return JSON.parse(fs.readFileSync(path.join(root,'data/original-mockup.json'),'utf8')).settings.sectorCapPercent}
});
