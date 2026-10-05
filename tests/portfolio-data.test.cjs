const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/original-mockup.json'),'utf8'));
function runtime(){
 const elements=new Map(),storage=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',setAttribute(){},querySelector(){return null},addEventListener(){},close(){},showModal(){}});return elements.get(id)};
 const ctx=vm.createContext({originalData:structuredClone(data),crypto:require('node:crypto').webcrypto,document:{getElementById:el,addEventListener(){}},window:{addEventListener(){},scrollTo(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout,clearTimeout});
 for(const f of ['models.js','portfolio-views.js','portfolios.js','comparison-data.js','portfolio-workspace.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
 vm.runInContext('const comparisonState={active:false}',ctx);
 return code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',ctx));
}
test('Original accounts, households, holdings and AUM are preserved',()=>{
 assert.equal(data.accounts.length,12);assert.equal(data.households.length,6);assert.equal(data.securities.length,19);
 assert.equal(data.accounts.reduce((s,a)=>s+a.aumLakh,0),1968);
 for(const a of data.accounts){assert.equal(a.holdings.length,19);assert.ok(Math.abs(a.holdings.reduce((s,h)=>s+h.valueLakh,0)-a.aumLakh)<1e-9)}
 assert.deepEqual(data.accounts[0].holdings.map(h=>h.valueLakh),data.securities.map(s=>s.baseValueLakh));
 assert.equal(data.accounts[0].name,'Mehta Joint (demat + physical)');
 assert.deepEqual(data.securities.filter(s=>s.lookThrough).map(s=>s.name),['Parag Parikh Flexi Cap','Nippon India Small Cap','UTI Nifty 50 Index','Nippon Nifty BeES','Motilal Midcap 150 ETF']);
});

test('Standalone comparison exposure data matches the full source dataset',()=>{
 const subset=require('../data/model-exposures.json');
 assert.deepEqual(data.securities.map(({name,assetClass,tags,lookThrough})=>({name,assetClass,tags,lookThrough})),subset.securities);
});
test('Materialized synthetic holdings match the original deterministic formula',()=>{
 for(const a of data.accounts.filter(a=>!a.generation.usesBase)){
  const raw=data.modelTargets[a.riskProfile].map((t,i)=>{const x=Math.sin(+a.id.slice(1)*127.1+i*311.7)*43758.5453;const rnd=x-Math.floor(x);return Math.max(.05,t)*Math.max(.05,1+(a.generation.spread||0)*(rnd*2-1))});
  const scale=a.aumLakh/raw.reduce((s,x)=>s+x,0);
  a.holdings.forEach((h,i)=>assert.equal(h.valueLakh,raw[i]*scale));
 }
});
test('Original model class totals and full portfolio inclusion are preserved',()=>{
 const run=runtime();
 assert.deepEqual(run('Object.keys(MODEL_TARGETS).map(p=>catalogTree(p).map(n=>n.target))'),[[25,50,7,18],[50,25,12,13],[70,12,12,6]]);
 assert.deepEqual(run('clientRecords.map(c=>targetIssues(approved(c).plan))'),Array.from({length:12},()=>[]));
 assert.ok(run('clientRecords.every(c=>approved(c).plan.assets.every(a=>a.included))'));
 assert.equal(run('clientRecords.reduce((s,c)=>s+scopeValue(approved(c).plan),0)'),1968);
 assert.ok(run('clientRecords.every(c=>Object.keys(approved(c).plan.overrides).length===0)'));
});
test('Look-through uses each original dimension independently; single tag does not split',()=>{
 const run=runtime();
 assert.deepEqual(run("Array.from(exposure([{name:'Parag Parikh Flexi Cap',value:10,category:'Equity'}],'geo').buckets)"),[['India',6.5],['Global',3.5]]);
 assert.deepEqual(run("(fundMode='tag',Array.from(exposure([{name:'Parag Parikh Flexi Cap',value:10,category:'Equity'}],'geo').buckets))"),[['India',10]]);
 assert.deepEqual(run("Array.from(exposure([{name:'Unknown',value:10,category:'Equity'}],'sec').buckets)"),[['Unclassified',10]]);
 assert.equal(run("exposureRows([],[],'sec').length"),0);
});
test('Draft edits and new model publications cannot mutate approved snapshots',()=>{
 const run=runtime();
 const before=run('clientRecords.map(c=>approved(c).plan)');
 run("(clientRecords[0].draft=copy(approved(clientRecords[0]).plan),clientRecords[0].draft.overrides.Equity={target:0},true)");
 assert.deepEqual(run('clientRecords.map(c=>approved(c).plan)'),before);
 assert.ok(run('targetIssues(clientRecords[0].draft).length>0'));
 run("(models.find(m=>m.id==='full-model-1').versions.push({number:2,data:{name:'Moderate',allocations:[]}}),true)");
 assert.deepEqual(run('clientRecords.map(c=>approved(c).plan)'),before);
 assert.equal(run('newer(clientRecords[0])'),true);
 assert.equal(run("effective(clientRecords[0].draft).allocations[0].target"),0);
 run('(delete clientRecords[0].draft.overrides.Equity,true)');
 assert.equal(run('effective(clientRecords[0].draft).allocations[0].target'),50);
});
test('Household totals count each account once, including the joint account',()=>{
 const run=runtime(),totals=run('dashboardRecords().map(x=>({name:x.name,total:x.total,members:x.members.length}))');
 assert.deepEqual(totals.map(x=>x.members),[2,3,2,2,1,2]);
 assert.ok(Math.abs(totals.reduce((s,x)=>s+x.total,0)-1968)<1e-9);
 assert.ok(Math.abs(totals[0].total-363)<1e-9);
});

test('Allocation rows retain actual-only holdings and distinguish unspecified targets from zero',()=>{
 const run=runtime();
 const rows=run('alignedPortfolioRows(approved(clientRecords[0]).plan)');
 assert.equal(rows.length,33);
 assert.equal(rows.find(r=>r.names.length===1&&r.names[0]==='Equity').actual,120);
 run("(clientRecords[0].draft=copy(approved(clientRecords[0]).plan),clientRecords[0].draft.base.data.allocations[0].children[0].children.splice(0,1),true)");
 const missing=run('alignedPortfolioRows(clientRecords[0].draft)').find(r=>r.names.at(-1)==='Parag Parikh Flexi Cap');
 assert.equal(missing.actual,30);assert.equal(missing.values[1],null);
 const zero=run('alignedPortfolioRows(approved(clientRecords.find(c=>c.risk==="Conservative")).plan)').find(r=>r.names.at(-1)==='Motilal Midcap 150 ETF');
 assert.equal(zero.values[1],0);
});

test('Scope changes remain draft-only and missing exclusion reasons block approval',()=>{
 const run=runtime();
 run('(clientRecords[0].draft=copy(approved(clientRecords[0]).plan),clientRecords[0].draft.assets.at(-1).included=false,true)');
 assert.equal(run('scopeValue(clientRecords[0].draft)'),213);
 assert.equal(run('recordedValue(clientRecords[0].draft)'),273);
 assert.equal(run('scopeValue(approved(clientRecords[0]).plan)'),273);
 assert.ok(run('targetIssues(clientRecords[0].draft)').some(i=>i.includes('reason')));
 run('(clientRecords[0].draft.assets.at(-1).reason="Example scope review",true)');
 assert.deepEqual(run('targetIssues(clientRecords[0].draft)'),[]);
});

test('Dashboard review flags stay fixed when browsing Single tag exposures',()=>{
 const run=runtime();
 const before=run('dashboardRecords().map(r=>({id:r.id,flagged:r.flagged,flags:r.exposureFlags.length}))');
 run('(fundMode="tag",true)');
 assert.deepEqual(run('dashboardRecords().map(r=>({id:r.id,flagged:r.flagged,flags:r.exposureFlags.length}))'),before);
 assert.equal(run('fundMode'),'tag');
});

test('Allocation view always uses approved scope, not the saved target draft',()=>{
 const run=runtime();
 run('(activeClient=clientRecords[0].id,clientRecords[0].draft=copy(approved(clientRecords[0]).plan),clientRecords[0].draft.assets.at(-1).included=false,clientEditing=true,portfolioArea="allocation",renderClient(),true)');
 const html=run('$("app").innerHTML');
 assert.ok(html.includes('19 of 19 assets included'));
 assert.ok(html.includes('₹273 lakh'));
 assert.ok(html.includes('A target draft is saved'));
});
