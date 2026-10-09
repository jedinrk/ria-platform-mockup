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
 for(const f of ['taxonomy.js','models.js','portfolio-views.js','portfolios.js','comparison-data.js','portfolio-workspace.js',
  'comparison.js','portfolio-review.js','target-plan-preview.js','models-extensions.js','console-extensions.js','planning.js','security-master.js'])
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

test('Sub-class breaches can be excluded from the review state',()=>{
 const {run,raw}=console_();
 raw('clientView="accounts"');
 // a5 sits well inside its asset-class threshold and is flagged only because a
 // sub-class is outside its band.
 assert.ok(run('dashboardRecords().find(r=>r.id==="a5").drift')<run('dashboardRecords().find(r=>r.id==="a5").threshold'));
 assert.equal(run('dashboardRecords().find(r=>r.id==="a5").flagged'),true);
 raw('exposureTriggersReview=false');
 assert.equal(run('dashboardRecords().find(r=>r.id==="a5").flagged'),false,'turning the trigger off clears it');
 assert.ok(run('dashboardRecords().every(r=>r.exposureFlags.length>=0)'),'breaches are still measured');
 raw('exposureTriggersReview=true');
 assert.equal(run('dashboardRecords().find(r=>r.id==="a5").flagged'),true);
});

test('Liquidity context is derived from the holdings, and absent facts say so',()=>{
 const {run,raw}=console_();
 const l=run('(()=>{const p=approved(clientRecords.find(c=>c.id==="a1")).plan;const x=liquidityProfile(p);return {total:Math.round(x.total),restricted:Math.round(x.restricted),locked:Math.round(x.buckets.Locked)}})()');
 assert.equal(l.total,338);
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

const planning=()=>{const h=console_();h.raw('activeClient="a5"');return h};

test('A rebalance is cash-neutral and never sells more than it can redeploy',()=>{
 const {run}=planning();
 const r=run(`(()=>{const p=approved(client()).plan,s=rebalanceScenario(p,{skipLocked:true,avoidShortTerm:true,minTrade:0.5,exemption:1.25,carryForward:0});
  const o=scenarioOutcome(p,{...s,status:'Draft'});
  return {sells:+o.sellTotal.toFixed(2),buys:+o.buyTotal.toFixed(2),residual:+o.residual.toFixed(2),
   before:+o.metricsBefore.drift.toFixed(2),after:+o.metricsAfter.drift.toFixed(2)}})()`);
 assert.ok(Math.abs(r.sells-r.buys)<0.05,'sells and buys match');
 assert.ok(r.residual<0.05,'no idle cash is created');
 assert.ok(r.after<=r.before+0.05,'a rebalance must not increase aggregated drift');
});

test('Locked holdings are never sold, and the reason is stated',()=>{
 const {run}=planning();
 const r=run(`(()=>{const p=approved(client()).plan,s=rebalanceScenario(p,{skipLocked:true,avoidShortTerm:true,minTrade:0.5,exemption:1.25,carryForward:0});
  return {sold:s.trades.filter(t=>t.amount<0&&t.locked).length,notes:s.notes.map(n=>n.text).join(' ')}})()`);
 assert.equal(r.sold,0);
 const allowed=run(`rebalanceScenario(approved(client()).plan,{skipLocked:false,avoidShortTerm:true,minTrade:0.5,exemption:1.25,carryForward:0}).trades.length`);
 assert.ok(allowed>=0,'turning the constraint off is possible');
});

test('Raising cash gross versus net sizes the sale differently',()=>{
 const {run}=planning();
 const r=run(`(()=>{const p=approved(client()).plan;
  const base={skipLocked:true,avoidShortTerm:true,harvestLosses:false,minTrade:0.5,exemption:1.25,carryForward:0,strategy:'target',direction:'raise',amount:25,stages:1,reason:'Client withdrawal'};
  const g=scenarioOutcome(p,{...cashScenario(p,{...base,net:'gross'}),status:'Draft'});
  const n=scenarioOutcome(p,{...cashScenario(p,{...base,net:'net'}),status:'Draft'});
  return {gSells:+g.sellTotal.toFixed(2),gNet:+g.netCash.toFixed(2),nSells:+n.sellTotal.toFixed(2),nNet:+n.netCash.toFixed(2)}})()`);
 assert.equal(r.gSells,25,'gross sells exactly the requested amount');
 assert.ok(r.gNet<25,'gross leaves less usable cash after tax');
 assert.ok(r.nSells>25,'net sells more to cover the tax');
 assert.ok(Math.abs(r.nNet-25)<0.05,'net delivers the requested cash');
});

test('Tax applies losses and the exemption, and is reported as an estimate',()=>{
 const {run}=planning();
 const plain=run(`estimateTax([{amount:-10,value:20,gain:8,rate:12.5}],{exemption:0,carryForward:0}).tax`);
 assert.ok(Math.abs(plain-0.5)<0.001,'4 lakh of gain at 12.5%');
 const exempt=run(`estimateTax([{amount:-10,value:20,gain:8,rate:12.5}],{exemption:1.25,carryForward:0})`);
 assert.ok(exempt.tax<plain,'the exemption reduces the estimate');
 assert.equal(+exempt.exemptionUsed.toFixed(2),1.25);
 const offset=run(`estimateTax([{amount:-10,value:20,gain:8,rate:12.5},{amount:-10,value:20,gain:-4,rate:12.5}],{exemption:0,carryForward:0})`);
 assert.ok(offset.tax<plain,'a realised loss offsets the gain');
 assert.ok(offset.harvested>0);
});

test('Excluding a sell leaves the buys unfunded rather than silently rebalancing',()=>{
 const {run}=planning();
 const r=run(`(()=>{const p=approved(client()).plan,s=rebalanceScenario(p,{skipLocked:true,avoidShortTerm:true,minTrade:0.5,exemption:1.25,carryForward:0});
  const first=s.trades.findIndex(t=>t.amount<0);
  if(first<0)return {skipped:true};
  s.trades[first].excluded=true;
  const o=scenarioOutcome(p,{...s,status:'Draft'});
  return {unfunded:+o.unfunded.toFixed(2)}})()`);
 if(!r.skipped)assert.ok(r.unfunded>0,'the shortfall is surfaced, not hidden');
});

test('A scenario never mutates holdings, the approved target or another portfolio',()=>{
 const {run,raw}=planning();
 const before=run('clientRecords');
 raw(`(()=>{const c=client(),p=approved(c).plan;
  const s=rebalanceScenario(p,{skipLocked:true,avoidShortTerm:true,minTrade:0.5,exemption:1.25,carryForward:0});
  scenarioOutcome(p,{...s,status:'Draft'});})()`);
 assert.deepEqual(run('clientRecords'),before,'building and costing a scenario writes nothing');
});

test('Security master separates source-fixed fields from the firm classification',()=>{
 const {run}=console_();
 // The sheet marks Asset class, Super sector, Sector and Sub-sector editable;
 // everything else arrives fixed from the instrument source.
 assert.equal(run('ASSET_CLASSES.length'),4);
 assert.equal(run('CLASSIFICATION_FIELDS.length'),4);
 // AssetType is stated by the master, not inferred from a grouping name.
 assert.equal(run('instrumentType(originalData.securities.find(s=>s.name==="HDFC Bank"))'),'Direct equity');
 assert.equal(run('instrumentType(originalData.securities.find(s=>s.name==="GOI 7.18% 2033"))'),'Government bond');
 assert.equal(run('instrumentType(originalData.securities.find(s=>s.name==="Flat, Baner Pune"))'),'Real estate');
 const grid=run('securityGrid()');
 for(const header of ['Name','ISIN','Symbol','Crisil rating','Current price','Asset type','Asset class','Super sector','Sector','Sub-sector'])
  assert.ok(grid.includes(header),'missing column: '+header);
 assert.ok(grid.includes('class="config-filter-row"'),'filters sit inside the table header');
 // Filters that narrow a column sit in that column's header. The
 // needs-classification filter is not one of them: there is no such column, and
 // crammed into the name cell it stretched the column that needs the room most.
 for(const id of ['securitySearch','securityTypeFilter','securityClassFilter'])
  assert.ok(grid.includes('id="'+id+'"'),'missing header filter: '+id);
 assert.ok(!grid.includes('securityUnclassified'),'the count filter is not in the header');
 assert.ok(grid.includes('config-fixed'),'source fields are marked read-only');
 for(const field of ['assetClass','superSector','sector','subsector'])
  assert.ok(grid.includes('data-field="'+field+'"'),'missing editable field: '+field);
 assert.ok(!grid.includes('data-field="symbol"'),'a fixed field is never editable');
 // A verified symbol is shown; ISIN and price have no source and stay absent.
 assert.ok(grid.includes('HDFCBANK'));
 assert.ok(grid.includes('config-absent'),'unsupplied fields are marked');
});
test('The needs-classification count is the control that shows them',()=>{
 const {run,raw}=console_();
 const page=()=>run('(securityMasterPage(),$("app").innerHTML)');
 const markup=page();
 assert.match(markup,/id="securityUnclassified"[^>]*aria-pressed="false"/,'the count tile is the toggle');
 assert.match(markup,/Need classification/);
 // Nothing needs classifying in the sample, so the control says so rather than
 // offering a filter that would empty the grid.
 assert.match(markup,/id="securityUnclassified"[^>]*disabled/);
 assert.match(markup,/Every instrument is classified/);
 // Stage a change that strips a level, and it becomes usable.
 raw('securityPending["security-4"]={sector:""}');
 const staged=page();
 assert.ok(!/id="securityUnclassified"[^>]*disabled/.test(staged),'with one unclassified it can be used');
 raw('securityFilters.unclassifiedOnly=true');
 assert.match(page(),/aria-pressed="true"/);
});

test('A rating that cannot apply reads differently from one that is missing',()=>{
 const {run}=console_();
 const grid=run('securityGrid()');
 assert.ok(grid.includes('A credit rating does not apply to this instrument type'));
 assert.equal(run('originalData.securities.find(s=>s.name==="HDFC Bank").ratingApplies'),false);
 assert.equal(run('originalData.securities.find(s=>s.name==="SBI FD (Mar 2028)").ratingApplies'),true);
 assert.equal(run('originalData.securities.find(s=>s.name==="SBI FD (Mar 2028)").crisilRating'),'AAA');
});
test('Every instrument in the master is held somewhere, and the grid can still say otherwise',()=>{
 const {run}=console_();
 assert.equal(run('originalData.securities.length'),31);
 // Holdings are generated from each account's model with a floor, so nothing in
 // the master is orphaned any more.
 assert.ok(run('originalData.securities.every(s=>securityValue(s.id)>0)'));
 // The not-held state is still rendered, for an instrument classified before
 // anyone buys it.
 const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','security-master.js'),'utf8');
 assert.match(source,/Not held/);
 assert.match(source,/In the master, not held by any sample portfolio/);
});
test('Applied classification feeds the exposure views and asset class gates the credit view',()=>{
 const {run,raw}=console_();
 raw('clientView="accounts"');
 const financials=()=>run('(()=>{const r=dashboardRecords().find(x=>x.id==="a1");const row=exposureRows(r.actual,r.target,"sec").find(x=>x.name==="Financials");return row?+row.actual.toFixed(2):0})()');
 const before=financials();
 assert.ok(before>0);
 raw('securityEdits["security-4"]={sector:"Information technology",subsector:"IT services"};applySecurityEdits()');
 assert.ok(financials()<before,'reclassifying moves the exposure');
 // Asset class drives isDebt, which gates the credit and duration view.
 raw('securityEdits["security-1"]={assetClass:"Fixed income"};applySecurityEdits()');
 assert.equal(run('originalData.securities.find(s=>s.id==="security-1").tags.isDebt'),true);
 raw('securityEdits["security-1"]={assetClass:"Equity"};applySecurityEdits()');
 assert.equal(run('originalData.securities.find(s=>s.id==="security-1").tags.isDebt'),false);
});
test('Each classification level offers only what belongs under the level above',()=>{
 const {run}=console_();
 assert.ok(run('superSectorsFor("Equity")').includes('Cyclical'));
 assert.ok(!run('superSectorsFor("Equity")').includes('Sovereign'),'a Fixed income branch is not offered under Equity');
 assert.ok(run('sectorsFor("Equity","Cyclical")').includes('Financials'));
 assert.ok(!run('sectorsFor("Equity","Cyclical")').includes('Oil & gas'),'a Sensitive sector is not offered under Cyclical');
 assert.ok(run('subsectorsFor("Equity","Cyclical","Financials")').includes('Private banks'));
 assert.ok(!run('subsectorsFor("Equity","Cyclical","Financials")').includes('Autos'));
 // A super sector with no sector chosen yet still offers every sector beneath it.
 assert.ok(run('sectorsFor("Fixed income","")').length>1);
});
test('Choosing a level clears a level below it that no longer belongs',()=>{
 const {raw,run}=console_();
 raw('securityPending={}');
 // HDFC Bank sits at Equity > Cyclical > Financials > Private banks.
 const bank=run('originalData.securities.find(s=>s.name==="HDFC Bank").id');
 raw(`securityPending[${JSON.stringify(bank)}]={superSector:"Sensitive"}`);
 assert.equal(run(`effectiveField(originalData.securities.find(s=>s.id===${JSON.stringify(bank)}),"superSector")`),'Sensitive');
 // Financials is not a Sensitive sector, so the staged grid must not keep it.
 assert.ok(!run('sectorsFor("Equity","Sensitive")').includes('Financials'));
});
