// Read the original wireframe without executing its DOM code. Emit JSON to stdout.
// Usage: node scripts/extract-original.cjs /path/to/wireframe.html /path/to/@babel/parser
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const parser = require(process.argv[3] || '@babel/parser');
const html = fs.readFileSync(process.argv[2], 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ast = parser.parse(source);
const declarations = new Map(ast.program.body.filter(x => x.type === 'VariableDeclaration').flatMap(x => x.declarations).filter(x => x.id.type === 'Identifier').map(x => [x.id.name, x.init]));
const raw = {};
// Only the inspected static data declarations are evaluated, in dependency order.
for (const name of ['D','M','LQ','P','LT','HH','AC','RS','FT','MODE','LM','LP','CN','DCAP','LZ','LENSES','PATH','DEFBAND','DB','OV','BAND','PAL','EQS','ORD','NIFTY','A','USER','band']) {
 const init = declarations.get(name);
 if (!init) throw new Error('Missing declaration: '+name);
 raw[name] = vm.runInNewContext('('+source.slice(init.start, init.end)+')', raw, {timeout:1000});
}
const leaves = raw.D.flatMap(c => c.c.flatMap(g => g.c.map(s => ({...s, assetClass:c.n, subcategory:g.n}))));
const securities = leaves.map((s,i) => {
 const [sector,subsector,marketCap,geography,themes,custom,extra={}] = raw.A[i];
 return {id:'security-'+(i+1),name:s.n,assetClass:s.assetClass,subcategory:s.subcategory,baseValueLakh:s.v,moderateTargetPercent:s.tg,physical:!!s.p,costBasisLakh:raw.M[s.n].c,illustrativeTaxRatePercent:raw.M[s.n].r,liquidity:raw.LQ[raw.M[s.n].l],liquidityCode:raw.M[s.n].l,originalNote:raw.M[s.n].t,tags:{sector,subsector,marketCap,geography,themes:themes?themes.split(';'):[],custom,creditQuality:extra.cr||null,duration:extra.du||null,isDebt:!!extra.deb},lookThrough:extra.lt?{sector:extra.lt.sec.map(([sector,subsector,weight])=>({sector,subsector,weight})),marketCap:extra.lt.mc.map(([bucket,weight])=>({bucket,weight})),geography:extra.lt.geo.map(([bucket,weight])=>({bucket,weight}))}:null};
});
const random=(a,b)=>{const x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x)};
const accounts=raw.AC.map(a=>{
 const riskProfile=raw.HH.find(h=>h.id===a.h).r;
 const weights=raw.LT[riskProfile].map((t,i)=>Math.max(.05,t)*Math.max(.05,1+(a.s||0)*(random(+a.id.slice(1),i)*2-1)));
 const scale=a.a/weights.reduce((s,v)=>s+v,0);
 const values=a.base?leaves.map(s=>s.v):weights.map(w=>w*scale);
 const type=/Joint/.test(a.n)?'Joint account':/HUF/.test(a.n)?'HUF':/Trust/.test(a.n)?'Trust':/Pvt Ltd/.test(a.n)?'Company':'Individual';
 return {id:a.id,householdId:a.h,name:a.n,type,riskProfile,aumLakh:a.a,originalThresholdPP:a.th??null,generation:{usesBase:!!a.base,spread:a.s??null},holdings:securities.map((s,i)=>({securityId:s.id,valueLakh:values[i],costBasisLakh:s.costBasisLakh*values[i]/s.baseValueLakh}))};
});
const defaults={};
for(const match of html.matchAll(/<input\b([^>]*)>/g)){const attrs=Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]));if(attrs.id)defaults[attrs.id]={...attrs,checked:/\bchecked\b/.test(match[1])};}
const selects={};
for(const match of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)){const id=match[1].match(/id="([^"]+)"/);if(id)selects[id[1]]=[...match[2].matchAll(/<option([^>]*)>(.*?)<\/option>/g)].map(x=>({value:x[1].match(/value="([^"]*)"/)?.[1]??x[2],label:x[2]}));}
const result={schemaVersion:1,metadata:{sourceFile:process.argv[2].split('/').pop(),sourceSha256:crypto.createHash('sha256').update(html).digest('hex'),asOf:'2026-10-03',currency:'INR',valueUnit:'lakh',totalAumLakh:accounts.reduce((s,a)=>s+a.aumLakh,0),notes:['All values, rates and fund exposures are illustrative original wireframe data, not verified investment facts or current tax guidance.','Non-base holdings are materialized with the exact deterministic formula from the source, without rounding.','No source account ownership shares, risk-assessment dates, financial goals or source-statement evidence were supplied.','Original sample includes all 19 holdings in every account. No residence/jewellery exclusion or target redistribution has been added.','Independent exposure dimensions are preserved; joint geography/market-cap/sector exposures are not known.']},assetHierarchy:raw.D,modelTargets:raw.LT,households:raw.HH.map(h=>({id:h.id,name:h.n,riskProfile:h.r,originalThresholdPP:h.th??null})),accounts,securities,settings:{fundMode:raw.MODE,customLensName:raw.CN,firmThresholdPP:raw.FT.v,originalAssetBandsPP:raw.band,originalLensBands:raw.DB,originalHierarchyBands:raw.DEFBAND,sectorCapPercent:raw.DCAP,classificationOrder:raw.ORD,palette:raw.PAL},cashPlanning:{reasons:raw.RS,inputDefaults:defaults,selectOptions:selects,events:[]},audit:{user:raw.USER,entries:[]},originalDeclarations:raw};
process.stdout.write(JSON.stringify(result,null,2)+'\n');
