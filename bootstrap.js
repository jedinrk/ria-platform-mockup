/* Original illustrative data is separate from persisted edits and UI state. */
var originalData;
(async function boot(){
  try {
    const release='20261007-model-limits-1';
    const response = await fetch('data/original-mockup.json?v='+release);
    if (!response.ok) throw new Error('Original data could not load');
    originalData = await response.json();
    for (const path of ['models.js','portfolio-views.js','portfolios.js','comparison-data.js','portfolio-workspace.js','comparison.js','portfolio-review.js','target-plan-preview.js']) {
      await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=path+'?v='+release;script.onload=resolve;script.onerror=reject;document.body.append(script)});
    }
    syncClients(); clientNav();
  } catch(error) {
    document.getElementById('app').innerHTML='<section class="card"><h1>Portfolio data could not load</h1><p>Reload to try again. Existing saved work has not been reset.</p><button onclick="location.reload()">Reload</button></section>';
    console.error(error);
  }
})();
