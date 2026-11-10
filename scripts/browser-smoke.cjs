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
const localGameSmoke = [
"// Browser smoke only. Injected by its local HTTP server, never committed to public/game.js.",
"window.__abyssalSmokeStep = () => {",
" if(!isRiftRun() || onlineMode || !activeMapLayout) throw Error('Solo Fossa not active');",
" // A real player can be in a paused level-up screen when this step begins.",
" if(gameState==='upgrade' && upgradeOptions.length)chooseUpgrade(upgradeOptions[0]);",
" if(gameState!=='playing') throw Error('Solo Fossa not active: '+gameState);",
" const tier=activeMapTier, final=RIFT_HARDCORE.FINAL_TIER, bossRoom=activeMapLayout.rooms.find(r=>r.id==='boss');",
" if(!bossRoom || tier<0 || tier>final) throw Error('Invalid Fossa tier '+tier);",
" player.invuln=Math.max(player.invuln,3600);",
" player.x=bossRoom.x;player.y=bossRoom.y;updateCamera();",
" // An encounter is streamed in at most two entities per frame; simulate",
" // enough prewarm frames for the room being entered before asserting.",
" for(let prewarmFrame=0;prewarmFrame<14;prewarmFrame++) {",
"   activateSoloRiftRoomEncounter();",
"   if(enemies.some(e=>e.hp>0 && BOSS_KINDS.includes(e.kind)))break;",
" }",
" const activeBosses=enemies.filter(e=>e.hp>0 && BOSS_KINDS.includes(e.kind));",
" if(activeBosses.length!==1) {const direct=spawnEnemy(false,'boss',{roomId:'boss',silentBoss:true});throw Error('Boss missing tier '+tier+'; direct='+JSON.stringify(direct&&[direct.kind,direct.hp,direct.spawnRoomId])+'; BOSS_KINDS='+JSON.stringify(BOSS_KINDS)+'; queue='+JSON.stringify(soloRiftSpawnQueue)+'; enemyKinds='+JSON.stringify(enemies.map(e=>[e.kind,e.hp,e.spawnRoomId]).slice(-25)));}",
" const boss=activeBosses[0];",
" if(tier===final && boss.kind!==RIFT_HARDCORE.FINAL_KIND) throw Error('Final guardian mismatch: '+boss.kind);",
" killEnemy(enemies.indexOf(boss));",
" // Killing a boss grants XP. Close the real level-up selection before using a portal.",
" if(gameState==='upgrade' && upgradeOptions.length)chooseUpgrade(upgradeOptions[0]);",
" if(!cavePortalsUnlocked()) throw Error('Boss victory did not unlock portals in tier '+tier);",
" const portals=activeMapLayout.portals;",
" const target=tier===final?portals.surface:portals.boss;",
" if(!target || !ABYSSAL_MAP.isWalkable(activeMapLayout,target.x,target.y,player.r)) throw Error('Exit sigil outside traversable cave at tier '+tier);",
" player.x=target.x;player.y=target.y;updateCamera();",
" const interaction=currentMapInteraction();",
" const expected=tier===final?'surface':'next-tier';",
" if(interaction?.type!==expected) throw Error('Wrong portal after boss at tier '+tier+': '+interaction?.type);",
" if(tier<final && !activateMapInteraction()) throw Error('Descent failed at tier '+tier);",
" if(tier<final && activeMapTier!==tier+1) throw Error('Transition skipped/duplicated tier '+tier);",
" return {tier,boss:boss.kind,unlocked:true,exit:interaction.type,nextTier:activeMapTier,bossesKilled:bossKillsThisRun,depth:ABYSSAL_MAP.depthAt(activeMapLayout,player.x,player.y),layoutHeight:activeMapLayout.height,playerY:player.y};",
"};"
].join('\n');
// Exhaustive visual QA, served only by the temporary browser-smoke server.
const speciesGallery='<!doctype html><html><head><meta charset="utf-8"><style>body{background:#03121a;color:#d7edf0;font:12px system-ui;margin:0}main{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;padding:5px}section{background:radial-gradient(ellipse at center,#1b3039,#07121d);border:1px solid #31434d;border-radius:8px;text-align:center;overflow:hidden}canvas{width:100%;height:148px;display:block}label{height:24px;display:block;padding:2px;font-weight:600}</style></head><body><main id="gallery"></main><script src="/abyssal-curated-skins.js"></script><script src="/skin-motion.js"></script><script src="/marine-art.js"></script><script>try{const root=document.getElementById("gallery"),list=window.AbyssalCuratedSkins.items;let painted=0;for(const skin of list){const section=document.createElement("section"),canvas=document.createElement("canvas"),label=document.createElement("label");canvas.width=209;canvas.height=148;label.textContent=skin.name;section.append(canvas,label);root.appendChild(section);const ctx=canvas.getContext("2d",{willReadFrequently:true});window.AbyssalMarineArt.draw(ctx,122,74,23,0,skin,1350,false);const before=ctx.getImageData(0,0,209,148).data; ctx.clearRect(0,0,209,148); window.AbyssalMarineArt.draw(ctx,122,74,23,0,skin,2510,false); const data=ctx.getImageData(0,0,209,148).data; let changed=0;for(let i=0;i<data.length;i+=4){if(Math.abs(data[i]-before[i])+Math.abs(data[i+1]-before[i+1])+Math.abs(data[i+2]-before[i+2])+Math.abs(data[i+3]-before[i+3])>18)changed++;} if(changed<12)throw Error("Static creature "+skin.id+" / "+changed); let visible=0;for(let i=3;i<data.length;i+=4)if(data[i]>45)visible++;if(visible<150)throw Error("Blank or tiny species "+skin.id+" / "+visible);painted++;}if(painted!==41)throw Error("Only "+painted+" species");document.body.dataset.artStatus="painted";document.body.dataset.artCount=painted;}catch(error){document.body.dataset.artStatus=String(error);}</script></body></html>';
const hazardsGallery='<!doctype html><html><head><meta charset="utf-8"><style>body{background:#03121a;color:#d7edf0;font:12px system-ui;margin:0}main{display:grid;grid-template-columns:repeat(9,1fr);gap:4px;padding:4px}section{background:radial-gradient(ellipse at center,#1b3039,#07121d);border:1px solid #31434d;border-radius:8px;text-align:center}canvas{width:100%;height:178px;display:block}label{display:block;height:22px}</style></head><body><main id="gallery"></main><script src="/abyssal-map.js"></script><script src="/abyssal-rift-hardcore.js"></script><script>try{const layout=window.AbyssalMap.createLayout(72433,7),H=window.AbyssalRiftHardcore,all=H.build(layout,7);let total=0;for(const phase of ["idle","warning","active"])for(const type of Object.keys(H.TYPES)){const trap=all.find(h=>h.type===type);if(!trap)throw Error("Missing "+type);const section=document.createElement("section"),canvas=document.createElement("canvas"),label=document.createElement("label");canvas.width=210;canvas.height=178;label.textContent=type+" "+phase;section.append(canvas,label);document.getElementById("gallery").appendChild(section);const ctx=canvas.getContext("2d",{willReadFrequently:true});const x=Number.isFinite(trap.sourceX)?trap.sourceX:trap.x,y=Number.isFinite(trap.sourceY)?trap.sourceY:trap.y;ctx.translate(105,90);ctx.scale(.45,.45);ctx.translate(-x,-y);const onset=trap.period-trap.active-trap.warning-trap.offset;const seconds=phase==="idle"?onset-1:phase==="warning"?(trap.warning?onset+trap.warning*.83:onset+.01):onset+trap.warning+trap.active*(type==="rockfall"?.21:.55);H.draw(ctx,[trap],seconds);total++;}document.body.dataset.artStatus="painted";document.body.dataset.artCount=total;}catch(error){document.body.dataset.artStatus=String(error);}</script></body></html>';
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
  document.body.dataset.smokeElapsed=String(window.AbyssalGameHooks?.expeditionState?.()?.elapsed??-1);
  document.body.dataset.smokeWorldHeight=String(window.AbyssalGameHooks?.worldHeight?.()??-1);
  document.body.dataset.smokeRiftPlaying=String(window.AbyssalGameHooks?.isRiftPlaying?.()===true);
  const ids=['hud','abyssDepthMeter','runEnergyRanking','selectedSkillsPanel','mobilePauseBtn','toggleHudBtn'];
  const coords=Object.fromEntries(ids.map(id=>{
   const el=document.getElementById(id),r=el?.getBoundingClientRect();
   const style=el?getComputedStyle(el):null;
   return [id,r?{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),display:style.display}:null];
  }));
  document.body.dataset.smokeLayout=JSON.stringify(coords);
  document.body.dataset.smokeMode=document.body.className;
  const inventoryRoot=document.getElementById('abyssInventoryRoot');
  const inventoryPanel=document.getElementById('abyssInventoryPanel');
  document.body.dataset.smokeInventoryActive=String(Boolean(inventoryRoot&&!inventoryRoot.hidden));
  document.body.dataset.smokeInventoryOpen=String(Boolean(inventoryPanel&&!inventoryPanel.hidden));
  document.body.dataset.smokeInventorySlots=String(document.querySelectorAll('#abyssInventoryGrid .abyss-inventory-slot').length);
  document.body.dataset.smokeInventorySelected=String(document.getElementById('abyssInventorySelected')?.textContent||'');
  document.body.dataset.smokeInventoryDiag=JSON.stringify({ui:Boolean(window.AbyssalInventoryUI),root:Boolean(inventoryRoot),rootHidden:inventoryRoot?.hidden??null,mode:window.AbyssalGameHooks?.explorationPosition?.()?.mode??null});

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
   setTimeout(()=>{const stage=new URLSearchParams(location.search).get('stage');if(stage==='cockpit')return;window.dispatchEvent(new CustomEvent(stage==='sea'?'abyssal-start-open-sea':'abyssal-start-rift-solo'));check()},950);
   setTimeout(()=>{document.getElementById('abyssalGuideX')?.click();check()},2000);
   let inventoryAttempts=0;
   const openSeaInventory=()=>{const q=new URLSearchParams(location.search),stage=q.get('stage');if(stage!=='sea'||q.has('biome'))return;const toggle=document.getElementById('abyssInventoryToggle');const root=document.getElementById('abyssInventoryRoot');if(toggle&&root&&!root.hidden){toggle.click();check();return;}inventoryAttempts++;if(inventoryAttempts<24)setTimeout(openSeaInventory,150);else check();};
   setTimeout(openSeaInventory,2200);
   setTimeout(()=>{const q=new URLSearchParams(location.search),stage=q.get('stage');if(stage==='deep')window.AbyssalGameHooks?.setPlayerPosition?.(2720,4180);if(stage==='boss')window.AbyssalGameHooks?.setPlayerPosition?.(2400,8660);if(stage==='sea'&&q.has('biome')){const spots={coastal:[1580,480],cinematic:[8500,2900],geological:[19000,9000]};const v=spots[q.get('biome')];if(v)window.AbyssalGameHooks?.setPlayerPosition?.(...v);}check()},2550);
   if(new URLSearchParams(location.search).get('stage')==='cockpit'){
    setTimeout(()=>document.getElementById('submarineWorkshopBtn')?.click(),2900);
    setTimeout(()=>{
     try{
      const box=document.getElementById('submarineWorkshop');
      if(!box||box.hidden)throw Error('Hatch did not open cockpit '+JSON.stringify({menuHidden:document.getElementById('menuScreen')?.hidden,menuClass:document.getElementById('menuScreen')?.className,stageTransit:document.getElementById('menuOceanStage')?.dataset.abyssTransit,btn:Boolean(document.getElementById('submarineWorkshopBtn')),btnDisabled:document.getElementById('submarineWorkshopBtn')?.disabled,body:document.body.className,guideHidden:document.getElementById('abyssalGuide')?.hidden,workshopAPI:Boolean(window.AbyssalSubmarineCockpit),blockers:[...document.querySelectorAll('.modal-screen,.modal-overlay,#abyssDescentPanel,#abyssalDiveChoicePanel')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden').slice(0,8).map(el=>el.id)}));
      const canvas=document.getElementById('abyssCockpitCanvas');
      if(!canvas||canvas.width<300||canvas.height<250)throw Error('Cockpit canvas not painted');
      const keys=[...box.querySelectorAll('.abyss-control-key')];
      if(keys.length!==6)throw Error('Physical control keys: '+keys.length);
      const mineral=keys.find(b=>b.textContent.includes('MINÉRIOS'));
      mineral?.click();
      const tiles=box.querySelectorAll('.abyss-mineral-tile').length;
      const icons=box.querySelectorAll('.abyss-mineral-tile svg').length;
      if(tiles!==6||icons!==6)throw Error('Mineral monitor missing art: '+tiles+'/'+icons);
      const lab=[...box.querySelectorAll('.abyss-control-key')].find(b=>b.textContent.includes('LABORATÓRIO'));
      lab?.click();
      const cards=box.querySelectorAll('.submarine-console-card').length;
      const req=box.querySelectorAll('.abyss-requirement svg').length;
      if(cards<1||req<1)throw Error('Laboratory lost real research costs: '+cards+'/'+req);
      // Real-browser layout contract: compact keys must remain beneath the monitor.
      const monitor=box.querySelector('.abyss-cockpit-visor');
      const deck=box.querySelector('.abyss-control-deck');
      const monitorRect=monitor?.getBoundingClientRect();
      const deckRect=deck?.getBoundingClientRect();
      const keyRects=keys.map(key=>key.getBoundingClientRect());
      if(!monitorRect||!deckRect)throw Error('Cockpit monitor/deck missing');
      if(deckRect.top<monitorRect.bottom-4)throw Error('Console deck overlaps monitor or sits alongside it');
      if(Math.abs(deckRect.left-monitorRect.left)>8||Math.abs(deckRect.width-monitorRect.width)>18)
       throw Error('Console keys are not aligned with the main monitor');
      if(keyRects.some(r=>r.height>(innerWidth>700?100:72)))
       throw Error('Oversized vertically stretched console key');
      if(monitorRect.width<210||monitorRect.height<95)
       throw Error('Central cockpit display is too small');
      document.body.dataset.cockpitLayout=JSON.stringify({
       visor:[Math.round(monitorRect.width),Math.round(monitorRect.height)],
       keys:[Math.round(deckRect.width),Math.round(deckRect.height)],
       keyHeight:Math.round(keyRects[0].height)
      });
      document.body.dataset.cockpitStatus='ok';
      document.body.dataset.cockpitCards=cards;
      document.body.dataset.cockpitIcons=icons;
     }catch(error){
      document.body.dataset.cockpitStatus='error';
      document.body.dataset.cockpitError=String(error).slice(0,160);
     }
    },6200);
   }
 });
})();
</script>`;
const journalProbe="<script>(function(){\nfunction verify(){try{\ndocument.getElementById('catalogBtn').click();\nconst book=document.querySelector('#catalogScreen .abyss-journal');\nconst entries=[...document.querySelectorAll('#catalogGrid .specimen-journal-entry')];\nconst locked=entries.filter(el=>el.classList.contains('locked'));\nconst known=entries.filter(el=>el.classList.contains('unlocked'));\nif(!book||entries.length<50||!locked.length||!known.length)throw Error('Journal entries missing '+entries.length);\nif(!known[0].textContent.includes('VIDA')||!known[0].textContent.includes('VELOCIDADE')||!known[0].textContent.includes('DANO'))throw Error('Stats missing');\nif(!getComputedStyle(book).backgroundImage.includes('linear-gradient'))throw Error('Paper style missing');\ndocument.getElementById('catalogScreen').hidden=true;\ndocument.getElementById('shopBtn').click();\nconst cards=document.querySelectorAll('#skinGrid .skin-card');\nconst vessel=document.querySelector('#skinGrid .specimen-vessel');\nconst water=vessel&&getComputedStyle(vessel,'::before').backgroundImage;\nif(cards.length<50||!water||!water.includes('linear-gradient'))throw Error('Lab capsules missing '+cards.length);\ndocument.body.dataset.journalStatus='ok';\ndocument.body.dataset.journalCounts=entries.length+','+locked.length+','+cards.length;\n}catch(e){document.body.dataset.journalStatus='error';document.body.dataset.journalError=String(e).slice(0,160);}}\nwindow.addEventListener('load',()=>setTimeout(verify,1200));\n})();</script>";
function handler(req,res){
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{return res.writeHead(400).end();}
 if(pathname==='/__abyss_art__'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(artGallery);return;}
 if(pathname==='/__abyss_species__'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(speciesGallery);return;}
 if(pathname==='/__abyss_hazards__'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(hazardsGallery);return;}
 const smoke=pathname==='/__abyss_smoke__';
 const journal=pathname==='/__abyss_journal__';
 const filepath=(smoke||journal)?path.join(root,'index.html'):path.resolve(root,'.'+pathname);
 if(!filepath.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.readFile(filepath,(err,data)=>{
  if(err){res.writeHead(404);res.end('Not found');return;}
  const ext=(smoke||journal)?'.html':path.extname(filepath);
  if(smoke)data=Buffer.from(data.toString('utf8').replace('</body>',injected+'</body>'));
  if(journal)data=Buffer.from(data.toString('utf8').replace('</body>',journalProbe+'</body>'));
  if(pathname==='/game.js'){
   // Test-only introspection executes real boss death/portal game logic across every tier,
   // without exposing simulation shortcuts to normal players or the deployed client.
   const source=data.toString('utf8'),closing=/\n\}\)\(\);\s*$/;
   assert.ok(closing.test(source),'Browser probe could not find game IIFE closing');
   data=Buffer.from(source.replace(closing,'\n'+localGameSmoke+'\n})();\n'));
  }
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
async function realGameplaySmoke(browser,url){
 // Unlike Chrome's virtual-time screenshot mode, CDP runs requestAnimationFrame
 // at real time and confirms simulation tick progress before taking captures.
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'abyss-live-cdp-'));
 const args=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
  '--no-first-run','--remote-debugging-port=0','--remote-allow-origins=*',
  '--window-size=1280,720','--user-data-dir='+directory,'about:blank'];
 const chrome=spawn(browser,args,{stdio:['ignore','ignore','pipe']});
 let chromeError='',socket=null;
 chrome.stderr.on('data',part=>{chromeError+=String(part);if(chromeError.length>4000)chromeError=chromeError.slice(-4000);});
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 try{
  let port=null;
  for(let i=0;i<100;i++){
   const file=path.join(directory,'DevToolsActivePort');
   if(fs.existsSync(file)){const line=fs.readFileSync(file,'utf8').split(/\r?\n/)[0];port=Number(line);if(port)break;}
   if(chrome.exitCode!==null)throw new Error('Chrome terminated before opening CDP: '+chromeError.slice(-1200));
   await sleep(100);
  }
  assert.ok(port,'Chromium did not open the DevTools port: '+chromeError.slice(-1200));
  console.log('[live-browser] CDP port ready '+port);
  const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list',{signal:AbortSignal.timeout(5000)})).json();
  const tab=tabs.find(item=>item.type==='page');
  assert.ok(tab?.webSocketDebuggerUrl,'CDP page target unavailable');
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  await Promise.race([new Promise((resolve,reject)=>{
   socket.addEventListener('open',resolve,{once:true});
   socket.addEventListener('error',reject,{once:true});
  }),new Promise((_,reject)=>setTimeout(()=>reject(new Error('CDP WebSocket open timeout')),7000))]);
  console.log('[live-browser] WebSocket connected');
  let sequence=0;
  const pending=new Map();
  socket.addEventListener('message',event=>{
   let message;
   try{message=JSON.parse(String(event.data));}catch{return;}
   if(!message.id||!pending.has(message.id))return;
   const {resolve,reject}=pending.get(message.id);pending.delete(message.id);
   if(message.error)reject(new Error('CDP '+JSON.stringify(message.error)));
   else resolve(message.result||{});
  });
  const command=(method,params={})=>new Promise((resolve,reject)=>{
   const id=++sequence;
   const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timed out on '+method));},8000);
   pending.set(id,{resolve:value=>{clearTimeout(timeout);resolve(value)},reject:error=>{clearTimeout(timeout);reject(error)}});
   socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async(expression)=>{
   const response=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
   if(response.exceptionDetails)throw new Error('CDP evaluation: '+JSON.stringify(response.exceptionDetails));
   return response.result?.value;
  };
  const stateExpr='(()=>{const g=window.AbyssalGameHooks;return {active:g?.isRiftPlaying?.(),elapsed:g?.expeditionState?.()?.elapsed,depth:g?.expeditionState?.()?.depthState?.depth,worldHeight:g?.worldHeight?.(),errors:document.body.dataset.smokeError||\"\",gameState:g?.motionDiagnostics?.()?.gameState,screen:document.body.className}})()';
  const screenshot=async(name)=>{
   const r=await command('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
   const file=path.join(output,name+'.png');
   fs.writeFileSync(file,Buffer.from(r.data,'base64'));
   assert.ok(fs.statSync(file).size>10000,'Live screenshot missing: '+name);
  };
  console.log('[live-browser] CDP enabling domains');
  await command('Page.enable');
  await command('Runtime.enable');
  console.log('[live-browser] navigating to actual game');
  await command('Page.navigate',{url});
  await sleep(6500);
  let state=await evaluate(stateExpr);
  console.log('[live-browser] start '+JSON.stringify(state));
  assert.equal(state?.active,true,'Fossas must be actively playing after the tutorial closes');
  assert.ok(Number(state?.elapsed)>1,'requestAnimationFrame/game simulation did not advance during real time');
  assert.equal(state?.worldHeight,9000);
  assert.ok(!state?.errors,'runtime error while simulating: '+state.errors);
  await screenshot('live-start');
  const move=async(name,x,y,minDepth,maxDepth)=>{
   const accepted=await evaluate('window.AbyssalGameHooks?.setPlayerPosition?.('+x+','+y+')');
   assert.equal(accepted,true,'Could not navigate to '+name);
   await sleep(2100);
   let next=await evaluate(stateExpr);
   // Level-up offers intentionally pause the match. Pick a real offered card
   // and continue the simulation before checking progression.
   for(let attempt=0;attempt<5&&next?.gameState==='upgrade';attempt++){
    const selected=await evaluate('(()=>{const button=document.querySelector(\"#upgradeChoices .upgrade-card\");if(!button)return false;button.click();return true})()');
    assert.ok(selected,'Upgrade modal did not expose a selectable skill');
    await sleep(500);next=await evaluate(stateExpr);
   }
   console.log('[live-browser] '+name+' '+JSON.stringify(next));
   assert.ok(next?.active&&next?.elapsed>state.elapsed+.75,name+' stopped simulation');
   assert.ok(next?.depth>=minDepth&&next?.depth<=maxDepth,name+' wrong cave depth');
   assert.ok(!next?.errors,name+' runtime errors');
   state=next;
   await screenshot('live-'+name);
  };
  await move('deep',2720,4180,135,230);
  await move('boss',2400,8660,315,355);
  // Full tier progression is exercised inside the running Chromium game. Only the
  // boss HP reduction is accelerated; spawn, death, unlock and portal logic remain real.
  const journey=[];
  for(let tier=0;tier<=7;tier++){
   const step=await evaluate('window.__abyssalSmokeStep?.()');
   assert.equal(step?.tier,tier,'Fossa floor sequence must not skip or repeat a tier');
   assert.equal(step?.unlocked,true,'Boss must open exit sigils');
   assert.equal(step?.exit,tier===7?'surface':'next-tier');
   assert.equal(step?.nextTier,Math.min(7,tier+1));
   journey.push(step);
  }
  console.log('[live-browser] eight cave floors traversed, seven portals, final guardian '+JSON.stringify(journey));
  await sleep(350);
  let lastFloor=await evaluate(stateExpr);
  // The final boss XP may legitimately trigger the level-up modal on the same frame.
  // Resolve that transient progression state before asserting that the expedition survived.
  for(let attempt=0;attempt<5&&lastFloor?.gameState==='upgrade';attempt++){
   const selected=await evaluate('(()=>{const button=document.querySelector("#upgradeChoices .upgrade-card");if(!button)return false;button.click();return true})()');
   assert.ok(selected,'Final Fossa level-up modal did not expose a selectable skill');
   await sleep(500);lastFloor=await evaluate(stateExpr);
  }
  console.log('[live-browser] final-layer-state '+JSON.stringify(lastFloor));
  assert.equal(lastFloor?.active,true,'Final Fossa boss victory must return to active gameplay after progression');
  assert.ok(lastFloor?.depth>=2450,'Final Fossa must report final-layer depth');
  assert.ok(!lastFloor?.errors,'Final Fossa runtime errors: '+lastFloor?.errors);
  await screenshot('live-final-floor');
 }finally{
  if(socket&&socket.readyState<=1)try{socket.close();}catch{}
  chrome.kill('SIGKILL');
  await Promise.race([new Promise(resolve=>chrome.once('close',resolve)),sleep(1800)]);
  fs.rmSync(directory,{recursive:true,force:true,maxRetries:7,retryDelay:120});
 }
}
async function main(){
 const browser=browserBin();assert.ok(browser,'Google Chrome or Chromium is required for real visual smoke tests');
 fs.mkdirSync(output,{recursive:true});
 const server=http.createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/__abyss_smoke__';
 try{
  for(const [label,width,height] of [['journal-desktop',1280,720],['journal-mobile',390,844]]){
   const flags=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
     '--no-first-run','--window-size='+width+','+height,'--virtual-time-budget=5500'];
   const url='http://127.0.0.1:'+server.address().port+'/__abyss_journal__';
   const dom=await run(browser,[...flags,'--dump-dom',url]);
   const status=dom.match(/data-journal-status="([^"]+)"/)?.[1];
   const error=dom.match(/data-journal-error="([^"]*)"/)?.[1];
   const counts=dom.match(/data-journal-counts="([^"]*)"/)?.[1];
   assert.equal(status,'ok',label+' journal or lab regression: '+error);
   console.log('[journal-smoke] '+label+' entries,locked,cards='+counts);
   const png=path.join(output,label+'.png');
   await run(browser,[...flags,'--screenshot='+png,url]);
   assert.ok(fs.statSync(png).size>7000,'Journal screenshot missing');
  }
  if(process.argv.includes('--journal-only'))return;
  // Test the actual hatch transition and physical console in a real browser,
  // including mobile; save screenshots for visual acceptance inspection.
  for(const [label,w,h] of [['cockpit-desktop',1280,720],['cockpit-mobile',390,844]]){
   const flags=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars',
    '--no-first-run','--disable-background-networking','--window-size='+w+','+h,
    '--force-device-scale-factor=1','--virtual-time-budget=11000'];
   const cockpitURL=url+'?stage=cockpit';
   const dom=await run(browser,[...flags,'--dump-dom',cockpitURL]);
   const status=dom.match(/data-cockpit-status="([^"]*)"/)?.[1];
   const error=dom.match(/data-cockpit-error="([^"]*)"/)?.[1];
   assert.equal(status,'ok',label+' failed cockpit integration: '+error);
   console.log('[cockpit-smoke] '+label+' cards='+dom.match(/data-cockpit-cards="([^"]*)"/)?.[1]);
   const screenshot=path.join(output,label+'.png');
   await run(browser,[...flags,'--screenshot='+screenshot,cockpitURL]);
   assert.ok(fs.statSync(screenshot).size>10000,label+' cockpit screenshot missing');
  }
  // Real, unmasked screenshots from the running game for biome art acceptance.
  for(const biome of ['coastal','cinematic','geological']){
   const file=path.join(output,'open-sea-'+biome+'.png');
   await run(browser,['--headless=new','--no-sandbox','--disable-dev-shm-usage',
    '--disable-gpu','--hide-scrollbars','--no-first-run','--disable-background-networking',
    '--window-size=1280,720','--force-device-scale-factor=1',
    '--virtual-time-budget=8500','--screenshot='+file,url+'?stage=sea&biome='+biome]);
   assert.ok(fs.statSync(file).size>15000,'Open Sea screenshot missing: '+biome);
  }
  for(const [label,width,height,ua,stage] of [
   ['desktop',1280,720,null,null],
   ['mobile',390,844,'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',null],
   ['ocean-desktop',1280,720,null,'sea'],
   ['ocean-mobile',390,844,'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36','sea'],
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
   if(stage==='sea'){
    assert.equal(Number(page.match(/data-smoke-world-height="([^"]*)"/)?.[1]),21000,label+' must actually run the deep Mar Aberto world');
    const inventoryDiag=(page.match(/data-smoke-inventory-diag="([^"]*)"/)?.[1]||'').replace(/&quot;/g,'"').replace(/&amp;/g,'&');
    assert.equal(page.match(/data-smoke-inventory-active="([^"]*)"/)?.[1],'true',label+' must expose the Mar Aberto inventory; diag='+inventoryDiag);
    assert.equal(page.match(/data-smoke-inventory-open="([^"]*)"/)?.[1],'true',label+' inventory must open through the real UI control');
    assert.equal(Number(page.match(/data-smoke-inventory-slots="([^"]*)"/)?.[1]),30,label+' inventory must render all 30 slots');
    assert.match(page.match(/data-smoke-inventory-selected="([^"]*)"/)?.[1]||'',/PICARETA ABISSAL|CILINDRO VAZIO/i,label+' must expose a valid selected extraction tool');
   }
   if(stage==='deep')assert.ok(depth>130&&depth<300,label+' should be mid-Fossa, depth='+depth);
   if(stage==='boss')assert.ok(depth>=320,label+' should reach boss chamber, depth='+depth);
   console.log('[browser-smoke] '+label+' depth='+depth+' elapsed='+page.match(/data-smoke-elapsed="([^"]*)"/)?.[1]+' worldHeight='+page.match(/data-smoke-world-height="([^"]*)"/)?.[1]+' active='+page.match(/data-smoke-rift-playing="([^"]*)"/)?.[1]);
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
  // Force actual Chromium to paint every curated species and all trap families.
  for(const [label,route,count,width,height] of [
   ['all-species','/__abyss_species__',41,1536,1140],
   ['all-traps','/__abyss_hazards__',12,1920,735]
  ]){
   const pageUrl='http://127.0.0.1:'+server.address().port+route;
   const args=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--no-first-run','--window-size='+width+','+height,'--virtual-time-budget=4000'];
   const dom=await run(browser,[...args,'--dump-dom',pageUrl]);
   const status=dom.match(/data-art-status="([^"]*)"/)?.[1],actual=Number(dom.match(/data-art-count="([^"]*)"/)?.[1]);
   assert.equal(status,'painted',label+' failed art render: '+status);
   assert.equal(actual,count,label+' incomplete coverage');
   const screenshot=path.join(output,label+'.png');
   await run(browser,[...args,'--screenshot='+screenshot,pageUrl]);
   assert.ok(fs.statSync(screenshot).size>20000,label+' visual gallery missing');
   console.log('[browser-smoke] '+label+' rendered '+actual+' scenes, '+fs.statSync(screenshot).size+' bytes');
  }
  await realGameplaySmoke(browser,url);
 }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(err=>{console.error('[browser-smoke] '+err.stack);process.exitCode=1});
