// Capture actual running Abyssal builds in Chromium, without gameplay test shortcuts.
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn,spawnSync,execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const OUT=path.resolve(__dirname,'../test-artifacts/browser-smoke');
const BASE='41c601f8f4666801e59009a81fbe1195f94dbcbd';
const ROOT=path.resolve(__dirname,'..');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav','.b64':'text/plain'};
async function startServer(root){
 const pub=path.join(root,'public');
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/api/browser-version'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({ok:true,version:JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version}));}
  const p=path.resolve(pub,'.'+(pathname==='/'?'/index.html':pathname));
  if(!p.startsWith(pub+path.sep))return res.writeHead(403).end();
  fs.readFile(p,(err,buf)=>{if(err)return res.writeHead(404).end();res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(buf);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return server;
}
async function capture(root,label){
 const server=await startServer(root),url='http://127.0.0.1:'+server.address().port+'/';
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'abyssal-ui-cdp-'));
 const chromeBin=['google-chrome','google-chrome-stable','chromium','chromium-browser'].map(n=>spawnSync('which',[n],{encoding:'utf8'})).find(r=>r.status===0)?.stdout.trim();
 assert.ok(chromeBin,'Chrome missing');
 const chrome=spawn(chromeBin,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--remote-debugging-port=0','--remote-allow-origins=*','--user-data-dir='+dir,'about:blank'],{stdio:['ignore','ignore','pipe']});
 let chromeErrors='';chrome.stderr.on('data',chunk=>{chromeErrors=(chromeErrors+String(chunk)).slice(-4000);});
 let ws;
 try{
  let port;for(let i=0;i<300;i++){const f=path.join(dir,'DevToolsActivePort');if(fs.existsSync(f)){port=Number(fs.readFileSync(f,'utf8').split('\n')[0]);if(port)break;}await sleep(100);}
  assert.ok(port,'CDP port missing; Chrome exit='+chrome.exitCode+'; '+chromeErrors);
  const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true})});
  let seq=0;const pending=new Map();
  ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.t);m.error?p.j(Error(JSON.stringify(m.error))):p.r(m.result);}});
  const cmd=(method,params={})=>new Promise((r,j)=>{const id=++seq;const t=setTimeout(()=>{pending.delete(id);j(Error('CDP timeout '+method));},15000);pending.set(id,{r,j,t});ws.send(JSON.stringify({id,method,params}));});
  const ev=async expression=>{const q=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(q.exceptionDetails)throw Error(q.exceptionDetails.exception?.description||q.exceptionDetails.text);return q.result.value;};
  const wait=async(expression)=>{for(let i=0;i<70;i++){if(await ev(expression).catch(()=>false))return;await sleep(200);}throw Error('UI not ready '+expression);};
  const snap=async name=>{await sleep(280);const r=await cmd('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});const p=path.join(OUT,'deep-ui-'+label+'-'+name+'.png');fs.writeFileSync(p,Buffer.from(r.data,'base64'));assert.ok(fs.statSync(p).size>10000,'Blank capture '+name);console.log('[deep-ui] capture '+path.basename(p)+' '+fs.statSync(p).size);};
  await cmd('Page.enable');await cmd('Runtime.enable');
  await cmd('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.setItem('abyssalAgeProfile',JSON.stringify({termsVersion:'2026-11-03-v2',band:'adult',birthYear:1990}));}catch(e){}"});
  const reports=[];
  for(const [device,width,height,mobile] of [['desktop',1600,900,false],['mobile',390,844,true]]){
   await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
   await cmd('Page.navigate',{url});
   await wait("Boolean(window.AbyssalCockpitNavigation&&document.getElementById('submarineWorkshop'))");
   await ev("document.getElementById('abyssalGuideX')?.click();window.AbyssalCockpitNavigation.open();");
   await wait("!document.getElementById('submarineWorkshop').hidden&&!!document.querySelector('#submarineWorkshop .abyss-control-deck')");
   await ev("document.fonts.ready.then(()=>true)");
   // Wait for the real loading overlay to finish, not just the DOM behind it.
   await wait("!document.getElementById('abyssalStartupLoading') && !document.documentElement.classList.contains('abyssal-startup')");
   await wait("(()=>{const e=document.querySelector('#submarineWorkshop .abyss-cockpit-visor');if(!e)return false;const r=e.getBoundingClientRect(),p=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!p&&e.contains(p);})()");
   await snap(device+'-cabine');
   const report=await ev(`(()=>{const box=document.getElementById('submarineWorkshop'),a=box.querySelector('#cockpitSoloDiveBtn')||box.querySelector('.abyss-console-info>button'),b=box.querySelector('#cockpitOnlineDiveBtn'),r=e=>{const q=e?.getBoundingClientRect();return q?{x:Math.round(q.x),y:Math.round(q.y),w:Math.round(q.width),h:Math.round(q.height)}:null;};const v=box.querySelector('.abyss-visor-body');return {solo:r(a),online:r(b),visor:r(v),deck:r(box.querySelector('.abyss-control-deck')),font:getComputedStyle(a).fontFamily,scrollWidth:v.scrollWidth,clientWidth:v.clientWidth,scrollHeight:v.scrollHeight,clientHeight:v.clientHeight,gameActive:document.body.classList.contains('game-active')};})()`);
   reports.push({device,screen:'cabine',...report});
   assert.ok(report.solo&&report.online&&!report.gameActive,'Missing menu controls');
   if(label==='after'){
    assert.ok(Math.abs(report.solo.w-report.online.w)<=2,'Unequal expedition cards');
    assert.ok(report.scrollWidth<=report.clientWidth+2,'Cabin horizontal overflow');
    assert.ok(mobile?report.online.y>report.solo.y:Math.abs(report.online.y-report.solo.y)<3,'Wrong card layout');
    assert.ok(report.online.y+report.online.h<=report.visor.y+report.visor.h+2,'Online card clipped on first view');
   }
   await ev("window.AbyssalCockpitNavigation.showExterior();");
   await wait("!document.getElementById('menuScreen').hidden&&document.body.classList.contains('abyss-hatch-navigation')");
   await sleep(500);await snap(device+'-exterior');
   if(label==='after'){
    const hub=await ev(`(()=>{const ids=['divePortalBtn','submarineWorkshopBtn','catalogBtn','profileBtn'];return ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),at=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {id,w:r.width,h:r.height,visible:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,hit:at===e||e.contains(at)};});})()`);
    reports.push({device,screen:'hub',controls:hub});console.log('[deep-ui] hub '+JSON.stringify(hub));assert.ok(hub.every(x=>x.visible&&x.hit&&x.h>=44&&x.w>=44),'Hub controls must be visible, reachable and large enough');
    assert.ok(await ev("getComputedStyle(document.getElementById('menuOceanMobilePad')).display==='none'"),'Legacy menu joystick visible');assert.ok(await ev("getComputedStyle(document.querySelector('#divePortalBtn strong')).color==='rgb(5, 13, 22)'"),'Launch text has insufficient contrast');
    await ev("document.querySelector('#hubMore summary').click()");await snap(device+'-mais-opcoes');await ev("document.querySelector('#hubMore summary').click()");
   }
   await ev("document.getElementById('catalogBtn').click()");await wait("!document.getElementById('catalogScreen').hidden");await snap(device+'-abyssario');
   if(label==='after'){await wait("!document.getElementById('catalogScreen').hidden && !!document.getElementById('codexSearch')");const contrast=await ev(`(()=>{const rgb=s=>s.match(/[\\d.]+/g).slice(0,3).map(Number),L=s=>rgb(s).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);const card=document.querySelector('#catalogGrid .codex-card:not([hidden])'),fg=getComputedStyle(card.querySelector('p')).color,bg=getComputedStyle(card).backgroundColor;const a=L(fg),b=L(bg);return {fg,bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};})()`);reports.push({device,screen:'abyssario',...contrast});assert.ok(contrast.ratio>=4.5,'Codex text contrast below WCAG AA');await ev("document.getElementById('codexSearch').value='zzzzzz';document.getElementById('codexSearch').dispatchEvent(new Event('input'))");assert.ok(await ev("document.getElementById('codexResultCount').textContent.includes('Nenhum')"),'Catalog search failed');}await ev("document.getElementById('catalogCloseBtn').click()");
   await ev("document.getElementById('divePortalBtn').click()");
   await wait("!document.getElementById('abyssalDiveChoicePanel').hidden");
   await snap(device+'-seletor');
   await ev("document.getElementById('abyssDiveChoiceClose').click();");
   if(label==='after'){
    await ev("document.getElementById('exteriorGuideBtn').click()");
    await wait("!document.getElementById('abyssalTutorialOverlay').hidden");
    assert.ok(await ev("document.querySelectorAll('#abyssalGuideSteps li:not([hidden])').length===1"),'Guide must show only one step');
    await snap(device+'-tutorial');
    await ev("document.getElementById('abyssalGuideNext').click()");
    assert.ok(await ev("document.getElementById('abyssalGuideProgress').value===2"),'Guide progress did not advance');
    await ev("document.getElementById('abyssalGuideModes').querySelector('[data-guide-mode=coop]').click()");
    assert.ok(await ev("document.getElementById('abyssalGuideProgress').value===1"),'Switching guide mode must restart at step one');
    await ev("document.getElementById('abyssalGuideX').click()");
   }
   await ev("window.AbyssalCockpitNavigation.open();");
   for(const [name,id] of [['perfil','cockpitProfileBtn'],['ranking','cockpitRankingBtn'],['roleta','cockpitWheelBtn'],['cardumes','cockpitCardumesBtn']]){
    await ev("document.getElementById("+JSON.stringify(id)+").click()");
    await sleep(200);await snap(device+'-'+name);
   }
   if(label==='after'){await ev("document.querySelector('#submarineWorkshop .abyss-control-research').click()");assert.ok(await ev("document.querySelectorAll('#submarineWorkshop .abyss-control-deck button').length===4"),'Cabin must expose four main actions');}else await ev("document.querySelector('#submarineWorkshop .abyss-control-solo').click();document.querySelector('#submarineWorkshop .solo-research-tabs button').click();");
   await snap(device+'-pesquisa');
   if(label==='after')assert.ok(await ev("document.querySelector('#submarineWorkshop .abyss-tree-map')?.textContent.includes('Pulso de Maré')&&document.querySelector('#submarineWorkshop .abyss-tree-map')?.textContent.includes('Passo Fantasma')"),'Q/E research nodes missing');
  }
  fs.writeFileSync(path.join(OUT,'deep-ui-'+label+'-metrics.json'),JSON.stringify(reports,null,2));
  console.log('[deep-ui] metrics '+JSON.stringify(reports));
 }finally{if(ws)ws.close();chrome.kill('SIGKILL');await new Promise(r=>server.close(r));await sleep(500);fs.rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}
async function main(){
 fs.mkdirSync(OUT,{recursive:true});const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'abyssal-ui-before-'));
 try{
  try{execFileSync('git',['cat-file','-e',BASE+'^{commit}'],{cwd:ROOT});}catch{execFileSync('git',['fetch','--depth=1','origin',BASE],{cwd:ROOT,stdio:'inherit'});}
  execFileSync('git',['worktree','add','--detach',tmp,BASE],{cwd:ROOT,stdio:'inherit'});
  await capture(tmp,'before');await capture(ROOT,'after');
 }finally{try{execFileSync('git',['worktree','remove','--force',tmp],{cwd:ROOT});}catch{}fs.rmSync(tmp,{recursive:true,force:true});}
}
module.exports=main;
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
