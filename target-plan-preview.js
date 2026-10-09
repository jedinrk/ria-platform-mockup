'use strict';

// Local design preview. This file overrides presentation only; the approved
// target, draft, validation and persistence rules remain in the core scripts.

const targetPlanApproved=()=>approved(client());
const targetOverrideCount=p=>Object.values(p.overrides).filter(x=>x.target!==undefined).length;
const lensKeys=['sec','mc','geo','th','cr'];
const lensOverrides=p=>p.lensOverrides||(p.lensOverrides={});
const lensBucketOverrides=(p,lens)=>lensOverrides(p)[lens]||(lensOverrides(p)[lens]={});
const modelLensBand=lens=>originalData.settings.originalLensBands[lens]?.at(-1)||5;
function modelLensRows(p,lens){return exposureRows(leafValues(p.base.data),leafValues(p.base.data),lens)}
function effectiveLensRows(p,lens){
  const overrides=p.lensOverrides?.[lens]||{};
  return modelLensRows(p,lens).map(row=>{
    const override=overrides[row.name]||{},modelTarget=row.actual,modelBand=modelLensBand(lens);
    return {...row,modelTarget,modelBand,portfolioTarget:override.target,portfolioBand:override.band,effectiveTarget:override.target??modelTarget,effectiveBand:override.band??modelBand,custom:override.target!==undefined||override.band!==undefined};
  });
}
function lensOverrideCount(p){return Object.values(p.lensOverrides||{}).reduce((sum,buckets)=>sum+Object.values(buckets).filter(x=>x.target!==undefined||x.band!==undefined).length,0)}
const targetScopeChanges=(before,after)=>after.assets.filter(asset=>{
  const previous=before.assets.find(x=>x.id===asset.id);
  return !previous||previous.included!==asset.included||previous.reason!==asset.reason;
}).length;
const topLevelTargets=p=>effective(p).allocations.map(x=>({name:x.name,target:x.target}));

portfolioTabs=function(){return `<nav class="portfolio-tabs portfolio-tabs-five" aria-label="Portfolio work areas">${[
  ['allocation','1 Drill-down allocation'],['planning','2 Gap summary & trades'],['cash','3 Cash events'],['exposure','4 Exposure drift'],['target','5 Client target limits'],['history','History']
].map(([key,label])=>`<button data-portfolio-area="${key}" aria-current="${portfolioArea===key?'page':'false'}">${label}${key==='target'&&client().draft?' <span class="draft-dot" aria-label="Draft exists"></span>':''}</button>`).join('')}</nav>`};

function targetPlanStatus(p){
  const a=targetPlanApproved(),draft=clientEditing;
  return `<section class="target-status ${draft?'is-draft':'is-approved'}">
    <div>
      <span class="target-status-label">${draft?'Draft changes':'Approved client target'}</span>
      <h2>${draft?'Review changes before they become the effective target':'The effective target currently used for portfolio review'}</h2>
      <p>${draft?'Current-versus-target continues to use the approved effective target until this draft is approved.':'Approved '+esc(a.effectiveDate)+' by '+esc(a.approver)+'. Current holdings remain separate.'}</p>
    </div>
    ${draft?'<button data-action="approved">View approved target</button>':`<button class="primary" data-action="edit">${client().draft?'Resume target draft':'Create revised target'}</button>`}
  </section>`;
}

function targetContext(p){
  const a=targetPlanApproved();
  return `<section class="target-context" aria-label="Account context">
    <div><small>Assessed risk profile</small><strong>${esc(client().risk)}</strong><span>Source assessment date not supplied</span></div>
    <div><small>Model</small><strong>${esc(baseRef(p))}</strong><span>${clientEditing&&baseRef(p)!==baseRef(a.plan)?'Proposed change':'Current selection'}</span></div>
    <div><small>Included value</small><strong>${money(scopeValue(p))}</strong><span>${p.assets.filter(x=>x.included).length} of ${p.assets.length} recorded assets</span></div>
    <div><small>Portfolio overrides</small><strong>${targetOverrideCount(p)+lensOverrideCount(p)}</strong><span>Asset-class and lens limits</span></div>
  </section>`;
}

function targetDistribution(p){
  const approvedPlan=targetPlanApproved().plan,proposed=topLevelTargets(p),current=topLevelTargets(approvedPlan);
  return `<section class="card target-distribution">
    <div class="target-section-heading"><div><span class="section-step">Effective target summary</span><h2>${clientEditing?'Approved and proposed effective allocation':'Approved effective allocation'}</h2><p>${clientEditing?'Compare the draft with the effective target currently used in Drill-down allocation.':'The effective target starts from the model and includes any portfolio overrides.'}</p></div></div>
    <div class="target-bars">
      ${clientEditing?`<div><strong>Approved effective target</strong>${stack(current.map(x=>x.target))}<small>${current.map(x=>esc(x.name)+' '+fmt(x.target)+'%').join(' · ')}</small></div>`:''}
      <div><strong>${clientEditing?'Proposed effective target':'Effective target'}</strong>${stack(proposed.map(x=>x.target))}<small>${proposed.map(x=>esc(x.name)+' '+fmt(x.target)+'%').join(' · ')}</small></div>
    </div>
    <div class="target-class-grid">${proposed.map((x,i)=>{const before=current[i]?.target??null,delta=before===null?null:x.target-before;return `<div><i style="background:${palette[i]}"></i><span>${esc(x.name)}</span><strong>${fmt(x.target)}%</strong>${clientEditing?`<small>${delta===0?'No change':signed(delta)+' pp'}</small>`:''}</div>`}).join('')}</div>
  </section>`;
}

function targetModelSection(p){
  if(!clientEditing)return `<section class="card target-model-card">
    <div class="target-section-heading"><div><span class="section-step">Model</span><h2>${esc(baseRef(p))}</h2><p>The approved effective target follows this model except where this portfolio has an explicit override.</p></div><span class="source-pill">${targetOverrideCount(p)?targetOverrideCount(p)+' overridden':'Follows model'}</span></div>
  </section>`;
  return `<section class="card target-model-card">
    <div class="target-section-heading"><div><span class="section-step">Model</span><h2>Choose the model for this portfolio</h2><p>Reviewing another model does not change the assessed risk profile or approved effective target.</p></div></div>
    <div class="model-choice-row"><label>Model<select id="baseChoice">${modelOptions(p)}</select></label><button data-action="base">Review model change</button></div>
    ${newer(client())?'<p class="target-inline-notice"><strong>A newer model update is available.</strong> The approved effective target remains unchanged unless this draft is reviewed and approved.</p>':''}
  </section>`;
}

function targetAllocationSection(p){
  const issues=targetIssues(p),overrideCount=targetOverrideCount(p);
  return `<section class="card target-allocation-card">
    <div class="target-section-heading"><div><span class="section-step">Asset class limits</span><h2>Asset-class limits and portfolio overrides</h2><p>${clientEditing?'Leave “This portfolio %” blank to follow the model. Entering 0% is an explicit zero.':'Model, portfolio override and effective values are shown separately.'}</p></div><div class="target-expand-actions"><button data-action="expand">Expand all</button><button data-action="collapse">Collapse all</button></div></div>
    <div class="tablewrap"><table class="client-table target-plan-table"><thead><tr><th>Allocation</th>${clientEditing?'<th>Approved effective %</th>':''}<th>Model target %</th>${clientEditing?'<th>This portfolio %</th>':''}<th>${clientEditing?'Proposed effective %':'Effective %'}</th><th>Source</th></tr></thead><tbody>${targetRows(p)}</tbody></table></div>
    <div class="target-table-foot"><span>${overrideCount} portfolio ${overrideCount===1?'override':'overrides'}</span><span>All percentages are of the whole portfolio</span></div>
    ${clientEditing?`<div class="target-readiness ${issues.length?'has-issues':'is-ready'}"><div><strong>${issues.length?issues.length+' item'+(issues.length>1?'s':'')+' to resolve':'Ready for review'}</strong><span>${issues.length?'The draft is saved, but approval remains unavailable.':'Targets reconcile and the proposed scope is valid.'}</span></div>${issues.length?'<ul>'+issues.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<span aria-hidden="true" class="ready-mark">✓</span>'}</div>`:''}
  </section>`;
}

function targetScopeSection(p){
  const before=targetPlanApproved().plan,changes=clientEditing?targetScopeChanges(before,p):0,excluded=p.assets.filter(x=>!x.included).length;
  return `<section class="card target-scope-card">
    <div class="target-section-heading"><div><span class="section-step">Assets included in allocation</span><h2>Recorded assets used in the allocation percentages</h2><p>Included assets set the allocation denominator. Inclusion does not mean an asset is liquid or available to sell.</p></div><button data-workspace="scope">${clientEditing?'Review included assets':'View included assets'}</button></div>
    <div class="target-scope-metrics"><div><small>Recorded assets</small><strong>${money(recordedValue(p))}</strong></div><span aria-hidden="true">→</span><div><small>Included value${clientEditing?' · proposed':''}</small><strong>${money(scopeValue(p))}</strong></div><div><small>Included</small><strong>${p.assets.filter(x=>x.included).length} / ${p.assets.length}</strong></div><div><small>Excluded</small><strong>${excluded}</strong></div></div>
    ${clientEditing&&changes?`<p class="target-inline-notice"><strong>${changes} scope ${changes===1?'change':'changes'} in this draft.</strong> Review the value and exclusion reasons before approval.</p>`:''}
  </section>`;
}

function targetLensLimits(p){
  const available=lensKeys,selectedLens=available.includes(activeLens)?activeLens:'sec',rows=effectiveLensRows(p,selectedLens),overrideCount=rows.filter(row=>row.custom).length;
  return `<section class="card target-lens-card">
    <div class="target-section-heading"><div><span class="section-step">Lens limits</span><h2>${esc(lenses.find(x=>x[0]===selectedLens)?.[1]||'Exposure')} limits</h2><p>${clientEditing?'Leave portfolio fields blank to inherit the model. Entering 0 is an explicit override.':'Model, portfolio override and effective limits are shown separately.'}</p></div>${clientEditing&&overrideCount?'<button data-action="reset-lens">Reset this lens</button>':''}</div>
    <div class="analysis-toolbar"><label>Lens <select id="portfolioLens">${available.map(key=>`<option value="${key}" ${selectedLens===key?'selected':''}>${esc(lenses.find(x=>x[0]===key)?.[1]||key)}</option>`).join('')}</select></label><span class="lens-override-count">${overrideCount} portfolio ${overrideCount===1?'override':'overrides'} in this lens</span></div>
    <div class="tablewrap"><table class="target-limits-table"><thead><tr><th>Bucket</th><th>Model target %</th><th>This portfolio %</th><th>Model band ±</th><th>This portfolio band ±</th><th>Effective target %</th><th>Effective band ±</th><th>Source</th></tr></thead><tbody>${rows.map((row,index)=>`<tr class="${row.custom?'is-custom':''}"><td>${esc(row.name)}</td><td>${row.modelTarget===null?'Not defined':fmt(row.modelTarget)}</td><td>${clientEditing?`<div class="target-input-wrap"><input class="target" type="number" min="0" max="100" step="0.1" data-lens-target="${index}" aria-label="${esc(row.name)} portfolio target" placeholder="Inherit" value="${row.portfolioTarget??''}"><span>%</span></div>`:(row.portfolioTarget===undefined?'—':fmt(row.portfolioTarget))}</td><td>${fmt(row.modelBand)}</td><td>${clientEditing?`<div class="target-input-wrap"><input class="target" type="number" min="0.5" max="100" step="0.5" data-lens-band="${index}" aria-label="${esc(row.name)} portfolio band" placeholder="Inherit" value="${row.portfolioBand??''}"><span>pp</span></div>`:(row.portfolioBand===undefined?'—':fmt(row.portfolioBand))}</td><td><strong>${row.effectiveTarget===null?'Not defined':fmt(row.effectiveTarget)}</strong></td><td><strong>${fmt(row.effectiveBand)}</strong></td><td><span class="target-source ${row.custom?'custom':'inherited'}">${row.custom?'This portfolio':'Model'}</span></td></tr>`).join('')||'<tr><td colspan="8">No limits are available for this lens.</td></tr>'}</tbody></table></div>
    <p class="chart-key">A portfolio limit replaces the model-implied target and/or the default band for that bucket. Once approved it is what Exposure drift and the portfolio list compare against. Draft limits are not applied until review and approval. Household views use the firm defaults; limits apply to the account that approved them.</p>
  </section>`;
}

const targetPlanBaseIssues=targetIssues;
targetIssues=function(plan){
  const issues=targetPlanBaseIssues(plan);
  for(const [lens,buckets] of Object.entries(plan.lensOverrides||{}))for(const [bucket,override] of Object.entries(buckets)){
    if(override.target!==undefined&&(!Number.isFinite(override.target)||override.target<0||override.target>100))issues.push(`${bucket} portfolio target in ${lenses.find(x=>x[0]===lens)?.[1]||lens} must be between 0 and 100.`);
    if(override.band!==undefined&&(!Number.isFinite(override.band)||override.band<0.5||override.band>100))issues.push(`${bucket} portfolio band in ${lenses.find(x=>x[0]===lens)?.[1]||lens} must be at least 0.5 pp.`);
  }
  return issues;
};

function lensLimitChanges(before,after){
  const changes=[];
  for(const lens of lensKeys){
    const oldRows=new Map(effectiveLensRows(before,lens).map(row=>[row.name,row]));
    for(const row of effectiveLensRows(after,lens)){
      const old=oldRows.get(row.name);
      if(!old||old.effectiveTarget!==row.effectiveTarget||old.effectiveBand!==row.effectiveBand)changes.push({lens:lenses.find(x=>x[0]===lens)?.[1]||lens,bucket:row.name,oldTarget:old?.effectiveTarget,newTarget:row.effectiveTarget,oldBand:old?.effectiveBand,newBand:row.effectiveBand});
    }
  }
  return changes;
}

targetRows=function(p){
  const base=entries(p.base.data.allocations),effectiveNodes=new Map(entries(effective(p).allocations).map(x=>[x.key,x.node])),approvedNodes=new Map(entries(effective(targetPlanApproved().plan).allocations).map(x=>[x.key,x.node]));
  return base.map((x,i)=>{
    let parent=base.find(y=>y.node.children.includes(x.node)),depth=0;
    while(parent){depth++;if(!clientExpanded.has(parent.key))return '';parent=base.find(y=>y.node.children.includes(parent.node))}
    const n=effectiveNodes.get(x.key),o=p.overrides[x.key]||{},old=approvedNodes.get(x.key),custom=o.target!==undefined;
    return `<tr class="${depth?'child':'rowtop'} ${custom?'is-custom':''}">
      <th scope="row"><div class="target-allocation-name" style="padding-left:${depth*18}px">${n.children.length?`<button class="chev" data-toggle="${i}" aria-label="${clientExpanded.has(x.key)?'Collapse':'Expand'} ${esc(x.key)}" aria-expanded="${clientExpanded.has(x.key)}">${clientExpanded.has(x.key)?'⌄':'›'}</button>`:'<span class="target-leaf-space"></span>'}<span>${esc(n.name)}</span></div></th>
      ${clientEditing?`<td>${old?fmt(old.target)+'%':'Not specified'}</td>`:''}
      <td>${fmt(x.node.target)}%</td>
      ${clientEditing?`<td><div class="target-input-wrap"><input id="target-override-${i}" aria-label="${esc(x.key)} client target override" class="target" type="number" min="0" max="100" step="0.1" data-adjust="${i}" placeholder="Inherit" value="${o.target??''}"><span>%</span></div></td>`:''}
      <td><strong>${fmt(n.target)}%</strong></td>
      <td><span class="target-source ${custom?'custom':'inherited'}">${custom?'This portfolio':'Model'}</span></td>
    </tr>`;
  }).join('');
};

targetPlanContent=function(p){
  return `<div class="target-plan-shell">
    ${targetPlanStatus(p)}
    ${targetContext(p)}
    ${targetDistribution(p)}
    ${targetModelSection(p)}
    ${targetAllocationSection(p)}
    ${targetLensLimits(p)}
    <p class="target-method-note">Approval creates a new effective-target snapshot for this portfolio. It does not change the model, current holdings, another portfolio, or generate trades.</p>
  </div>`;
};

reviewClient=function(){
  const p=planNow(),old=targetPlanApproved().plan,issues=targetIssues(p);
  if(issues.length)return;
  const oldTop=topLevelTargets(old),nextTop=topLevelTargets(p),changed=nextTop.filter((x,i)=>x.target!==oldTop[i]?.target),lensChanges=lensLimitChanges(old,p);
  show(`<div class="target-review-dialog"><span class="section-step">Final review</span><h2>Approve revised client target</h2><p class="muted">${esc(client().name)} · the effective target becomes the reference for future allocation reviews.</p>
    <div class="review-impact-grid"><div><small>Model</small><strong>${baseRef(old)===baseRef(p)?esc(baseRef(p))+' (unchanged)':esc(baseRef(old))+' → '+esc(baseRef(p))}</strong></div><div><small>Included value</small><strong>${money(scopeValue(old))} → ${money(scopeValue(p))}</strong></div><div><small>Asset-class changes</small><strong>${changed.length}</strong></div><div><small>Lens-limit changes</small><strong>${lensChanges.length}</strong></div></div>
    <section class="review-summary-section"><h3>Asset class limits · effective %</h3><div class="review-target-rows">${nextTop.map((x,i)=>{const before=oldTop[i]?.target??0;return `<div><span><i style="background:${palette[i]}"></i>${esc(x.name)}</span><span>${fmt(before)}%</span><span aria-hidden="true">→</span><strong>${fmt(x.target)}%</strong></div>`}).join('')}</div></section>
    <details class="review-detail"><summary>Detailed limit changes</summary><div class="tablewrap"><table><thead><tr><th>Allocation</th><th>Approved effective %</th><th>Proposed effective %</th></tr></thead><tbody>${changes(effective(old),effective(p))}</tbody></table></div></details>
    <details class="review-detail"><summary>Lens limit changes · ${lensChanges.length}</summary>${lensChanges.length?`<div class="tablewrap"><table><thead><tr><th>Lens / bucket</th><th>Effective target %</th><th>Effective band ±</th></tr></thead><tbody>${lensChanges.map(change=>`<tr><td>${esc(change.lens)} · ${esc(change.bucket)}</td><td>${change.oldTarget===null?'Not defined':fmt(change.oldTarget)} → ${change.newTarget===null?'Not defined':fmt(change.newTarget)}</td><td>${fmt(change.oldBand)} → ${fmt(change.newBand)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No lens limit changes in this draft.</p>'}</details>
    <details class="review-detail"><summary>Assets included in allocation</summary>${scopeChanges(old,p)}</details>
    <label class="field">Reason for this client target change<textarea id="targetReason" placeholder="Explain why this client target is appropriate for the portfolio"></textarea></label>
    <label class="field">Approver<input id="targetApprover" value="${esc(originalData.audit.user)}"></label>
    <p class="note">Illustrative approval, effective today (${esc(today())}). Current holdings remain unchanged.</p><p id="targetError" class="errors"></p>
    <div class="actions"><button onclick="closeModal()">Back to draft</button><button class="primary" data-action="approve">Approve client target</button></div></div>`);
};

document.addEventListener('change',event=>{
  const input=event.target;
  if(!clientEditing||(input.dataset.lensTarget===undefined&&input.dataset.lensBand===undefined))return;
  const lens=lensKeys.includes(activeLens)?activeLens:'sec',rows=modelLensRows(planNow(),lens),index=Number(input.dataset.lensTarget??input.dataset.lensBand),row=rows[index];
  if(!row)return;
  const buckets=lensBucketOverrides(planNow(),lens),override=buckets[row.name]||(buckets[row.name]={}),field=input.dataset.lensTarget!==undefined?'target':'band';
  if(input.value==='')delete override[field];else override[field]=Number(input.value);
  if(!Object.keys(override).length)delete buckets[row.name];
  if(!Object.keys(buckets).length)delete lensOverrides(planNow())[lens];
  saveClients();renderClient();
});

document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button||button.dataset.action!=='reset-lens'||!clientEditing)return;
  const lens=lensKeys.includes(activeLens)?activeLens:'sec';
  delete lensOverrides(planNow())[lens];
  saveClients();renderClient();
});

// The inner Allocation / Exposure control and the numbered tabs address the same
// content, so keep them in step instead of letting the tab silently win.
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!activeClient)return;
  if(b.dataset.lens==='ac'&&portfolioArea==='exposure')portfolioArea='allocation';
  if(b.dataset.workspace==='exposures'&&portfolioArea==='allocation')portfolioArea='exposure';
},true);

const targetPlanBaseRenderClient=renderClient;
renderClient=function(){
  const requestedArea=portfolioArea;
  if(requestedArea==='cash')portfolioArea='planning';
  if(requestedArea==='exposure'){portfolioArea='allocation';if(activeLens==='ac')activeLens='sec'}
  if(requestedArea==='allocation')activeLens='ac';
  targetPlanBaseRenderClient();
  portfolioArea=requestedArea;
  document.querySelectorAll('[data-portfolio-area]').forEach(button=>button.setAttribute('aria-current',button.dataset.portfolioArea===requestedArea?'page':'false'));
  if(requestedArea==='cash'){
    const panel=document.querySelector('.planning-placeholder');
    if(panel)panel.innerHTML='<div class="eyebrow">Planned refinement</div><h2>Cash events</h2><p>Raise or invest cash, review tax and trade options, and retain a history of suggested events.</p><p class="note">This initial-mockup workflow remains in scope but is not implemented in this preview.</p>';
  }
};
