'use strict';
// Real Chromium smoke: run an unmodified solo Fossas expedition at desktop and
// mobile viewports, capture frames, and fail on uncaught canvas/gameplay errors.
// No account, database or external servers are needed.
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');
const assert=require('node:assert/strict');

const root=path.resolve(__dirname,'../public');
const output=path.resolve(__dirname,'../test-artifacts/browser-smoke');
const contentTypes={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
 '.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.woff':'font/woff','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav'};
const artGallery = "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>html,body{margin:0;min-height:100%;background:#020b13;color:#e5f6fc;font:14px system-ui}main{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px}section{background:radial-gradient(ellipse at center,#142d38,#06131f 72%);border:1px solid #33505a;border-radius:12px;text-align:center;overflow:hidden}canvas{display:block;width:100%;height:274px}h2{font-size:15px;margin:6px 0 8px;font-weight:600;letter-spacing:.04em}</style></head><body><main>\n<section><canvas id=\"gharial\" width=\"402\" height=\"274\"></canvas><h2>Gavial das Águas Negras</h2></section>\n<section><canvas id=\"leatherback\" width=\"402\" height=\"274\"></canvas><h2>Tartaruga-de-Couro</h2></section>\n<section><canvas id=\"hawksbill\" width=\"402\" height=\"274\"></canvas><h2>Tartaruga-de-Pente</h2></section>\n<section><canvas id=\"nightmareBoss\" width=\"402\" height=\"274\"></canvas><h2>Pesadelo Roxo, boss</h2></section>\n<section><canvas id=\"nightmareRelic\" width=\"402\" height=\"274\"></canvas><h2>Vestígio do Pesadelo, loja</h2></section>\n<section><canvas id=\"ribbonmoray\" width=\"402\" height=\"274\"></canvas><h2>Moreia-Fita Noturna</h2></section></main>\n<script src=\"/abyssal-curated-skins.js\"></script><script src=\"/marine-art.js\"></script><script src=\"/abyssal-rift-hardcore.js\"></script>\n<script>try{const catalog=window.AbyssalCuratedSkins.byId;for(const id of ['gharial','leatherback','hawksbill','ribbonmoray']){const canvas=document.getElementById(id),ctx=canvas.getContext('2d');ctx.lineCap='round';ctx.lineJoin='round';window.AbyssalMarineArt.draw(ctx,id==='ribbonmoray'?265:220,132,id==='ribbonmoray'?44:54,0,catalog[id],1600,false);}window.AbyssalRiftHardcore.drawFinalBoss(document.getElementById('nightmareBoss').getContext('2d'),{x:201,y:140,r:64,hp:100,maxHp:100},1600);window.AbyssalRiftHardcore.drawNightmareRelic(document.getElementById('nightmareRelic').getContext('2d'),201,137,66,1600);document.body.dataset.artStatus='painted';}catch(error){document.body.dataset.artStatus=String(error);}</script></body></html>";
const injected=`<script>
(()=>{
 const errors=[],original=console.error;
 console.error=function(...parts){errors.push(parts.map(String).join(' '));return original.apply(this,parts)};
 window.addEventListener('error',event=>{if(event.message)errors.push(String(event.message))});
 window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
 const check=()=>{
  const canvas=document.getElementById('game'),active=document.body.classList.contains('game-active');
  document.body.dataset.smokeStatus=active&&canvas&&canvas.width>50&&canvas.height>50&&!document.body.classList.contains('abyssal-tutorial-open')&&document.getElementById('ageTermsScreen')?.hidden!==false?'playing':'not-playing';
  document.body.dataset.smokeCanvas=(canvas?canvas.width+'x'+canvas.height:'missing');
  document.body.dataset.smokeDepth=String(window.AbyssalGameHooks?.expeditionState?.()?.depthState?.depth??-1);
  const ids=['hud','abyssDepthMeter','runEnergyRanking','selectedSkillsPanel','mobilePauseBtn','toggleHudBtn'];
  const coords=Object.fromEntries(ids.map(id=>{
   const el=document.getElementById(id),r=el?.getBoundingClientRect();
   const style=el?getComputedStyle(el):null;
   return [id,r?{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),display:style.display}:null];
  }));
  document.body.dataset.smokeLayout=JSON.stringify(coords);
  document.body.dataset.smokeMode=document.body.className;

  document.body.dataset.smokeError=errors.filter(e=>/Abyssal frame error|ReferenceError|TypeError|SyntaxError/i.test(e)).slice(0,2).join('|').slice(0,180);
 };
 setInterval(check,350);
 window.addEventListener('load',()=>{
   setTimeout(()=>{
    // Complete the real age-consent UI using a fictitious adult test profile;
    // the test never modifies the live game or bypasses its validation.
    for(const [id,value] of [['ageBirthDay','1'],['ageBirthMonth','1'],['ageBirthYear','1990']]){
     const input=document.getElementById(id);if(input){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}
    }
    const terms=document.getElementById('ageTermsAccept');if(terms)terms.checked=true;
    document.getElementById('ageTermsContinue')?.click();
   },300);
   setTimeout(()=>{window.dispatchEvent(new CustomEvent('abyssal-start-rift-solo'));check()},950);
   setTimeout(()=>{document.getElementById('abyssalGuideX')?.click();check()},2000);
   setTimeout(()=>{const stage=new URLSearchParams(location.search).get('stage');if(stage==='deep')window.AbyssalGameHooks?.setPlayerPosition?.(2400,10500);if(stage==='boss')window.AbyssalGameHooks?.setPlayerPosition?.(2400,23300);check()},2550);
 });
})();
</script>`;
function handler(req,res){
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{return res.writeHead(400).end();}
 if(pathname==='/__abyss_art__'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(artGallery);return;}
 const smoke=pathname==='/__abyss_smoke__';
 const filepath=smoke?path.join(root,'index.html'):path.resolve(root,'.'+pathname);
 if(!filepath.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(filepath,(err,data)=>{
  if(err){res.writeHead(404);res.end('Not found');return;}
  const ext=smoke?'.html':path.extname(filepath);
  if(smoke)data=Buffer.from(data.toString('utf8').replace('</body>',injected+'</body>'));
  res.writeHead(200,{'Content-Type':contentTypes[ext]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(data);
 });
}
function browserBin(){
 for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
  const r=spawnSync('which',[name],{encoding:'utf8'});
  if(r.status===0)return r.stdout.trim();
 }
 return null;
}
async function run(browser,args){
 return await new Promise((resolve,reject)=>{
  const proc=spawn(browser,args,{stdio:['ignore','pipe','pipe'],env:{...process.env,HOME:os.homedir()}});
  let out='',err='',finished=false;
  const timeout=setTimeout(()=>{if(!finished){proc.kill('SIGKILL');reject(new Error('Browser timed out: '+args.join(' '))) }},55000);
  proc.stdout.on('data',chunk=>{out+=String(chunk);if(out.length>1500000)out=out.slice(-1500000)});
  proc.stderr.on('data',chunk=>{err+=String(chunk);if(err.length>10000)err=err.slice(-10000)});
  proc.once('error',error=>{finished=true;clearTimeout(timeout);reject(error)});
  proc.once('close',code=>{finished=true;clearTimeout(timeout);if(code!==0)reject(new Error('Chromium exit '+code+': '+err.slice(-2500)));else resolve(out)});
 });
}
async function main(){
 const browser=browserBin();assert.ok(browser,'Google Chrome or Chromium is required for real visual smoke tests');
 fs.mkdirSync(output,{recursive:true});
 const server=http.createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/__abyss_smoke__';
 try{
  for(const [label,width,height,ua,stage] of [
   ['desktop',1280,720,null,null],
   ['mobile',390,844,'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',null],
   ['deep-desktop',1280,720,null,'deep'],
   ['boss-desktop',1280,720,null,'boss']]){
   const common=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars',
    '--no-first-run','--disable-background-networking','--autoplay-policy=no-user-gesture-required',
    '--window-size='+width+','+height,'--force-device-scale-factor=1','--virtual-time-budget=9000'];
   if(ua)common.push('--user-agent='+ua);
   const scenarioUrl=url+(stage?'?stage='+encodeURIComponent(stage):'');
   const page=await run(browser,[...common,'--dump-dom',scenarioUrl]);
   const status=page.match(/data-smoke-status="([^"]+)"/)?.[1];
   const canvas=page.match(/data-smoke-canvas="([^"]+)"/)?.[1];
   const error=page.match(/data-smoke-error="([^"]*)"/)?.[1];
   const layoutEncoded=page.match(/data-smoke-layout="([^"]+)"/)?.[1]||'';
   const layout=layoutEncoded?JSON.parse(layoutEncoded.replace(/&quot;/g,'"').replace(/&amp;/g,'&')):{};
   console.log('[browser-smoke] '+label+' layout '+JSON.stringify(layout));
   assert.equal(status,'playing',label+' did not start gameplay, canvas='+canvas+', error='+error);
   assert.ok(!error,label+' triggered a runtime error: '+error);
   const depth=Number(page.match(/data-smoke-depth="([^"]*)"/)?.[1]);
   if(stage)assert.ok(depth>80,label+' should navigate into the Fossa, depth='+depth);
   const screenshot=path.join(output,label+'.png');
   await run(browser,[...common,'--screenshot='+screenshot,scenarioUrl]);
   assert.ok(fs.statSync(screenshot).size>4500,label+' screenshot is blank or missing');
   console.log('[browser-smoke] '+label+' playing, canvas '+canvas+', screenshot '+fs.statSync(screenshot).size+' bytes');
  }
  const artDom=await run(browser,['--headless=new','--no-sandbox','--disable-dev-shm-usage',
    '--disable-gpu','--no-first-run','--window-size=1280,720','--virtual-time-budget=4000','--dump-dom',
    'http://127.0.0.1:'+server.address().port+'/__abyss_art__']);
  const artStatus=artDom.match(/data-art-status="([^"]*)"/)?.[1];
  assert.equal(artStatus,'painted','real marine art failed in browser: '+artStatus);
  const artPath=path.join(output,'creature-identity.png');
  await run(browser,['--headless=new','--no-sandbox','--disable-dev-shm-usage',
    '--disable-gpu','--no-first-run','--window-size=1280,720','--screenshot='+artPath,
    'http://127.0.0.1:'+server.address().port+'/__abyss_art__']);
  assert.ok(fs.statSync(artPath).size>20000,'marine art capture missing');
  console.log('[browser-smoke] creature identity artwork '+fs.statSync(artPath).size+' bytes');
 }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(err=>{console.error('[browser-smoke] '+err.stack);process.exitCode=1});
