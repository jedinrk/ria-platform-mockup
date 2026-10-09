'use strict';
const $=id=>document.getElementById(id),copy=x=>JSON.parse(JSON.stringify(x)),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=x=>Number(x).toFixed(1).replace(/\.0$/,''),KEY='portfolio-model-design-v4';
const colours=['#246c53','#87a796','#d3b574','#8a97b4','#aa8674'];
const CATALOG=originalData.assetHierarchy;
const MODEL_TARGETS=originalData.modelTargets;
// A model carries the classification tree down to each asset class's target
// depth. Node keys are the identity, so a stored model survives a reload and a
// reclassification moves a target with the security it belongs to.
function catalogTree(profile,zero=false){return TAX.modelTree(profile,zero)}
// Seven models: three by risk profile, four by strategy. Each names the risk
// profile it is intended for, so choosing a model and assessing a client's risk
// stay separate decisions.
function seed(){return Object.values(originalData.settings.models).map((m,i)=>{
 const d={name:m.name,description:m.description,kind:m.kind,riskProfile:m.riskProfile,abbreviation:m.abbreviation,allocations:catalogTree(m.name)};
 return{id:'full-model-'+i,kind:m.kind,riskProfile:m.riskProfile,versions:[{number:1,date:'10 Oct 2026',reason:'Model allocation from the revised wireframe',data:copy(d)}],draft:null,clients:[]};
})}
const SEEDED_MODEL_NAMES=new Set(Object.keys(originalData.settings.models));
const modelName=m=>m.versions?.at(-1)?.data?.name||m.draft?.name||'';
function removeSeedDuplicates(items){return items.filter(m=>!(m.earlierPrototype&&SEEDED_MODEL_NAMES.has(modelName(m))))}
let models;try{models=JSON.parse(localStorage.getItem(KEY));if(!models){const previous=JSON.parse(localStorage.getItem('portfolio-model-design-v3')||localStorage.getItem('portfolio-model-design-v2')||'[]');models=seed().concat(previous.map(m=>({...m,earlierPrototype:true})));}const cleaned=removeSeedDuplicates(models);if(cleaned.length!==models.length){models=cleaned;}localStorage.setItem(KEY,JSON.stringify(models));$('storage').textContent='Saved in this browser'}catch{models=seed();$('storage').textContent='Session only: browser storage unavailable'}
let selected=null,editing=false,expanded=new Set(),dirty=false,toastTimer;
let list,render,rows,changes,review,clients;
const current=()=>models.find(m=>m.id===selected),latest=m=>m.versions.at(-1),data=()=>editing?current().draft:latest(current()).data;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(models));$('storage').textContent='Saved in this browser'}catch{$('storage').textContent='Session only: browser storage unavailable'}}
function notify(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4000)}
function findNode(id,arr=data().allocations){for(const n of arr){if(n.id===id)return n;const c=findNode(id,n.children);if(c)return c}}
function validation(d){const e=[],sum=d.allocations.reduce((s,n)=>s+n.target,0);if(!d.name.trim())e.push('Give this model a name.');if(Math.abs(sum-100)>.01)e.push('Targets total '+fmt(sum)+'%. '+(sum>100?'Reduce':'Add')+' '+fmt(Math.abs(100-sum))+' percentage points.');function walk(ns){ns.forEach(n=>{if(!Number.isFinite(n.target)||n.target<0||n.target>100)e.push(n.name+': target must be between 0% and 100%.');if(n.children.length){const t=n.children.reduce((s,x)=>s+x.target,0);if(Math.abs(t-n.target)>.011)e.push(n.name+': breakdown totals '+fmt(t)+'%, but parent is '+fmt(n.target)+'%.');walk(n.children)}})}walk(d.allocations);return e}
function openModel(id){if(editing&&selected&&selected!==id){persist();dirty=false}selected=id;editing=!latest(current());expanded=new Set(data().allocations.map(n=>n.id));render()}
function startEdit(){const m=current();m.draft=m.draft||copy(latest(m).data);editing=true;dirty=false;render()}
function expandAll(){function walk(ns){ns.forEach(n=>{if(n.children.length){expanded.add(n.id);walk(n.children)}})}walk(data().allocations);render()}
function collapseAll(){expanded.clear();render()}
function toggle(id){expanded.has(id)?expanded.delete(id):expanded.add(id);render()}
function saveDraft(){persist();dirty=false;render();notify('Draft saved. Client targets are unchanged.')}
function saveAndList(){if(editing)persist();dirty=false;list()}
function show(content){$('modal').innerHTML=content;$('modal').showModal()}
const closeModal=()=> $('modal').close();
function rescale(ns,total){let old=ns.reduce((s,n)=>s+n.target,0),used=0;ns.forEach((n,i)=>{n.target=i===ns.length-1?Math.round((total-used)*100)/100:Math.round((old?n.target/old:1/ns.length)*total*100)/100;used+=n.target;if(n.children.length)rescale(n.children,n.target)})}
// Editing a node rescales what is under it and moves its siblings, so the level
// above never changes and the model stays at 100%. That removes the old choice
// between distributing proportionally and adjusting by hand: there is now one
// correct answer, and it is applied.
function changeTarget(id,value){const v=Number(value);
 if(!Number.isFinite(v)||v<0||v>100){notify('Enter a target between 0 and 100%.');render();return}
 if(!TAX.editModelTree(data().allocations,id,v))return;
 expanded.add(id);dirty=true;render();}
function changeBand(id,value){const v=Number(value),n=findNode(id);
 if(!n||!Number.isFinite(v)||v<0.5||v>100){notify('Enter a band of at least 0.5 pp.');render();return}
 n.band=v;dirty=true;render();}
function applyTarget(id,v,scale){const n=findNode(id);n.target=v;if(scale)rescale(n.children,v);expanded.add(id);dirty=true;closeModal();render()}
function removeNode(id){show(`<h2>Remove ${esc(findNode(id).name)}?</h2><p>You will need to bring the remaining targets back to 100% before publishing.</p><div class="actions"><button onclick="closeModal()">Cancel</button><button class="primary" onclick="data().allocations=data().allocations.filter(n=>n.id!=='${id}');dirty=true;closeModal();render()">Remove from draft</button></div>`)}
function addAllocation(){const options=CATALOG.filter(x=>!data().allocations.some(n=>n.name===x.n));show(`<h2>Add asset class</h2>${options.length?`<label class="field">Category<select id="category">${options.map(x=>'<option>'+esc(x.n)+'</option>').join('')}</select></label><p class="muted">Includes its complete sample hierarchy at 0%. Set targets before publishing.</p><div class="actions"><button onclick="closeModal()">Cancel</button><button class="primary" onclick="data().allocations.push(catalogTree('Moderate',true).find(n=>n.name===$('category').value));dirty=true;closeModal();render()">Add allocation</button></div>`:'<p>All four asset classes are already present.</p><button onclick="closeModal()">Close</button>'}`)}
function newModel(){show(`<h2>Create a model</h2><p class="muted">Start with the full asset hierarchy at 0%. Assign targets, then save a draft or publish when allocations total 100%.</p><label class="field">Model name<input id="newName" placeholder="e.g. Balanced growth" maxlength="80"></label><label class="field">Intended use<textarea id="newDesc" placeholder="Who is this strategy intended for?"></textarea></label><p id="newError" class="errors"></p><div class="actions"><button onclick="closeModal()">Cancel</button><button class="primary" onclick="createModel()">Create draft</button></div>`)}
function createModel(){const name=$('newName').value.trim();if(!name){$('newError').textContent='Enter a model name.';return}const m={id:crypto.randomUUID(),versions:[],clients:[],draft:{name,description:$('newDesc').value.trim(),allocations:catalogTree('Moderate',true)}};models.push(m);persist();closeModal();openModel(m.id)}
function flatten(d){const out={};function walk(ns,path=''){ns.forEach(n=>{let k=path+n.name;out[k]={target:n.target,band:n.band};walk(n.children,k+' / ')})}walk(d?.allocations||[]);return out}
function publish(){const reason=$('reason').value.trim();if(!reason){$('publishError').textContent='Add a reason before publishing.';return}const m=current();if(validation(m.draft).length)return;m.versions.push({number:(latest(m)?.number||0)+1,date:new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}),reason,data:copy(m.draft)});m.draft=null;editing=false;dirty=false;persist();closeModal();render();notify('Model published. Existing client targets are unchanged.')}
function history(){const m=current();show(`<h2>Version history</h2><p class="muted">${esc(data().name)} · Published snapshots are preserved.</p>${m.versions.length?[...m.versions].reverse().map(v=>`<div class="history"><strong>Version ${v.number}</strong> <small>· ${v.date}</small><p>${esc(v.reason)}</p><div class="chips">${v.data.allocations.map(n=>`<span class="badge">${esc(n.name)} ${fmt(n.target)}%</span>`).join('')}</div><button class="quiet" onclick="snapshot(${v.number})">View full snapshot →</button></div>`).join(''):'<p>No published versions yet.</p>'}<div class="actions"><button onclick="closeModal()">Close</button></div>`)}
function snapshot(number){const v=current().versions.find(v=>v.number===number);$('modal').innerHTML=`<h2>${esc(v.data.name)} · v${v.number}</h2><p>${esc(v.data.description)}</p><div class="tablewrap"><table><thead><tr><th>Allocation</th><th>Target</th><th>Band</th></tr></thead><tbody>${Object.entries(flatten(v.data)).map(([k,n])=>`<tr><td>${esc(k)}</td><td>${fmt(n.target)}%</td><td>±${fmt(n.band)} pp</td></tr>`).join('')}</tbody></table></div><div class="actions"><button onclick="closeModal();history()">Back to history</button><button onclick="closeModal()">Close</button></div>`}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
