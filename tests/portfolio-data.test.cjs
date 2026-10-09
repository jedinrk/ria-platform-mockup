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
 for(const f of ['taxonomy.js','models.js','portfolio-views.js','portfolios.js','comparison-data.js','portfolio-workspace.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
 vm.runInContext('const comparisonState={active:false}',ctx);
 return code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',ctx));
}
test('Original accounts, households, holdings and AUM are preserved',()=>{
 assert.equal(data.accounts.length,12);assert.equal(data.households.length,6);
 // The master carries 31 instruments; the sample portfolios still hold the original 19.
 assert.equal(data.securities.length,31);
 assert.equal(data.securities.filter(s=>data.accounts[0].holdings.some(h=>h.securityId===s.id)).length,19);
 assert.equal(data.accounts.reduce((s,a)=>s+a.aumLakh,0),1968);
 for(const a of data.accounts){assert.equal(a.holdings.length,19);assert.ok(Math.abs(a.holdings.reduce((s,h)=>s+h.valueLakh,0)-a.aumLakh)<1e-9)}
 const held=data.securities.filter(s=>data.accounts[0].holdings.some(h=>h.securityId===s.id));
 assert.deepEqual(data.accounts[0].holdings.map(h=>h.valueLakh),data.accounts[0].holdings.map(h=>held.find(s=>s.id===h.securityId).baseValueLakh));
 assert.equal(data.accounts[0].name,'Mehta Joint (demat + physical)');
 assert.deepEqual(data.securities.filter(s=>s.lookThrough).map(s=>s.name),['Parag Parikh Flexi Cap','Nippon India Small Cap','UTI Nifty 50 Index','Nippon Nifty BeES','Motilal Midcap 150 ETF']);
});

test('Every instrument carries the nine configuration-sheet columns',()=>{
 const columns=['name','isin','symbol','crisilRating','currentPrice','assetType','assetClass','superSector'];
 for(const s of data.securities){
  for(const column of columns)assert.ok(column in s,s.name+' is missing '+column);
  assert.ok('sector' in s.tags&&'subsector' in s.tags,s.name+' is missing sector/sub-sector');
  // ISIN and Current Price have no source, so they are null rather than invented.
  assert.equal(s.isin,null);assert.equal(s.currentPrice,null);
 }
 assert.equal(data.securities.filter(s=>s.symbol).length,10);
 assert.equal(data.securities.find(s=>s.name==='HDFC Bank').symbol,'HDFCBANK');
 // A rating that cannot apply is distinguished from one that is simply absent.
 assert.equal(data.securities.filter(s=>s.ratingApplies).length,7);
 assert.ok(data.securities.filter(s=>s.ratingApplies).every(s=>s.crisilRating));
 assert.ok(data.securities.filter(s=>!s.ratingApplies).every(s=>s.crisilRating===null));
});
test('Recorded holdings survive a model change unchanged',()=>{
 // Holdings were materialized once from the original wireframe. Switching the
 // allocation hierarchy and the model set does not rewrite them: a portfolio
 // holds what it holds, and a model is what it is measured against.
 for(const a of data.accounts){
  assert.equal(a.holdings.length,19,a.name+' should still hold the original nineteen');
  for(const h of a.holdings)assert.ok(h.valueLakh>0&&Number.isFinite(h.valueLakh));
  if(!a.generation.usesBase)assert.ok(Math.abs(a.holdings.reduce((s,h)=>s+h.valueLakh,0)-a.aumLakh)<1e-9);
 }
 // The twelve instruments the security master added sit in the tree but unheld.
 const held=new Set(data.accounts.flatMap(a=>a.holdings.map(h=>h.securityId)));
 assert.equal(data.securities.filter(s=>!held.has(s.id)).length,12);
});
test('Seven models are published, each totalling 100% and naming its intended profile',()=>{
 const run=runtime();
 assert.equal(run('models.length'),7);
 assert.deepEqual(run('models.map(m=>latest(m).data.kind)'),
  ['Risk-based','Risk-based','Risk-based','Strategy','Strategy','Strategy','Strategy']);
 for(const profile of run('models.map(m=>latest(m).data.riskProfile)'))
  assert.ok(['Conservative','Moderate','Aggressive'].includes(profile),profile);
 const totals=run('models.map(m=>latest(m).data.allocations.map(n=>Math.round(n.target)))');
 assert.deepEqual(totals,[[30,45,5,20],[50,25,10,15],[65,12,13,10],[72,8,14,6],[45,25,10,20],[35,20,10,35],[35,15,35,15]]);
 for(const classes of totals)assert.equal(classes.reduce((a,b)=>a+b,0),100);
 assert.deepEqual(run('clientRecords.map(c=>targetIssues(approved(c).plan))'),Array.from({length:12},()=>[]));
 assert.ok(run('clientRecords.every(c=>approved(c).plan.assets.every(a=>a.included))'));
});
test('Look-through uses each original dimension independently; single tag does not split',()=>{
 const run=runtime();
 assert.deepEqual(run("Array.from(exposure([{name:'Parag Parikh Flexi Cap',value:10,category:'Equity'}],'geo').buckets)"),[['India',6.5],['Global',3.5]]);
 assert.equal(run("exposure([{name:'SBI FD (Mar 2028)',value:10,category:'Fixed income'}],'cr').total"),10);
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

test('Below the model level a row has no target, which is not a target of zero',()=>{
 const run=runtime();
 const rows=run('alignedPortfolioRows(approved(clientRecords[0]).plan)');
 // The classification tree, to each branch's own depth.
 assert.equal(rows.length,109);
 // Four equity names the security master added are not held by this account.
 assert.equal(rows.find(r=>r.names.length===1&&r.names[0]==='Equity').actual,120);

 // Equity is modelled to sub-sector, so an individual holding below that level
 // is reported with what it holds and no target at all.
 const holding=rows.find(r=>r.names.at(-1)==='Parag Parikh Flexi Cap');
 assert.ok(holding.actual>0,'the holding still shows its value');
 assert.equal(holding.values[1],null,'and no target, because the model does not reach it');

 // A sub-sector the model deliberately sets to nothing reads as zero, not as
 // absent: Conservative holds no small caps on purpose.
 const conservative=run('alignedPortfolioRows(approved(clientRecords.find(c=>c.modelName==="Conservative")).plan)');
 const deliberate=conservative.find(r=>r.names.at(-1)==='Small cap');
 assert.equal(deliberate.values[1],0);

 // A branch dropped from a draft keeps its actual value and loses its target.
 run("(clientRecords[0].draft=copy(approved(clientRecords[0]).plan),(function drop(ns){for(const n of ns){const i=n.children.findIndex(c=>c.name==='Multi-sector funds');if(i>=0){n.children.splice(i,1);return true}if(drop(n.children))return true}return false})(clientRecords[0].draft.base.data.allocations),true)");
 const dropped=run('alignedPortfolioRows(clientRecords[0].draft)').find(r=>r.names.at(-1)==='Parag Parikh Flexi Cap');
 assert.equal(dropped.actual,30);
 assert.equal(dropped.values[1],null);
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
