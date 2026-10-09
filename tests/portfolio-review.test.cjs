const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
function preview(){
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',setAttribute(){},addEventListener(){},querySelector(){return null}});return elements.get(id)};
 const ctx=vm.createContext({originalData:JSON.parse(fs.readFileSync(path.join(root,'data/original-mockup.json'),'utf8')),crypto:require('node:crypto').webcrypto,document:{getElementById:el,addEventListener(){}},window:{addEventListener(){},scrollTo(){}},localStorage:{getItem(){return null},setItem(){}},setTimeout,clearTimeout});
 for(const f of ['taxonomy.js','models.js','portfolio-views.js','portfolios.js','comparison-data.js','portfolio-workspace.js','portfolio-review.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
 return code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',ctx));
}
test('Review summary names the largest gap, and reports a clear portfolio as clear',()=>{
 const run=preview();
 // Adopting the revised models left every household off its target, so the
 // summary states which asset class is furthest out.
 assert.match(run('reviewSummary(dashboardRecords().find(r=>r.id==="h1")).title'),/Real assets.*12.6 pp above/);
 assert.match(run('reviewSummary(dashboardRecords().find(r=>r.id==="h6")).title'),/Alternatives.*10 pp below/);
 for(const id of ['h1','h2','h3','h4','h5','h6'])
  assert.equal(run(`reviewSummary(dashboardRecords().find(r=>r.id==="${id}")).tone`),'attention');
 // Widen the threshold past its drift and the firm's sub-class bands past every
 // breach, and the same household reads as clear: the state is derived from the
 // numbers, not hard-coded. A household uses the firm bands, not an account's.
 const clear=run(`(()=>{reviewRules.overrides.h2=40;
  originalData.settings.defaultBandsByLevel=[null,90,90,90,90];
  return reviewSummary(dashboardRecords().find(r=>r.id==="h2")).tone})()`);
 assert.equal(clear,'clear');
});
test('Sub-class flag preview caps the list and keeps every flag reachable',()=>{
 const run=preview();
 const total=run('dashboardRecords().find(r=>r.id==="h4").exposureFlags.length');
 assert.ok(total>4,'the sample needs more than four flags for this to mean anything');
 const limited=run('reviewExposures(dashboardRecords().find(r=>r.id==="h4"))');
 assert.match(limited,new RegExp('Showing 4 of '+total+' flags'));
 assert.match(limited,new RegExp('Show all '+total+' flags'));
 assert.equal((limited.match(/class="review-bucket"/g)||[]).length,4);
 const full=run('(rowReviewShowAll.add("h4"),reviewExposures(dashboardRecords().find(r=>r.id==="h4")))');
 assert.equal((full.match(/class="review-bucket"/g)||[]).length,total);
});
test('Household accounts and individual account context use different layouts',()=>{
 const run=preview();
 assert.match(run('reviewAccounts(dashboardRecords()[0])'),/Accounts in this household/);
 run('(clientView="accounts",true)');
 const html=run('reviewAccounts(dashboardRecords()[0])');
 assert.match(html,/Account context/);assert.match(html,/Ownership type/);assert.match(html,/Mehta Family/);
});
test('Review tabs do not mutate allocations or approved plans',()=>{
 const run=preview(),before=run('clientRecords');
 const html=run('(rowReviewTabs.set("h1","accounts"),reviewPanel(dashboardRecords()[0]))');
 assert.match(html,/role="tablist"/);assert.match(html,/role="tabpanel"/);assert.match(html,/aria-selected="true"/);
 assert.deepEqual(run('clientRecords'),before);
 const bars=run('reviewAllocation(dashboardRecords()[0])');
 assert.match(bars,/review-target-track/);assert.doesNotMatch(bars,/class="review-track target"/);
});

test('Listing expansion is a concise disclosure, not the detailed tabbed workspace',()=>{
 const run=preview();
 const collapsed=run('dashboardRow(dashboardRecords().find(r=>r.id==="h1"))');
 assert.match(collapsed,/aria-expanded="false"/);assert.doesNotMatch(collapsed,/class="quick-review"/);
 const expanded=run('(dashboardExpanded.add("h1"),dashboardRow(dashboardRecords().find(r=>r.id==="h1")))');
 assert.match(expanded,/aria-expanded="true"/);assert.doesNotMatch(expanded,/expanded-label/);assert.match(expanded,/Collapse Mehta Family/);
 assert.match(expanded,/Open household/);assert.doesNotMatch(expanded,/role="tablist"/);assert.doesNotMatch(expanded,/review-allocation-grid/);
 // Concise, but it must answer "why" in place: drift by class, accounts, exposure.
 assert.match(expanded,/Drift by asset class/);assert.match(expanded,/<h4>Accounts<\/h4>/);assert.match(expanded,/Exposure buckets outside limits/);
 assert.match(expanded,/Ritu Mehta/);assert.match(expanded,/Review threshold 5 pp/);
});

test('An approved portfolio band replaces the model band in review flags',()=>{
 const run=preview();
 const before=run('(clientView="accounts",dashboardRecords().find(r=>r.id==="a6").exposureFlags.length)');
 assert.ok(before>0);
 const after=run(`(()=>{const p=approved(clientRecords.find(x=>x.id==="a6")).plan;
  p.treeOverrides={bands:Object.fromEntries(dashboardRecords().find(r=>r.id==="a6").rows.filter(r=>r.level>0).map(r=>[r.key,90]))};
  return dashboardRecords().find(r=>r.id==="a6").exposureFlags.length})()`);
 assert.ok(before>after,'widening the approved bands must clear those flags');
 const sourced=run('dashboardRecords().find(r=>r.id==="a6").exposureFlags.every(f=>["portfolio","default"].includes(f.limitSource))');
 assert.equal(sourced,true);
});

test('Review reason names the cause, so a within-threshold bar can still need review',()=>{
 const run=preview();
 // Raise one household's threshold above its drift and it is flagged on
 // sub-class breaches alone.
 const reason=run('(reviewRules.overrides.h3=40,reviewReason(dashboardRecords().find(r=>r.id==="h3")))');
 assert.equal(reason,'Exposure only');
 assert.equal(run('reviewLabel(dashboardRecords().find(r=>r.id==="h3"))'),'Needs review');
 // Widen the firm's sub-class bands too and it falls back to within threshold.
 const label=run(`(originalData.settings.defaultBandsByLevel=[null,90,90,90,90],reviewLabel(dashboardRecords().find(r=>r.id==="h3")))`);
 assert.equal(label,'Within threshold');
});

test('Detail lookup does not change the listing grouping or saved records',()=>{
 const run=preview(),before=run('clientRecords');
 assert.equal(run('reviewRecord("a1").name'),'Mehta Joint (demat + physical)');
 assert.equal(run('clientView'),'households');
 assert.equal(run('reviewRecord("h1").members.length'),2);
 assert.deepEqual(run('clientRecords'),before);
});

test('Threshold bar midpoint equals the threshold and full width equals twice it',()=>{
 const run=preview();
 assert.match(run('driftBar({drift:5,threshold:5})'),/width:50%/);
 assert.match(run('driftBar({drift:10,threshold:5})'),/width:100%/);
 assert.match(run('driftBar({drift:12,threshold:5})'),/width:100%/);
 assert.match(run('driftBar({drift:5,threshold:5})'),/within threshold/);
 assert.match(run('driftBar({drift:5.5,threshold:5})'),/above threshold/);
});

test('Firm inheritance and explicit overrides are independent of targets and holdings',()=>{
 const run=preview(),before=run('clientRecords');
 run('(reviewRules.firm=7,reviewRules.overrides.h1=12,delete reviewRules.overrides.h2,true)');
 assert.equal(run('reviewRecord("h1").threshold'),12);
 assert.equal(run('reviewRecord("h2").threshold'),7);
 run('(reviewRules.firm=8,delete reviewRules.overrides.h1,true)');
 assert.equal(run('reviewRecord("h1").threshold'),8);
 assert.deepEqual(run('clientRecords'),before);
 assert.match(run('thresholdInput(reviewRecord("h1"))'),/value="" placeholder="8"/);
});

test('Threshold validation rejects invalid numbers instead of clamping',()=>{
 const run=preview();
 assert.deepEqual(run('[0,-1,0.25,0.75,NaN,Infinity].map(validThreshold)'),[false,false,false,false,false,false]);
 assert.deepEqual(run('[0.5,1,5.5,100].map(validThreshold)'),[true,true,true,true]);
});
