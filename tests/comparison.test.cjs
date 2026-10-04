const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const D=require('../comparison-data.js');
const securities=require('../data/model-exposures.json').securities;
const node=(name,target,children=[])=>({name,target,children});
test('Hierarchy alignment preserves missing versus explicit zero across four different models',()=>{
 const models=[{allocations:[node('Equity',100,[node('ETFs',100,[node('A',100)])])]}, {allocations:[node('Equity',100,[node('ETFs',100,[node('A',0),node('B',100)])])]}, {allocations:[node('Debt',100,[node('Bonds',100)])]}, {allocations:[node('Equity',100,[node('ETFs',100,[node('B',100)])])]}];
 const aligned=D.aligned(models);
 assert.deepEqual(aligned.find(r=>r.node.name==='A').values,[100,0,null,null]);
 assert.deepEqual(aligned.find(r=>r.node.name==='B').values,[null,100,null,100]);
 assert.deepEqual(aligned.find(r=>r.node.name==='Debt').values,[null,null,100,null]);
 assert.equal(aligned.filter(r=>r.node.name==='B').length,1);
});
test('Names containing slashes do not collide with nested paths',()=>{
 const rows=D.aligned([{allocations:[node('EPF / PPF',100)]},{allocations:[node('EPF',100,[node('PPF',100)])]}]);
 assert.equal(rows.length,3);assert.equal(new Set(rows.map(r=>r.key)).size,3);
});
test('Look-through and single-tag exposure use the same source and preserve allocation data',()=>{
 const model={allocations:[node('Equity',100,[node('Parag Parikh Flexi Cap',100)])]};
 const before=JSON.stringify(model);
 assert.deepEqual([...D.exposures(model,securities,'geography','look').buckets],[['India',65],['Global',35]]);
 assert.deepEqual([...D.exposures(model,securities,'geography','tag').buckets],[['India',100]]);
 assert.equal(JSON.stringify(model),before);
});
test('Unknown holdings remain visible and no-debt models are not applicable in debt lens',()=>{
 const model={allocations:[node('Equity',100,[node('Unmapped investment',100)])]};
 assert.deepEqual([...D.exposures(model,securities,'sector','look').buckets],[['Unclassified',100]]);
 assert.equal(D.exposures(model,securities,'credit','look').applicable,false);
 const debt={allocations:[node('Debt',20,[node('GOI 7.18% 2033',20)])]};
 assert.equal(D.exposures(debt,securities,'credit','look').buckets.get('Sovereign / Long'),100);
});
test('Selection UI scales to larger libraries, limits columns to four, and excludes drafts',()=>{
 const elements={app:{innerHTML:'',insertAdjacentHTML(){}},footer:{innerHTML:''}},handlers={};
 const published=Array.from({length:6},(_,i)=>({id:'m'+i,versions:[{data:{name:'Model '+i,description:'Published',allocations:[node('Equity',100)]}}],draft:{name:'Draft name',allocations:[]}}));
 const context=vm.createContext({ComparisonData:D,models:[...published,{id:'draft-only',versions:[],draft:{name:'Not published'}}],latest:m=>m.versions.at(-1),list(){},$:id=>elements[id],esc:x=>String(x??'').replace(/[&<>"']/g,'_'),fmt:String,colours:['green'],document:{addEventListener:(event,fn)=>handlers[event]=fn},Set,fetch(){throw Error('Not needed')}});
 vm.runInContext(fs.readFileSync(require.resolve('../comparison.js'),'utf8'),context);
 vm.runInContext("comparisonState.selected.add('m3');renderComparison()",context);
 assert.match(elements.app.innerHTML,/4 of 4 selected · 6 available/);
 assert.doesNotMatch(elements.app.innerHTML,/Draft name|Not published/);
 assert.match(elements.app.innerHTML,/data-compare-model="m4"\s+disabled/);
 handlers.change({target:{dataset:{compareModel:'m4'},checked:true}});
 assert.equal(vm.runInContext('comparisonState.selected.size',context),4);
 vm.runInContext("comparisonState.search='Model 5';renderComparison()",context);
 assert.match(elements.app.innerHTML,/4 of 4 selected/);
 assert.match(elements.app.innerHTML,/data-compare-model="m5"/);
});
