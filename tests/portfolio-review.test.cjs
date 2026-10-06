const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
function preview(){
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',setAttribute(){},addEventListener(){},querySelector(){return null}});return elements.get(id)};
 const ctx=vm.createContext({originalData:JSON.parse(fs.readFileSync(path.join(root,'data/original-mockup.json'),'utf8')),crypto:require('node:crypto').webcrypto,document:{getElementById:el,addEventListener(){}},window:{addEventListener(){},scrollTo(){}},localStorage:{getItem(){return null},setItem(){}},setTimeout,clearTimeout});
 for(const f of ['models.js','portfolio-views.js','portfolios.js','comparison-data.js','portfolio-workspace.js','portfolio-review.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
 return code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',ctx));
}
test('Review summary explains the largest gap and preserves neutral/exposure-only states',()=>{
 const run=preview();
 assert.match(run('reviewSummary(dashboardRecords().find(r=>r.id==="h1")).title'),/Real assets.*10.1 pp above/);
 assert.equal(run('reviewSummary(dashboardRecords().find(r=>r.id==="h4")).tone'),'clear');
 assert.match(run('reviewSummary(dashboardRecords().find(r=>r.id==="h2")).title'),/within/);
 assert.match(run('reviewSummary(dashboardRecords().find(r=>r.id==="h3")).title'),/exposure/);
});
test('Exposure preview shows four flags first and all flags remain accessible',()=>{
 const run=preview();
 const limited=run('reviewExposures(dashboardRecords().find(r=>r.id==="h1"))');
 assert.match(limited,/Showing 4 of 9 flags/);assert.match(limited,/Show all 9 flags/);
 assert.equal((limited.match(/class="review-bucket"/g)||[]).length,4);
 const full=run('(rowReviewShowAll.add("h1"),reviewExposures(dashboardRecords().find(r=>r.id==="h1")))');
 assert.equal((full.match(/class="review-bucket"/g)||[]).length,9);
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

test('An approved portfolio lens limit replaces the default band in review flags',()=>{
 const run=preview();
 const before=run('(clientView="accounts",dashboardRecords().find(r=>r.id==="a1").exposureFlags.length)');
 const after=run(`(()=>{const c=clientRecords.find(x=>x.id==="a1");const p=approved(c).plan;
  p.lensOverrides={sec:Object.fromEntries(dashboardRecords().find(r=>r.id==="a1").exposureFlags.filter(f=>f.lens==="sec").map(f=>[f.name,{band:50}]))};
  return dashboardRecords().find(r=>r.id==="a1").exposureFlags.length})()`);
 assert.ok(before>after,'widening approved sector bands must clear those flags');
 const sourced=run('dashboardRecords().find(r=>r.id==="a1").exposureFlags.every(f=>["portfolio","default"].includes(f.limitSource))');
 assert.equal(sourced,true);
});

test('Review reason names the cause so a within-threshold bar can still say Needs review',()=>{
 const run=preview();
 assert.equal(run('reviewReason(dashboardRecords().find(r=>r.id==="h6"))'),'Exposure only');
 assert.equal(run('reviewLabel(dashboardRecords().find(r=>r.id==="h2"))'),'Within threshold');
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
