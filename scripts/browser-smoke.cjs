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
// Public release validation follows the currently playable Shooter Solo.
// Frozen game modes can be inspected explicitly with --legacy-modes.
const legacyModes=process.argv.includes('--legacy-modes');
const zlib=require('node:zlib');


/* Decode the actual headless Chrome PNG, not #game (which may be a transparent
 * compositing layer). Fails if the central ocean viewport is almost black.
 * Supports un-interlaced 8-bit RGB/RGBA PNG without third-party dependencies. */
function pngImageLuminance(filename){
 const data=fs.readFileSync(filename);
 assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Invalid Chromium screenshot PNG');
 let pos=8,width=0,height=0,depth=0,color=0,interlace=0;
 const compressed=[];
 while(pos+12<=data.length){
  const len=data.readUInt32BE(pos),tag=data.toString('ascii',pos+4,pos+8),begin=pos+8;
  if(tag==='IHDR'){
   width=data.readUInt32BE(begin);height=data.readUInt32BE(begin+4);
   depth=data[begin+8];color=data[begin+9];interlace=data[begin+12];
  }
  if(tag==='IDAT')compressed.push(data.subarray(begin,begin+len));
  pos=begin+len+4;
  if(tag==='IEND')break;
 }
 assert.ok(width>250&&height>250&&depth===8&&(color===2||color===6)&&interlace===0,
  'Unsupported Chrome screenshot encoding '+JSON.stringify({width,height,depth,color,interlace}));
 const bpp=color===6?4:3,stride=width*bpp;
 const raw=zlib.inflateSync(Buffer.concat(compressed));
 let prev=Buffer.alloc(stride),cursor=0,sum=0,bright=0,total=0;
 const sampleRows=new Set(Array.from({length:8},(_,i)=>Math.round(height*(i+2)/12)));
 const sampleCols=Array.from({length:13},(_,i)=>Math.round(width*(i+3)/18));
 for(let y=0;y<height;y++){
  const filter=raw[cursor++],row=Buffer.allocUnsafe(stride);
  for(let x=0;x<stride;x++){
   const left=x>=bpp?row[x-bpp]:0,up=prev[x],upLeft=x>=bpp?prev[x-bpp]:0;
   let prediction=0;
   if(filter===1)prediction=left;
   else if(filter===2)prediction=up;
   else if(filter===3)prediction=(left+up)>>1;
   else if(filter===4){
    const p=left+up-upLeft,da=Math.abs(p-left),db=Math.abs(p-up),dc=Math.abs(p-upLeft);
    prediction=da<=db&&da<=dc?left:db<=dc?up:upLeft;
   }else if(filter!==0)throw Error('Unsupported PNG filter '+filter);
   row[x]=(raw[cursor++]+prediction)&255;
  }
  if(sampleRows.has(y))for(const col of sampleCols){
   const x=Math.min(width-1,col)*bpp;
   const lum=row[x]*.2126+row[x+1]*.7152+row[x+2]*.0722;
   sum+=lum;total++;if(lum>14)bright++;
  }
  prev=row;
 }
 return {mean:sum/Math.max(1,total),bright,total};
}

const root=path.resolve(__dirname,'../public');
const output=path.resolve(__dirname,'../test-artifacts/browser-smoke');
const contentTypes={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
 '.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.woff':'font/woff','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav'};
const artGallery = "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>html,body{margin:0;min-height:100%;background:#020b13;color:#e5f6fc;font:14px system-ui}main{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px}section{background:radial-gradient(ellipse at center,#142d38,#06131f 72%);border:1px solid #33505a;border-radius:12px;text-align:center;overflow:hidden}canvas{display:block;width:100%;height:274px}h2{font-size:15px;margin:6px 0 8px;font-weight:600;letter-spacing:.04em}</style></head><body><main>\n<section><canvas id=\"gharial\" width=\"402\" height=\"274\"></canvas><h2>Gavial das Águas Negras</h2></section>\n<section><canvas id=\"leatherback\" width=\"402\" height=\"274\"></canvas><h2>Tartaruga-de-Couro</h2></section>\n<section><canvas id=\"hawksbill\" width=\"402\" height=\"274\"></canvas><h2>Tartaruga-de-Pente</h2></section>\n<section><canvas id=\"nightmareBoss\" width=\"402\" height=\"274\"></canvas><h2>Pesadelo Roxo, boss</h2></section>\n<section><canvas id=\"nightmareRelic\" width=\"402\" height=\"274\"></canvas><h2>Vestígio do Pesadelo, loja</h2></section>\n<section><canvas id=\"ribbonmoray\" width=\"402\" height=\"274\"></canvas><h2>Moreia-Fita Noturna</h2></section></main>\n<script src=\"/abyssal-curated-skins.js\"></script><script src=\"/marine-art.js\"></script><script src=\"/abyssal-rift-hardcore.js\"></script>\n<script>try{const catalog=window.AbyssalCuratedSkins.byId;for(const id of ['gharial','leatherback','hawksbill','ribbonmoray']){const canvas=document.getElementById(id),ctx=canvas.getContext('2d');ctx.lineCap='round';ctx.lineJoin='round';window.AbyssalMarineArt.draw(ctx,id==='ribbonmoray'?265:220,132,id==='ribbonmoray'?44:54,0,catalog[id],1600,false);}window.AbyssalRiftHardcore.drawFinalBoss(document.getElementById('nightmareBoss').getContext('2d'),{x:201,y:140,r:64,hp:100,maxHp:100},1600);window.AbyssalRiftHardcore.drawNightmareRelic(document.getElementById('nightmareRelic').getContext('2d'),201,137,66,1600);document.body.dataset.artStatus='painted';}catch(error){document.body.dataset.artStatus=String(error);}</script></body></html>";
const localGameSmoke = [
"// Browser smoke only. Injected by its local HTTP server, never committed to public/game.js.",
"window.__abyssalOfferUpgrade=()=>{offerUpgrade();return gameState==='upgrade';};\nwindow.__abyssalMobileLayoutKeepAlive=()=>{if(!player||onlineMode||!isClassicShooterRun())return false;if(gameState==='upgrade'&&upgradeOptions.length)chooseUpgrade(upgradeOptions[0]);if(gameState!=='playing')return false;player.invuln=Math.max(player.invuln||0,120);hp=maxHp;metaUpgrades.pulse=1;metaUpgrades.dash=1;updateAbilityButtons(true);const section=soloSubmarine.sections[1];if(section){section.hp=SOLO_HULL_HP-100;player.x=section.x;player.y=section.y+section.rock.ry+(Number(player.r)||13)+5;updateCamera();updateSoloSubmarineInteraction();}return Boolean(soloRepairCandidate());};",
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
    const ageRange=document.getElementById('ageYearsRange');
    if(ageRange){ageRange.value='27';ageRange.dispatchEvent(new Event('input',{bubbles:true}));}
    else for(const [id,value] of [['ageBirthDay','1'],['ageBirthMonth','1'],['ageBirthYear','1990']]){
     const input=document.getElementById(id);if(input){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}
    }
    const terms=document.getElementById('ageTermsAccept');if(terms)terms.checked=true;
    document.getElementById('ageTermsContinue')?.click();
   },300);
   const stage=new URLSearchParams(location.search).get('stage');
   if(stage==='hub'){setInterval(()=>{const tour=document.getElementById('abyssalMenuTour');if(tour&&!tour.hidden)tour.querySelector('.amt-skip')?.click();},250);}
   else if(stage!=='cockpit'){
    let attempts=0;
    const enter=()=>{
     if(document.body.classList.contains('game-active')){
      const guide=document.getElementById('abyssalTutorialOverlay');if(guide&&!guide.hidden)document.getElementById('abyssalGuideStart')?.click();
      check();return;
     }
     if(++attempts>30)return;
     if(document.getElementById('ageTermsScreen')?.hidden===false||document.documentElement.classList.contains('abyssal-startup')){setTimeout(enter,200);return;}
     if(stage){window.dispatchEvent(new CustomEvent(stage==='sea'?'abyssal-start-open-sea':'abyssal-start-rift-solo'));}
     else if(document.getElementById('submarineWorkshop')?.hidden===false){document.getElementById('cockpitSoloDiveBtn')?.click();}
     else if(document.getElementById('abyssalDiveChoicePanel')?.hidden===false){document.getElementById('abyssDiveSoloChoice')?.click();}
     else document.getElementById('divePortalBtn')?.click();
     setTimeout(enter,250);
    };
    setTimeout(enter,950);
   }
   let inventoryAttempts=0;
   const openSeaInventory=()=>{const q=new URLSearchParams(location.search),stage=q.get('stage');if(stage!=='sea'||q.has('biome'))return;const toggle=document.getElementById('abyssInventoryToggle');const root=document.getElementById('abyssInventoryRoot');if(toggle&&root&&!root.hidden){toggle.click();check();return;}inventoryAttempts++;if(inventoryAttempts<24)setTimeout(openSeaInventory,150);else check();};
   setTimeout(openSeaInventory,2200);
   setTimeout(()=>{const q=new URLSearchParams(location.search),stage=q.get('stage');if(stage==='deep')window.AbyssalGameHooks?.setPlayerPosition?.(2720,4180);if(stage==='boss')window.AbyssalGameHooks?.setPlayerPosition?.(2400,8660);if(stage==='sea'&&q.has('biome')){const spots={coastal:[1580,480],cinematic:[8500,2900],geological:[19000,9000]};const v=spots[q.get('biome')];if(v)window.AbyssalGameHooks?.setPlayerPosition?.(...v);}check()},2550);
   if(new URLSearchParams(location.search).get('stage')==='cockpit'){
    // The first-launch tour is a real modal. Finish it through the same
    // visible control as a player, then wait for the menu to become ready.
    // A fixed click delay races the age gate and startup on slow viewports.
    const enterCabin=()=>{
     const cabin=document.getElementById('submarineWorkshop'),menu=document.getElementById('menuScreen'),button=document.getElementById('submarineWorkshopBtn');
     if(document.body.dataset.cockpitStatus)return;
     const tour=document.getElementById('abyssalMenuTour');
     if(tour&&!tour.hidden){tour.querySelector('.amt-skip')?.click();setTimeout(enterCabin,250);return;}
     const gate=document.getElementById('ageTermsScreen');
     if(gate&&!gate.hidden||document.documentElement.classList.contains('abyssal-startup')||!menu||!button||button.disabled){
      setTimeout(enterCabin,250);return;
     }
     // Headless virtual time can defer the requestAnimationFrame that opens
     // the first-run tour until after the hatch click. Exercise the actual
     // tour and its skip action before entering rather than bypassing it.
     if(!menu.hidden&&localStorage.getItem('abyssalMenuTourV1')!=='1'&&window.AbyssalMenuTour?.open('exterior',true)){
      setTimeout(enterCabin,250);return;
     }
     if(cabin?.hidden&&!menu.hidden&&!document.getElementById('menuOceanStage')?.dataset.abyssTransit)button.click();
     // Keep observing: a startup/tour callback can change the screen again.
     setTimeout(enterCabin,250);
    };
    setTimeout(enterCabin,950);
    setTimeout(()=>{
     try{
      const box=document.getElementById('submarineWorkshop');
      if(!box||box.hidden||document.body.classList.contains('abyssal-menu-tour-open'))throw Error('Hatch did not open cockpit '+JSON.stringify({menuHidden:document.getElementById('menuScreen')?.hidden,menuClass:document.getElementById('menuScreen')?.className,stageTransit:document.getElementById('menuOceanStage')?.dataset.abyssTransit,btn:Boolean(document.getElementById('submarineWorkshopBtn')),btnDisabled:document.getElementById('submarineWorkshopBtn')?.disabled,body:document.body.className,guideHidden:document.getElementById('abyssalGuide')?.hidden,workshopAPI:Boolean(window.AbyssalSubmarineCockpit),blockers:[...document.querySelectorAll('.modal-screen,.modal-overlay,#abyssDescentPanel,#abyssalDiveChoicePanel')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden').slice(0,8).map(el=>el.id)}));
      const canvas=document.getElementById('abyssCockpitCanvas');
      if(!canvas||canvas.width<300||canvas.height<250)throw Error('Cockpit canvas not painted');
      const art=window.AbyssalSubmarineCockpit?.visualStatus?.();
      if(!art?.rendered||!art.original||!art.liveOcean||art.bitmapBackdrop)throw Error('Original animated bridge did not render');
      document.body.dataset.cockpitArt=art.original+','+art.liveOcean+','+art.mode;
      const keys=[...box.querySelectorAll('.abyss-control-key')];
      if(keys.length!==4)throw Error('Physical control keys: '+keys.length);
      for(const id of ['solo','research','shop','specimens'])if(!box.querySelector('.abyss-control-'+id))throw Error('Missing current cockpit control '+id);
      box.querySelector('.abyss-control-research').click();
      const research=box.querySelector('.abyss-tree-map'),nodes=research?.querySelectorAll('.abyss-tree-node')||[];
      if(nodes.length<5||!research.querySelector('[data-research-id="pulse"]')||!research.querySelector('[data-research-id="dash"]'))throw Error('Diver research Q/E or lamp nodes missing');
      const cards=nodes.length,icons=research.querySelectorAll('.abyss-tree-node-icon').length;
      if(cards!==icons||[...nodes].some(n=>!n.querySelector('svg')||n.textContent.trim()))throw Error('Missing icon-only research nodes');
      const pulse=research.querySelector('[data-research-id="pulse"]'),dash=research.querySelector('[data-research-id="dash"]');pulse.click();dash.dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));dash.focus();if(pulse.getAttribute('aria-pressed')!=='true'||!box.querySelector('.abyss-tree-detail-title')?.textContent.includes('Pulso de Maré'))throw Error('Research selection changed without click');dash.click();if(dash.getAttribute('aria-pressed')!=='true'||!box.querySelector('.abyss-tree-detail-title')?.textContent.includes('Propulsor Abissal'))throw Error('Research selection did not change on click');
      const monitor=box.querySelector('.abyss-cockpit-visor'),deck=box.querySelector('.abyss-control-deck');
      const monitorRect=monitor?.getBoundingClientRect(),deckRect=deck?.getBoundingClientRect();
      const currentKeys=[...box.querySelectorAll('.abyss-control-key')],keyRects=currentKeys.map(key=>key.getBoundingClientRect());
      const handheld=document.documentElement.classList.contains('abyssal-handheld');
      if(handheld){const back=box.querySelector('.mobile-cockpit-back'),r=back?.getBoundingClientRect();if(!r||r.width<40||r.height<40||monitorRect.height<150)throw Error('Mobile expanded visor or back action missing');}
      else{
      if(currentKeys.length!==4||keyRects.some(r=>r.width<25||r.height<25))throw Error('Cockpit hardware buttons are hidden or detached');
      if(!monitorRect||!deckRect)throw Error('Cockpit monitor/deck missing');
      if(deckRect.top<monitorRect.bottom-4)throw Error('Console deck overlaps monitor or sits alongside it');
      if(Math.abs(deckRect.left-monitorRect.left)>8||Math.abs(deckRect.width-monitorRect.width)>18)throw Error('Console keys are not aligned with the main monitor');
      if(keyRects.some(r=>r.height>(innerWidth>700?100:72)))throw Error('Oversized vertically stretched console key');
      if(monitorRect.height<deckRect.height*1.5)throw Error('The central monitor must dominate the physical key deck');
      if(monitorRect.width<210||monitorRect.height<(innerWidth>700?180:150))throw Error('Central cockpit display is too small');
      }
      document.body.dataset.cockpitLayout=JSON.stringify({visor:[Math.round(monitorRect.width),Math.round(monitorRect.height)],keys:[Math.round(deckRect.width),Math.round(deckRect.height)],keyHeight:Math.round(keyRects[0].height)});
      const view=new URLSearchParams(location.search).get('view')||'solo';
      if(view==='wardrobe'){
       if(!handheld)throw Error('Wardrobe mobile smoke must use handheld UA');
       box.querySelector('.mobile-cockpit-back').click();
       box.querySelector('[data-cockpit-setting="wardrobe"]').click();
       const wardrobe=box.querySelector('.abyss-wardrobe'),stage=wardrobe?.querySelector('.aw-canvas'),panel=wardrobe?.querySelector('.aw-panel'),save=wardrobe?.querySelector('.aw-primary'),choice=wardrobe?.querySelector('.aw-option');
       if(!wardrobe||!stage||!panel||!save||!choice)throw Error('Wardrobe controls missing');
       const a=stage.getBoundingClientRect(),b=panel.getBoundingClientRect(),c=save.getBoundingClientRect();
       if(a.width<80||a.height<60||b.width<120||b.height<80||c.height<40)throw Error('Preview/catalog/save clipped '+JSON.stringify({a:a.toJSON(),b:b.toJSON(),c:c.toJSON()}));
       if(a.right>innerWidth+1||b.right>innerWidth+1||c.bottom>innerHeight+1)throw Error('Wardrobe extends outside viewport');
       choice.click();if(choice.getAttribute('aria-pressed')!=='true')throw Error('Cosmetic selection failed');
       const horizontal=document.documentElement.classList.contains('abyssal-handheld-landscape');
       if(horizontal&&a.right>b.left+2||!horizontal&&a.bottom>b.top+2)throw Error('Wardrobe preview and catalog overlap');
      }else if(view==='shop'){
       box.querySelector('.abyss-control-shop').click();
       const shop=document.getElementById('shopScreen'),grid=shop.querySelector('#skinGrid');
       if(shop.hidden||!shop.classList.contains('abyss-cockpit-embedded')||grid.querySelectorAll('.skin-card[data-skin-id]').length<50)throw Error('Embedded specimen shop missing real cards');
       if(shop.querySelectorAll('input[type=search]').length!==1||!shop.querySelector('#shopHabitatFilter'))throw Error('Duplicate shop search or habitat filter missing');
       const search=shop.querySelector('#shopSearchInput');search.value='Carcereiro';search.dispatchEvent(new Event('input'));
       if(grid.querySelectorAll('.skin-card').length!==1||grid.querySelector('.skin-card')?.dataset.skinId!=='deepwarden')throw Error('Shop search or stable ID mismatch');
       search.value='';search.dispatchEvent(new Event('input'));
       const filter=shop.querySelector('#shopFamilyFilter');filter.value='legendary';filter.dispatchEvent(new Event('change'));
       if([...grid.querySelectorAll('.skin-card')].some(card=>card.dataset.rarity!=='legendary'))throw Error('Rarity filter did not match actual rarity');
       filter.value='all';filter.dispatchEvent(new Event('change'));
      }else if(view==='specimens'){
       box.querySelector('.abyss-control-specimens').click();
       if(document.getElementById('catalogScreen').hidden||document.querySelectorAll('#catalogGrid .specimen-journal-entry').length<50)throw Error('Embedded Abyssario missing entries');
      }else if(view==='resonance'){
       const btn=[...box.querySelectorAll('.solo-research-tabs button')].find(b=>b.textContent==='RESSONÂNCIA');if(!btn)throw Error('Resonance access missing');btn.click();
       if(document.getElementById('resonanceScreen').hidden||!box.querySelector('#resonanceScreen'))throw Error('Resonance panel not integrated');
       const fusion=box.querySelector('#resonanceFusionGuide'),icons=[...fusion.querySelectorAll('[data-fusion-id]')],details=fusion.querySelector('.resonance-fusion-detail');
       if(icons.length!==7||icons.some(n=>!n.querySelector('svg')||n.textContent.trim())||!details.hidden)throw Error('Fusion icon-only menu or initial hidden detail missing');
       icons[0].click();icons[1].dispatchEvent(new PointerEvent('pointerenter',{pointerType:'mouse'}));if(details.hidden||icons[0].getAttribute('aria-pressed')!=='true'||!details.textContent.includes('0,52'))throw Error('Fusion selection or effect text missing');icons[1].click();if(icons[1].getAttribute('aria-pressed')!=='true'||!details.textContent.includes('8 inimigos'))throw Error('Fusion detail did not follow explicit click');
       for(const id of ['magnet','magneticField','petAttack','petLife','petSpeed','petCadence'])if(!box.querySelector('[data-research-id="'+id+'"] svg'))throw Error('Missing specimen resonance icon '+id);
       const realBase=window.AbyssalSoloBase,firstNine=['photon','range','regen','magnet','petAttack','petLife','petSpeed','petCadence','power'];
       window.AbyssalSoloBase=realBase.create({getItem:()=>JSON.stringify({unlocked:[...firstNine,'magneticField','rate','electric']}),setItem:()=>{}});
       try{
        window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:{resonancePresets:{pve:[...firstNine,'ward'],pvp:[]}}}));
        const count=()=>document.getElementById('resonanceSelectionCount').textContent;
        const pick=id=>{const node=box.querySelector('#resonanceSkillChoices [data-research-id="'+id+'"]');if(!node)throw Error('Missing slot '+id);node.click();box.querySelector('#resonanceSkillChoices .abyss-tree-action').click();};
        if(!count().endsWith('9/10'))throw Error('Unavailable research must not consume a visible slot: '+count());
        pick('magneticField');if(!count().endsWith('10/10'))throw Error('Tenth researched skill must fit: '+count());
        const saved=()=>JSON.parse(localStorage.getItem('abyssalResonancePresets')).pve;
        if(saved().length!==10||!saved().includes('magneticField')||saved().includes('ward'))throw Error('Tenth slot was not persisted');
        pick('rate');if(!count().endsWith('10/10')||saved().includes('rate'))throw Error('Eleventh skill must be rejected');
        pick('electric');if(!count().endsWith('10/10')||!saved().includes('electric')||saved().includes('photon'))throw Error('Shot replacement must preserve ten slots');
        document.getElementById('saveResonanceBtn').click();if(realBase.normalizePresets({pve:saved()}).pve.length!==10)throw Error('Server roundtrip must preserve all ten slots');
       }finally{window.AbyssalSoloBase=realBase;}

      }else if(view==='upgrades'){
       const btn=[...box.querySelectorAll('.solo-research-tabs button')].find(b=>b.textContent==='SUBMARINO');if(!btn)throw Error('Submarine research access missing');btn.click();
       if(!box.querySelector('.abyss-tree-map [data-research-id="submarineShield"]'))throw Error('Submarine research missing');
      }else{
       box.querySelector('.abyss-control-solo').click();
       if(!box.querySelector('#cockpitSoloDiveBtn')||!box.querySelector('#cockpitOnlineDiveBtn'))throw Error('Default cockpit launch action is missing');
      }
      document.body.dataset.cockpitStatus='ok';
      document.body.dataset.cockpitCards=cards;
      document.body.dataset.cockpitIcons=icons;
     }catch(error){
      document.body.dataset.cockpitStatus='error';
      document.body.dataset.cockpitError=(String(error)+' | Runtime: '+errors.slice(0,4).join(' | ')).slice(0,1800);
     }
    },8500);
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
  if(smoke){
   let html=data.toString('utf8');
   if(legacyModes){
    const gateScript='<script src="abyssal-feature-gates.js';
    assert.ok(html.includes(gateScript),'Local QA could not locate the feature gate');
    // The fixture opts into legacy modes BEFORE the live feature gate loads.
    // Regular localhost players never receive this explicit QA marker.
    html=html.replace(gateScript,'<script>window.__ABYSSAL_CI_SMOKE__=true;</script>'+String.fromCharCode(10)+gateScript);
   }
   data=Buffer.from(html.replace('</body>',injected+'</body>'));
  }
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
async function realGameplaySmoke(browser,url,mode='legacy'){
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
  if(mode==='mobile-wardrobe'||mode==='mobile-gameplay'||mode==='mobile-hub'||mode==='mobile-profile'){
   if(mode==='mobile-gameplay'||mode==='mobile-wardrobe')await command('Page.addScriptToEvaluateOnNewDocument',{source:"try{localStorage.setItem('abyssalControlsMobile','dual-stick')}catch(e){}"});
   await command('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36'});
   await command('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
   await command('Emulation.setDeviceMetricsOverride',{width:360,height:640,deviceScaleFactor:2,mobile:true,screenOrientation:{type:'portraitPrimary',angle:0}});
  }
  await command('Page.navigate',{url});
  await sleep(6500);
  const auditControls=async(selectors,required,forceVisible=[])=>evaluate(`(async()=>{const selectors=${JSON.stringify(selectors)},required=${JSON.stringify(required)},forceVisible=${JSON.stringify(forceVisible)},saved=[];try{
   for(const selector of forceVisible){const e=document.querySelector(selector);if(e){saved.push([e,e.hidden,e.className]);e.hidden=false;if(e.id==='mobileAimStick')e.classList.add('dual-stick-visible');}}
   window.AbyssalHudLayout?.refresh();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const result=[],missing=[],collisions=[],blocked=[],raw=[];
   const clip=(e,r)=>{let b={left:Math.max(0,r.left),top:Math.max(0,r.top),right:Math.min(innerWidth,r.right),bottom:Math.min(innerHeight,r.bottom)};if(getComputedStyle(e).position==='fixed')return b;for(let p=e.parentElement;p;p=p.parentElement){const c=getComputedStyle(p),q=p.getBoundingClientRect();if(/hidden|clip|auto|scroll/.test(c.overflowX)){b.left=Math.max(b.left,q.left);b.right=Math.min(b.right,q.right);}if(/hidden|clip|auto|scroll/.test(c.overflowY)){b.top=Math.max(b.top,q.top);b.bottom=Math.min(b.bottom,q.bottom);}if(c.position==='fixed')break;}return b;};
   for(const selector of selectors){for(const e of document.querySelectorAll(selector)){const c=getComputedStyle(e),r=e.getBoundingClientRect();raw.push({selector,display:c.display,visibility:c.visibility,position:c.position,hidden:e.closest('[hidden]')?.id||null,rect:[r.left,r.top,r.width,r.height]});if(c.display==='none'||c.visibility==='hidden'||r.width<1||r.height<1||e.closest('[hidden]'))continue;const q=clip(e,r),w=q.right-q.left,h=q.bottom-q.top;if(w<=1||h<=1)continue;const name=e.id||e.getAttribute('aria-label')||e.textContent.trim().slice(0,42)||selector;result.push({selector,name,...q,w,h,rawW:r.width,rawH:r.height});if(required.includes(selector)){if(w<44||h<44||w<r.width-2||h<r.height-2)missing.push(name+' clipped '+w+'x'+h);const at=document.elementFromPoint((q.left+q.right)/2,(q.top+q.bottom)/2);if(!at||!e.contains(at))blocked.push(name+' blocked by '+(at?.id||at?.className||at?.tagName||'outside viewport'));}}}
   for(const selector of required)if(!result.some(x=>x.selector===selector))missing.push(selector+' missing');
   for(let i=0;i<result.length;i++)for(let j=i+1;j<result.length;j++){const a=result[i],b=result[j],w=Math.min(a.right,b.right)-Math.max(a.left,b.left),h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);if(w>2&&h>2)collisions.push(a.name+' / '+b.name+' '+Math.round(w)+'x'+Math.round(h));}
   return {count:result.length,missing,collisions,blocked,controls:result,diagnostics:missing.length?{w:innerWidth,h:innerHeight,html:document.documentElement.className,body:document.body.className,raw}:undefined};
  }finally{for(const [e,hidden,cls] of saved){e.hidden=hidden;e.className=cls;}}})()`);
  const assertAudit=(name,a)=>{console.log('[mobile-control-audit] '+name+' '+JSON.stringify(a));assert.deepEqual(a.missing,[],name+' clipped or missing controls');assert.deepEqual(a.collisions,[],name+' overlapping controls');assert.deepEqual(a.blocked,[],name+' blocked controls');};
  if(mode==='desktop-profile'||mode==='mobile-profile'){
   await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
   const mobile=mode==='mobile-profile';
   const open=async()=>{await evaluate("window.AbyssalOnline.openProfile()");await sleep(500);};
   const fixture=()=>evaluate(`(()=>{window.dispatchEvent(new CustomEvent('abyssal-account-data',{detail:{nickname:'MergulhadorDasProfundezas',equippedTitle:'abyss-stalker',unlockedTitles:['abyss-stalker'],equippedSkin:'default',diverGender:'male'}}));document.getElementById('publicProfileActions').hidden=false;return document.getElementById('profileNickname').textContent;})()`);
   const geometry=()=>evaluate(`(()=>{const e=id=>document.getElementById(id),r=n=>n.getBoundingClientRect().toJSON(),p=e('profileScreen'),hero=p.querySelector('.profile-hero'),identity=p.querySelector('.profile-identity'),name=e('profileNickname'),title=e('profileEquippedLabel'),actions=e('publicProfileActions'),panel=p.querySelector('.profile-specimen-panel'),canvas=e('profileSpecimenCanvas');return {hidden:p.hidden,embedded:p.classList.contains('abyss-cockpit-embedded'),hero:r(hero),identity:r(identity),name:r(name),title:r(title),actions:r(actions),panel:r(panel),canvas:r(canvas),panelScroll:panel.scrollWidth,panelWidth:panel.clientWidth,writing:getComputedStyle(name).writingMode,nameText:name.textContent,titleText:title.textContent,line:parseFloat(getComputedStyle(name).lineHeight),errors:document.body.dataset.smokeError};})()`);
   // Compare the lower-left diver pixels, excluding the separately animated specimen.
   const frame=()=>evaluate(`(()=>{const c=document.getElementById('profileSpecimenCanvas'),x=Math.floor(c.width*.05),y=Math.floor(c.height*.43),w=Math.floor(c.width*.44),h=Math.floor(c.height*.54),a=c.getContext('2d').getImageData(x,y,w,h).data;let hash=2166136261,bright=0;for(let i=0;i<a.length;i+=4){hash=Math.imul(hash^a[i]^a[i+1]*257^a[i+2]*65537,16777619);if(a[i]+a[i+1]+a[i+2]>140&&a[i+3]>40)bright++;}return {hash,bright,w,h};})()`);
   for(const [w,h] of (mobile?[[390,844],[320,568],[844,390]]:[[1280,720],[900,600]])){
    await command('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:mobile?2:1,mobile,screenOrientation:{type:w>h?'landscapePrimary':'portraitPrimary',angle:w>h?90:0}});
    await open();await fixture();await evaluate("document.querySelector('#profileScreen .profile-hero').scrollIntoView({block:'start'})");await sleep(350);
    const a=await geometry();await screenshot(mode+'-header-'+w+'x'+h);
    assert.ok(!a.hidden&&a.identity.width>=100&&a.name.width>=100&&a.name.height<=a.line*4+2&&a.writing==='horizontal-tb'&&a.title.height<100&&a.name.top>=0&&a.title.bottom<=h&&a.actions.top>=a.identity.bottom-1&&a.panelScroll<=a.panelWidth+2&&a.nameText==='MergulhadorDasProfundezas'&&a.titleText.includes('Perseguidor de Leviatãs'),'Profile text/grid regression: '+JSON.stringify(a));
    await evaluate("document.getElementById('profileSpecimenCanvas').scrollIntoView({block:'center'})");await sleep(200);
    const first=await frame();await screenshot(mode+'-swim-a-'+w+'x'+h);await sleep(300);const second=await frame();await screenshot(mode+'-swim-b-'+w+'x'+h);
    console.log('[profile-swim] '+JSON.stringify({w,h,a,first,second}));
    assert.ok(first.bright>20&&second.bright>20&&first.hash!==second.hash,'Diver must visibly animate, not only the specimen: '+JSON.stringify({first,second}));
    await evaluate("document.getElementById('profileCloseBtn').click()");await sleep(150);
   }
   if(!mobile){
    await evaluate("window.AbyssalCockpitNavigation.open()");await sleep(400);await open();await fixture();await sleep(300);
    const a=await geometry();await screenshot('desktop-profile-cockpit');assert.ok(a.embedded&&a.identity.width>=100&&a.panelScroll<=a.panelWidth+2,'Embedded profile geometry: '+JSON.stringify(a));
    const first=await frame();await sleep(300);const second=await frame();assert.notEqual(first.hash,second.hash,'Embedded desktop profile must resume swimming');
    // Windows/browser reduced-motion must tone down, not freeze, the requested swimming pose.
    await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await evaluate("document.getElementById('profileSpecimenCanvas').scrollIntoView({block:'center'})");await sleep(300);
    const gentleA=await frame();await screenshot('desktop-profile-reduced-swim-a');await sleep(450);const gentleB=await frame();await screenshot('desktop-profile-reduced-swim-b');
    assert.ok(gentleA.bright>20&&gentleB.bright>20&&gentleA.hash!==gentleB.hash,'Reduced motion must retain a subtle diver fin kick: '+JSON.stringify({gentleA,gentleB}));
    console.log('[profile-reduced-swim] '+JSON.stringify({gentleA,gentleB}));
   }
   return;
  }
  if(mode==='mobile-hub'){
   for(const [w,h] of [[360,640],[844,390],[360,640],[320,568]]){await command('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:2,mobile:true,screenOrientation:{type:w>h?'landscapePrimary':'portraitPrimary',angle:w>h?90:0}});await sleep(600);
    const m=await evaluate(`(()=>{const menu=document.getElementById('menuScreen'),hub=menu.querySelector('.hub-shell'),stage=document.getElementById('menuOceanStage'),r=menu.getBoundingClientRect(),s=stage.getBoundingClientRect(),u=hub.getBoundingClientRect(),launch=document.getElementById('divePortalBtn').getBoundingClientRect();return {w:innerWidth,h:innerHeight,hidden:menu.hidden,menu:r.toJSON(),stage:s.toJSON(),hub:u.toJSON(),launch:launch.toJSON(),scrollWidth:hub.scrollWidth,clientWidth:hub.clientWidth,landscape:document.documentElement.classList.contains('abyssal-handheld-landscape'),canvas:document.getElementById('menuOceanScenery').width};})()`);console.log('[mobile-hub-rotation] '+JSON.stringify(m));assert.ok(!m.hidden&&m.landscape===(w>h)&&Math.abs(m.menu.width-w)<2&&Math.abs(m.menu.height-h)<2&&Math.abs(m.menu.left)<2&&Math.abs(m.menu.top)<2&&m.scrollWidth<=m.clientWidth+2&&m.launch.width>100&&m.launch.left>=0&&m.launch.right<=w+1&&m.canvas>0,'Initial hub clipped after rotation: '+JSON.stringify(m));await screenshot('mobile-hub-'+w+'x'+h);
   }return;
  }
  if(mode==='mobile-wardrobe'){
   for(let attempt=0;attempt<10;attempt++){if(await evaluate('document.body.dataset.cockpitStatus==="ok"'))break;await sleep(500);}
   assert.equal(await evaluate('document.body.dataset.cockpitStatus'), 'ok', await evaluate('document.body.dataset.cockpitError'));
   const rects=()=>evaluate(`(()=>{const root=document.querySelector('#submarineWorkshop .abyss-wardrobe'),box=s=>{const r=root.querySelector(s).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return {w:innerWidth,h:innerHeight,mobile:document.documentElement.classList.contains('abyssal-handheld'),landscape:document.documentElement.classList.contains('abyssal-handheld-landscape'),stage:box('.aw-canvas'),panel:box('.aw-panel'),save:box('.aw-primary'),scrollable:root.querySelector('.aw-panel').scrollHeight>root.querySelector('.aw-panel').clientHeight,choices:root.querySelectorAll('.aw-option').length,nav:box('.aw-groups'),categories:root.querySelectorAll('.aw-group').length};})()`);
   for(const [w,h] of [[360,640],[320,568],[640,360],[844,390],[360,640]]){
    await command('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:2,mobile:true,screenOrientation:{type:w>h?'landscapePrimary':'portraitPrimary',angle:w>h?90:0}});
    await sleep(450);
    const m=await rects();console.log('[exact-mobile-wardrobe] '+JSON.stringify(m));await screenshot('wardrobe-before-assert-'+w+'x'+h);
    assert.equal(m.w,w,'Actual CSS viewport width');assert.equal(m.h,h,'Actual CSS viewport height');
    assert.equal(m.mobile,true);assert.equal(m.landscape,w>h);
    assert.ok(m.stage.width>=80&&m.stage.height>=60&&m.panel.width>=120&&m.panel.height>=80&&m.save.height>=40,'Preview, catalog or save clipped: '+JSON.stringify(m));
    for(const part of [m.stage,m.panel,m.save])assert.ok(part.left>=-1&&part.right<=w+1&&part.top>=-1&&part.bottom<=h+1,'Wardrobe outside real viewport: '+JSON.stringify(m));
    assert.ok(w>h?m.stage.right<=m.panel.left+2:m.stage.bottom<=m.panel.top+2,'Preview overlaps catalog');
    assert.ok(m.choices>0&&m.categories===6,'Missing cosmetic categories');assert.ok(m.nav.width>=55&&m.nav.left>=0&&m.nav.right<=m.panel.left+2&&m.nav.height>=80,'Category rail clipped: '+JSON.stringify(m));
    const selectors=['.aw-mobile-gender','.aw-mobile-view','.aw-group','.aw-categories button','.aw-primary','.aw-secondary','.aw-buy','.aw-option','.aw-search-input'];
    // Catalog content may scroll; its items must not overlap other visible controls.
    assertAudit('wardrobe '+w+'x'+h,await auditControls(selectors,selectors.slice(0,2).concat(['.aw-primary','.aw-secondary'])));
    if(w===360&&h===640&&!await evaluate("document.body.dataset.wardrobeInitialCaptured==='true'")){await screenshot('wardrobe-initial-360x640');await evaluate("document.body.dataset.wardrobeInitialCaptured='true'");}await screenshot('exact-mobile-wardrobe-'+w+'x'+h);
    await evaluate("(()=>{const p=document.querySelector('.abyss-wardrobe');p.querySelector('[data-group=fins]').click();if(p.querySelector('.aw-choices').dataset.category!=='fins')throw Error('Direct fins navigation failed');p.querySelector('[data-item=medusa]').click();if(p.querySelector('.aw-buy').hidden||!p.querySelector('.aw-buy').textContent.includes('2.999'))throw Error('Pinned energy purchase missing');if(!p.querySelector('[data-item=medusa]').matches('[aria-pressed=true]'))throw Error('Selection lost');return true})()");await screenshot('wardrobe-fins-before-assert-'+w+'x'+h);const finUi=await evaluate(`(()=>{const p=document.querySelector('.abyss-wardrobe'),nav=p.querySelector('.aw-groups'),a=p.querySelector('.aw-buy').getBoundingClientRect(),f=p.querySelector('.aw-primary').getBoundingClientRect(),rail=[...nav.querySelectorAll('.aw-group span')].map(e=>({text:e.textContent,clipped:e.scrollWidth>e.clientWidth+1}));return {buy:a.toJSON(),save:f.toJSON(),rail}})()`);assert.ok(finUi.buy.width>0&&finUi.buy.height>=40&&finUi.buy.bottom<=h+1&&finUi.save.bottom<=h+1&&!finUi.rail.some(x=>x.clipped),'Pinned purchase and rail text: '+JSON.stringify(finUi));await screenshot('wardrobe-fins-'+w+'x'+h);await evaluate("(()=>{const p=document.querySelector('.abyss-wardrobe');p.querySelector('[data-group=gear]').click();p.querySelector('[data-category=back]').click();if(p.querySelector('.aw-choices').dataset.category!=='back')throw Error('Equipment subcategory navigation failed');p.querySelector('[data-group=suits]').click();return true})()");

   }
   assert.equal(await evaluate(`(()=>{const nav=window.AbyssalCockpitNavigation;if(!nav.routeCommand('hudEditor'))return false;const page=document.querySelector('.hud-editor');if(!page)return false;const choice=page.querySelector('[aria-label="Elemento da interface"]');choice.value='aim';choice.dispatchEvent(new Event('change'));const s=page.querySelector('input[type=range]');s.value='125';s.dispatchEvent(new Event('input'));page.querySelector('.hud-editor-dock .primary-btn').click();const a=JSON.parse(localStorage.getItem('abyssalHudLayoutV1'));return a.portrait.aim.s===1.25&&Object.keys(a.landscape).length===0;})()`),true,'HUD editor must persist mobile scale separately');
   for(let i=0;i<25;i++){if(await evaluate("document.querySelector('.hud-editor-stage').dataset.measured==='true'"))break;await sleep(100);}assert.equal(await evaluate("document.querySelector('.hud-editor-stage').dataset.measured"),'true','HUD preview must measure actual DOM');const previewSize=await evaluate(`(()=>{const p=document.querySelector('.hud-editor'),s=p.querySelector('.hud-editor-stage'),f=s.querySelector('iframe'),r=s.getBoundingClientRect(),fr=f.getBoundingClientRect();return {w:innerWidth,h:innerHeight,stage:r.toJSON(),frame:fr.toJSON(),scale:Number(s.dataset.scale),scene:f.contentDocument.querySelector('#game')?.dataset.scene}})()`);console.log('[hud-full-viewport] '+JSON.stringify(previewSize));await screenshot('hud-editor-viewport-before-assert');assert.ok(Math.abs(previewSize.stage.width-previewSize.w)<1&&Math.abs(previewSize.stage.height-previewSize.h)<1&&Math.abs(previewSize.stage.left)<1&&Math.abs(previewSize.stage.top)<1&&Math.abs(previewSize.frame.width-previewSize.w)<1&&Math.abs(previewSize.frame.height-previewSize.h)<1&&Math.abs(previewSize.scale-1)<.001&&previewSize.scene==='cavern','HUD editor and frame must fill viewport at 1:1: '+JSON.stringify(previewSize));const hudPolish=await evaluate(`(()=>{const p=document.querySelector('.hud-editor'),a=p.querySelector('[data-item="aim"]').getBoundingClientRect(),t=p.querySelector('.hud-editor-context').getBoundingClientRect(),d=p.querySelector('iframe').contentDocument,btn=d.getElementById('skillPulseBtn'),dash=d.getElementById('skillDashBtn');return {selected:a.toJSON(),panel:t.toJSON(),side:p.querySelector('.hud-editor-context').dataset.side,pulseWidth:btn.getBoundingClientRect().width,dashWidth:dash.getBoundingClientRect().width,abilityIcons:!!btn.querySelector('svg')&&!!dash.querySelector('svg'),petCount:d.querySelectorAll('#petHabitBar .pet-habit-actions button').length,petDuplicate:!!d.querySelector('#mobilePetHabit'),icon:!!d.querySelector('#selectedSkillsList .selected-skill-row svg')}})()`);console.log('[hud-polish] '+JSON.stringify(hudPolish));assert.ok(hudPolish.side==='top'&&hudPolish.panel.bottom<=hudPolish.selected.top&&Math.abs(hudPolish.pulseWidth-48)<1&&Math.abs(hudPolish.dashWidth-48)<1&&hudPolish.abilityIcons&&hudPolish.petCount===3&&!hudPolish.petDuplicate&&hudPolish.icon,'Selected control remains visible and preview uses compact ability icons and a single pet group: '+JSON.stringify(hudPolish));const structure=await evaluate(`(()=>{const p=document.querySelector('body > .hud-editor-fullscreen'),s=p.querySelector('.hud-editor-stage'),a=p.querySelector('[data-item="aim"]'),b=p.querySelector('.hud-editor-dock .primary-btn'),r=a.getBoundingClientRect(),br=b.getBoundingClientRect(),cs=getComputedStyle(a),stage=getComputedStyle(s),btn=getComputedStyle(b);return {stage:stage.position,piece:cs.position,transform:cs.transform,button:btn.position,hit:a.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)),saveHit:b.contains(document.elementFromPoint(br.left+br.width/2,br.top+br.height/2)),size:[r.width,r.height],width:innerWidth,height:innerHeight}})()`);console.log('[hud-active-selectors] '+JSON.stringify(structure));assert.ok(structure.stage==='absolute'&&structure.piece==='absolute'&&structure.transform!=='none'&&structure.button==='relative'&&structure.hit&&structure.saveHit&&structure.size.every(n=>n>0),'HUD active selectors and real hit targets: '+JSON.stringify(structure));await screenshot('mobile-hud-editor-solo');await evaluate(`(()=>{const p=document.querySelector('.hud-editor');p.querySelector('.hud-editor-dock-row button:nth-child(3)').click();})()`);await screenshot('mobile-hud-editor-clean-preview');await evaluate(`(()=>{document.querySelector('.hud-editor-dock-row button:nth-child(3)').click();})()`);
   const compactHud=await evaluate(`(()=>{const p=document.querySelector('.hud-editor'),d=p.querySelector('iframe').contentDocument,btn=d.getElementById('skillPulseBtn'),api=window.AbyssalHudLayout;api.renderAbilityButton(btn,{icon:'pulse',key:'Q',label:'Pulso',seconds:4.2});const countdown=btn.querySelector('.ability-timer').textContent==='4.2s'&&btn.querySelector('.ability-glyph').hidden;api.renderAbilityButton(btn,{icon:'pulse',key:'Q',label:'Pulso',seconds:0});const ready=!btn.querySelector('.ability-glyph').hidden&&btn.querySelector('.ability-timer').hidden&&!!btn.querySelector('svg');const group=d.querySelector('#petHabitBar .pet-habit-actions'),piece=p.querySelector('[data-item="pet"]'),before=group.getBoundingClientRect(),child=group.firstElementChild.getBoundingClientRect();piece.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));const after=group.getBoundingClientRect(),next=group.firstElementChild.getBoundingClientRect();return {countdown,ready,groupDelta:after.top-before.top,childDelta:next.top-child.top,frame:getComputedStyle(group).borderStyle};})()`);await screenshot('hud-compact-icons-pet-moved');assert.ok(compactHud.countdown&&compactHud.ready&&Math.abs(compactHud.groupDelta)>1&&Math.abs(compactHud.groupDelta-compactHud.childDelta)<1&&compactHud.frame==='solid','Cooldown and unified movable pet frame: '+JSON.stringify(compactHud));
   const regressionSelectors=[[".hud-editor-fullscreen .hud-editor-stage",".hud-editor-fullscreen .hud-editor-stage .hud-editor-stage"],[".hud-editor-fullscreen .hud-editor-piece",".hud-editor-fullscreen .hud-editor-piece .hud-editor-piece"],[".hud-editor-fullscreen :is(.hud-editor-dock,.hud-editor-context) button",".hud-editor-fullscreen :is(.hud-editor-dock,.hud-editor-context) button :is(.hud-editor-dock,.hud-editor-context) button"]];
   try {await evaluate(`(()=>{const pairs=${JSON.stringify(regressionSelectors)},sheet=[...document.styleSheets].find(s=>s.href?.includes('abyssal-hud-editor.css'));if(!sheet)throw Error('HUD stylesheet missing');for(const [good,bad] of pairs){const r=[...sheet.cssRules].find(r=>r.selectorText?.replaceAll(', ',',')===good);if(!r)throw Error('Missing active selector '+good);r.selectorText=bad;}return true;})()`);await sleep(200);await screenshot('hud-regression-3.6.115-reproduced');const broken=await evaluate(`(()=>{const s=document.querySelector('.hud-editor-stage');return {height:s.getBoundingClientRect().height,scale:Number(s.dataset.scale),viewport:innerHeight}})()`);console.log('[hud-regression-reproduced] '+JSON.stringify(broken));assert.ok(broken.height<broken.viewport*.5,'Regression reproduction should collapse old stage');} finally {await evaluate(`(()=>{const pairs=${JSON.stringify(regressionSelectors)},sheet=[...document.styleSheets].find(s=>s.href?.includes('abyssal-hud-editor.css'));for(const [good,bad] of pairs){const r=[...sheet.cssRules].find(r=>r.selectorText?.replaceAll(', ',',')===bad);if(r)r.selectorText=good;}return true;})()`);await sleep(200);}
   const restored=await evaluate(`(()=>{const s=document.querySelector('.hud-editor-stage'),r=s.getBoundingClientRect();return {w:r.width,h:r.height,scale:Number(s.dataset.scale),vw:innerWidth,vh:innerHeight}})()`);assert.ok(Math.abs(restored.w-restored.vw)<1&&Math.abs(restored.h-restored.vh)<1&&Math.abs(restored.scale-1)<.001,'HUD restored after test-only reproduction: '+JSON.stringify(restored));await screenshot('hud-regression-3.6.116-corrected');

   assert.equal(await evaluate(`(()=>{const p=document.querySelector('.hud-editor'),m=p.querySelector('[aria-label="Modo de jogo"]');const solo=[...p.querySelectorAll('.hud-editor-piece')].map(e=>e.dataset.item);m.value='online';m.dispatchEvent(new Event('change'));const online=[...p.querySelectorAll('.hud-editor-piece')].map(e=>e.dataset.item);return !solo.includes('comms')&&online.includes('comms')&&!online.includes('oxygen')&&!online.includes('sonar')&&m.options.length===2;})()`),true,'Only released mode HUD controls');for(let i=0;i<25;i++){if(await evaluate("document.querySelector('.hud-editor-stage').dataset.measured==='true'"))break;await sleep(100);}await screenshot('mobile-hud-editor-online');
   for(const [w,h] of [[320,568],[390,844],[844,390],[360,640]]){await command('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:2,mobile:true,screenOrientation:{type:w>h?'landscapePrimary':'portraitPrimary',angle:w>h?90:0}});await sleep(350);for(let i=0;i<25;i++){if(await evaluate(`(()=>{const s=document.querySelector('.hud-editor-stage'),r=s?.querySelector('iframe')?.getBoundingClientRect();return s?.dataset.measured==='true'&&Math.abs(r?.width-innerWidth)<1&&Math.abs(r?.height-innerHeight)<1})()`))break;await sleep(100);}const a=await evaluate(`(()=>{const p=document.querySelector('.hud-editor'),s=p.querySelector('.hud-editor-stage'),r=s.getBoundingClientRect(),f=s.querySelector('iframe').getBoundingClientRect();return {w:innerWidth,h:innerHeight,stage:r.toJSON(),frame:f.toJSON(),scale:Number(s.dataset.scale),profile:s.dataset.profile}})()`);console.log('[hud-viewport-rotation] '+JSON.stringify(a));assert.ok(Math.abs(a.stage.width-w)<1&&Math.abs(a.stage.height-h)<1&&Math.abs(a.frame.width-w)<1&&Math.abs(a.frame.height-h)<1&&Math.abs(a.stage.left)<1&&Math.abs(a.stage.top)<1&&Math.abs(a.scale-1)<.001&&a.profile===(w>h?'landscape':'portrait'),'HUD matches rotated device: '+JSON.stringify(a));await screenshot('hud-fullscreen-'+w+'x'+h);}
   await evaluate(`(()=>{const m=document.querySelector('.hud-editor [aria-label="Modo de jogo"]');m.value='solo';m.dispatchEvent(new Event('change'));})()`);
   assert.equal(await evaluate(`(()=>{const page=document.querySelector('.hud-editor');page.querySelector('.hud-editor-settings button').click();page.querySelector('.hud-editor-dock .primary-btn').click();return Object.keys(window.AbyssalHudLayout.get().portrait).length===0&&window.AbyssalHudLayout.getEffective('solo','portrait').health.s===.65;})()`),true,'HUD restore must restore default layout');
   await evaluate(`(()=>{window.AbyssalCockpitNavigation.back();window.AbyssalApplyInstalledAndroid();})()`);await sleep(400);
   const nativeAudit=await evaluate(`(()=>{const strip=document.querySelector('#submarineWorkshop .abyss-cockpit-top-actions'),selectors=['#mobileDownloadTopBtn','#fullscreenBtn','#downloadBtn','#hubFullscreenBtn','[data-cockpit-proxy="mobileDownloadTopBtn"]','[data-cockpit-proxy="fullscreenBtn"]'];const hidden=selectors.map(s=>[s,getComputedStyle(document.querySelector(s)).display]);const r=strip.getBoundingClientRect(),p=strip.closest('.abyss-cockpit-chrome').getBoundingClientRect();return {hidden,centerError:Math.abs((r.left+r.right-p.left-p.right)/2),rect:[r.left,r.right],chrome:[p.left,p.right],expanded:strip.closest('#submarineWorkshop').classList.contains('abyss-visor-expanded'),visible:getComputedStyle(strip).visibility};})()`);console.log('[installed-android] '+JSON.stringify(nativeAudit));assert.ok(nativeAudit.hidden.every(v=>v[1]==='none')&&nativeAudit.centerError<3&&!nativeAudit.expanded&&nativeAudit.visible!=='hidden','Installed Android utilities hidden and cockpit strip centered: '+JSON.stringify(nativeAudit));await screenshot('android-installed-cockpit');
   for(const [w,h] of [[320,568],[640,360],[844,390],[360,640]]){
    await command('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:2,mobile:true,screenOrientation:{type:w>h?'landscapePrimary':'portraitPrimary',angle:w>h?90:0}});await sleep(400);
    const m=await evaluate(`(()=>{const box=document.getElementById('submarineWorkshop'),panel=box.querySelector('.abyss-visor-body'),a=document.getElementById('cockpitSoloDiveBtn').getBoundingClientRect(),b=document.getElementById('cockpitOnlineDiveBtn').getBoundingClientRect(),p=panel.getBoundingClientRect();return {w:innerWidth,h:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,solo:a.toJSON(),online:b.toJSON(),panel:p.toJSON(),landscape:document.documentElement.classList.contains('abyssal-handheld-landscape')}})()`);
    console.log('[compact-cockpit] '+JSON.stringify(m));assert.ok(m.w===w&&m.h===h&&m.scrollWidth<=w+1&&m.scrollHeight<=h+1&&m.landscape===(w>h),'Menu viewport overflows after rotation: '+JSON.stringify(m));assert.ok(m.solo.width>80&&m.online.width>80&&m.solo.left>=m.panel.left-1&&m.online.right<=m.panel.right+1&&m.solo.top>=m.panel.top-1&&m.online.bottom<=m.panel.bottom+1,'Both dive choices must fit the visible visor: '+JSON.stringify(m));const shortcuts=await evaluate(`(()=>{const nav=document.querySelector('#submarineWorkshop .abyss-cockpit-utilities'),r=nav.getBoundingClientRect();return [...nav.querySelectorAll('button')].map(e=>{const b=e.getBoundingClientRect();return {id:e.id,left:b.left,right:b.right,top:b.top,bottom:b.bottom,w:b.width,h:b.height,hit:e.contains(document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)),inRail:b.left>=r.left-1&&b.right<=r.right+1&&b.top>=r.top-1&&b.bottom<=r.bottom+1};});})()`);assert.ok(shortcuts.length===4&&shortcuts.every(x=>x.w>=42&&x.h>=35&&x.left>=0&&x.right<=w+1&&x.top>=0&&x.bottom<=h+1&&x.hit&&x.inRail),'Utility shortcuts must be fully visible and clickable: '+JSON.stringify(shortcuts));for(let i=1;i<shortcuts.length;i++)assert.ok(shortcuts[i].left>=shortcuts[i-1].right-1,'Utility shortcuts must not overlap: '+JSON.stringify(shortcuts));await screenshot('compact-cockpit-'+w+'x'+h);
   }
   return;
  }
  if(mode==='mobile-gameplay'){
   const state=()=>evaluate("({active:document.body.classList.contains('game-active'),paused:window.AbyssalGameHooks?.explorationPosition?.()?.paused,elapsed:window.AbyssalGameHooks?.expeditionState?.()?.elapsed})");
   for(let i=0;i<8;i++){const a=await state();if(a.active&&!a.paused)break;await evaluate("document.querySelector('#upgradeChoices .upgrade-card')?.click()");await sleep(500);}
   assert.equal((await state()).active,true,'Mobile Solo did not enter gameplay');
   const skillRail=await evaluate(`(()=>{const rail=document.getElementById('selectedSkillsPanel'),rows=[...rail.querySelectorAll('.selected-skill-row')];return {width:rail.getBoundingClientRect().width,rows:rows.length,only:rows.every(r=>r.querySelector('svg')&&/^\\d+$/.test(r.textContent.trim())),title:!!rail.querySelector('.selected-skills-title')};})()`);assert.ok(skillRail.width<=49&&skillRail.rows>0&&skillRail.only&&!skillRail.title,'Compact icon-only skill rail: '+JSON.stringify(skillRail));
   const bossHud=await evaluate(`(()=>{const t=document.getElementById('bossProgressionTrack'),b=document.getElementById('trackProgressMeter');return {visible:getComputedStyle(t).display!=='none',steps:t.querySelectorAll('.track-step').length,time:document.getElementById('trackBossTime').textContent,name:document.getElementById('trackBossName').textContent,value:Number(b.getAttribute('aria-valuenow'))};})()`);assert.ok(bossHud.visible&&bossHud.steps===7&&bossHud.name&&bossHud.value>=0&&bossHud.value<=100,'Classic boss progress not rendered: '+JSON.stringify(bossHud));
   const qualityModes=await evaluate(`(()=>{const q=window.AbyssalAdaptivePerformance,h=document.getElementById('hud');const widths=[],states=[];for(const mode of ['0','1','2']){q.setPreference(mode);widths.push(h.getBoundingClientRect().width);states.push(q.snapshot());q.setLevel(0);if(q.snapshot().level!==Number(mode))return {fixed:false,states};}q.setPreference('auto');const auto=q.snapshot();q.setLevel(0);const light=q.snapshot();q.setLevel(2);const ultra=q.snapshot();return {fixed:states.every((s,i)=>s.preference===String(i)&&s.automatic===false&&s.level===i),widths,states,auto,light,ultra,subsystems:window.AbyssalPerformance.snapshot().subsystems};})()`);
   assert.ok(qualityModes.fixed&&qualityModes.auto.automatic&&qualityModes.auto.preference==='auto'&&qualityModes.light.level===0&&qualityModes.ultra.level===2&&qualityModes.light.dpr<qualityModes.ultra.dpr&&qualityModes.widths.every(w=>Math.abs(w-qualityModes.widths[0])<1)&&!qualityModes.subsystems.sonarPolling&&!qualityModes.subsystems.openSea&&!qualityModes.subsystems.rift,'Fixed/automatic graphics and active-mode isolation: '+JSON.stringify(qualityModes));
   assert.equal(await evaluate('window.__abyssalMobileLayoutKeepAlive?.()'),true,'Mobile layout fixture could not keep active Solo alive');
   const required=['#mobilePauseBtn','#toggleHudBtn','#petHabitBar [data-pet-habit]','#skillPulseBtn','#skillDashBtn','#skinActiveBtn','#mobileAimStick','#mobileFireBtn','#soloSubmarineRepairBtn','#soloSubmarinePowerBtn'];
   for(const [w,h] of [[320,568],[360,640],[640,360],[844,390]]){
    await command('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:2,mobile:true,screenOrientation:{type:w>h?'landscapePrimary':'portraitPrimary',angle:w>h?90:0}});
    await sleep(400);
    // Exercise all optional actions at once, including contextual submarine actions
    // and the Online emoji button, without modifying simulation or unlocks.
    const active=await state();assert.equal(active.active,true,'Gameplay ended during viewport rotation '+JSON.stringify(active));
    assert.equal(await evaluate('window.__abyssalMobileLayoutKeepAlive?.()'),true,'Mobile game not playing after rotation '+JSON.stringify(active));
    const all=await auditControls([...required,'#hud .hud-top','#hud .bar-label','#hud .bar','#hud .solo-energy-stock','#bossProgressionTrack','#selectedSkillsPanel','#runEnergyRanking'],required,['#skillPulseBtn','#skillDashBtn','#skinActiveBtn','#mobileAimStick','#mobileFireBtn','#soloSubmarineRepairBtn','#soloSubmarinePowerBtn']);
    await screenshot('gamemaster-default-hud-'+w+'x'+h);assertAudit('gameplay '+w+'x'+h,all);
    const perf=await evaluate('window.AbyssalPerformance.snapshot()');console.log('[mobile-render-budget] '+w+'x'+h+' '+JSON.stringify(perf));
    assert.equal(perf.graphics.automatic,true,'mobile adaptive graphics must be active');
    assert.ok(perf.graphics.dpr<=2.5,'mobile framebuffer density exceeds safety cap');
    assert.ok(perf.canvasPixels<=Math.min(4000000,Math.ceil(w*h*6.25)+Math.max(w,h)*8),'mobile framebuffer exceeds pixel budget');
    const viewport=await evaluate("({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,canvas:document.getElementById('game').getBoundingClientRect().toJSON(),shell:document.getElementById('gameShell').getBoundingClientRect().toJSON()})");assert.ok(viewport.sw<=w+1&&viewport.sh<=h+1&&Math.abs(viewport.canvas.width-w)<2&&Math.abs(viewport.canvas.height-h)<2&&Math.abs(viewport.shell.width-w)<2&&Math.abs(viewport.shell.height-h)<2,'Viewport/canvas overflow: '+JSON.stringify(viewport));
    await screenshot('exact-mobile-gameplay-'+w+'x'+h);
    assert.equal(await evaluate('window.__abyssalOfferUpgrade?.()'),true,'Open real level-up modal');await sleep(120);
    const modal=await evaluate(`(()=>{const e=document.getElementById('upgradeScreen'),cards=[...e.querySelectorAll('.upgrade-card')],blocked=['#hud','#gameplayOverlayRoot','#mobileFireBtn','#mobileAimStick','#toggleHudBtn','#mobilePauseBtn','#quickComms'].filter(s=>getComputedStyle(document.querySelector(s)).visibility!=='hidden');return {open:!e.hidden,blocked,cards:cards.map(c=>{const r=c.getBoundingClientRect();return {width:r.width,height:r.height,hit:c.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};})};})()`);await screenshot('level-up-clear-'+w+'x'+h);assert.ok(modal.open&&modal.blocked.length===0&&modal.cards.length>0&&modal.cards.every(c=>c.width>0&&c.height>0&&c.hit),'HUD must never cover level-up choices: '+JSON.stringify(modal));await evaluate("document.querySelector('#upgradeChoices .upgrade-card').click()");await sleep(120);assert.equal(await evaluate("document.getElementById('upgradeScreen').hidden"),true,'Level-up selection must close and restore HUD');
   }
   await evaluate(`(()=>{const page=window.AbyssalHudLayout.createPage();document.body.append(page);const selects=page.querySelectorAll('select');selects[0].value='landscape';selects[0].dispatchEvent(new Event('change'));selects[1].value='aim';selects[1].dispatchEvent(new Event('change'));const s=page.querySelector('input[type=range]');s.value='120';s.dispatchEvent(new Event('input'));page.querySelector('.hud-editor-dock .primary-btn').click();page.remove();return true;})()`);
   await sleep(250);
   // Use the same viewport and markup as the live HUD. At minimum scale the measured
   // Vitalidade geometry must match the actual game within two CSS pixels.
   const parity=await evaluate(`(async()=>{const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:1000';const p=window.AbyssalHudLayout.createPage();host.append(p);document.body.append(host);const stage=p.querySelector('.hud-editor-stage');for(let i=0;i<40&&!stage.dataset.measured;i++)await new Promise(r=>setTimeout(r,50));const select=p.querySelector('[aria-label="Elemento da interface"]');select.value='health';select.dispatchEvent(new Event('change'));const range=p.querySelector('input[type=range]');range.value='65';range.dispatchEvent(new Event('input'));const el=p.querySelector('[data-item="health"]'),preview=Number(el.dataset.realWidth);p.querySelector('.hud-editor-dock .primary-btn').click();host.remove();await new Promise(r=>setTimeout(r,150));const rects=[...document.querySelectorAll('#hud .bars .bar-label:not(.xp-label),#hud .bars .bar:not(.xp-bar)')].map(e=>e.getBoundingClientRect());const actual=Math.max(...rects.map(r=>r.right))-Math.min(...rects.map(r=>r.left));return {preview,actual,measured:el.dataset.live,scale:Number(getComputedStyle(document.querySelector('#hud .bar-label')).scale)};})()`);console.log('[hud-parity] '+JSON.stringify(parity));assert.ok(parity.measured==='true'&&Math.abs(parity.preview-parity.actual)<2&&Math.abs(parity.scale-.65)<.01,'Minimum health HUD preview and runtime scale must match: '+JSON.stringify(parity));
   assert.equal(await evaluate(`(()=>{const e=document.getElementById('mobileAimStick');return Math.abs(Number(getComputedStyle(e).scale)-1.2)<.01&&getComputedStyle(e.querySelector('.joystick-knob')).backgroundImage.includes('abyssal-red-reticle.svg');})()`),true,'Saved aim scale and red cursor must apply to real mobile control');
   // Verify the minimum-size controls execute their real input handlers.
   await evaluate(`(()=>{const page=window.AbyssalHudLayout.createPage();document.body.append(page);const select=page.querySelector('[aria-label="Elemento da interface"]'),s=page.querySelector('input[type=range]');for(const id of ['aim','fire']){select.value=id;select.dispatchEvent(new Event('change'));s.value='65';s.dispatchEvent(new Event('input'));}page.querySelector('.primary-btn').click();page.remove();return true;})()`);
   await sleep(250);
   const minControls=await evaluate(`(()=>{const a=document.getElementById('mobileAimStick'),k=a.querySelector('.joystick-knob'),r=a.querySelector('.joystick-base').getBoundingClientRect(),f=document.getElementById('mobileFireBtn'),event=(type,x,y,id)=>new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true});a.dispatchEvent(event('pointerdown',r.left+r.width/2,r.top+r.height/2,21));window.dispatchEvent(event('pointermove',r.left+r.width*.8,r.top+r.height/2,21));const moved=k.style.transform!=='translate(0, 0)'&&k.style.transform!=='';window.dispatchEvent(event('pointerup',r.left+r.width*.8,r.top+r.height/2,21));f.dispatchEvent(event('pointerdown',0,0,22));const firing=f.classList.contains('is-firing');f.dispatchEvent(event('pointerup',0,0,22));return {aimScale:Number(getComputedStyle(a).scale),fireScale:Number(getComputedStyle(f).scale),moved,firing,released:!f.classList.contains('is-firing')};})()`);console.log('[minimum-controls] '+JSON.stringify(minControls));assert.ok(minControls.aimScale===.65&&minControls.fireScale===.65&&minControls.moved&&minControls.firing&&minControls.released,'Minimum controls must still move and shoot: '+JSON.stringify(minControls));
   assert.equal(await evaluate(`(()=>{const b=document.getElementById('toggleHudBtn');b.click();const h=document.getElementById('hud'),a=document.getElementById('activeAbilities'),p=document.getElementById('mobilePauseBtn');const ok=getComputedStyle(h).display==='none'&&getComputedStyle(a).display!=='none'&&getComputedStyle(p).visibility!=='hidden';b.click();return ok;})()`),true,'Mobile immersion must preserve actions');
   await evaluate("document.getElementById('mobilePauseBtn').click()");
   await sleep(200);
   assert.equal(await evaluate("document.getElementById('pauseScreen').hidden"),false,'Mobile pause must remain accessible');
   assert.equal(await evaluate(`(()=>{const s=document.getElementById('diveGraphicsQuality');s.value='1';s.dispatchEvent(new Event('change'));const fixed=window.AbyssalAdaptivePerformance.snapshot();s.value='auto';s.dispatchEvent(new Event('change'));return fixed.level===1&&!fixed.automatic&&window.AbyssalAdaptivePerformance.snapshot().automatic;})()`),true,'Graphics settings must work during the dive');
   assert.equal(await evaluate("document.getElementById('quitBtn').getBoundingClientRect().height>=40"),true,'Quit action must remain in pause menu');
   return;
  }
  if(mode==='solo'){
   // Verify that the actual Solo frame loop advances in wall-clock time.
   // DOM existence and virtual-time screenshots cannot prove this.
   const soloStateExpr='(()=>{const g=window.AbyssalGameHooks,p=g?.explorationPosition?.();return {active:document.body.classList.contains("game-active"),mode:p?.mode,paused:p?.paused,elapsed:g?.expeditionState?.()?.elapsed,worldHeight:g?.worldHeight?.(),x:p?.x,y:p?.y,errors:document.body.dataset.smokeError||""}})()';
   let solo=await evaluate(soloStateExpr);
   for(let attempt=0;attempt<4&&solo?.paused;attempt++){
    const chosen=await evaluate('(()=>{const button=document.querySelector("#upgradeChoices .upgrade-card");if(!button)return false;button.click();return true})()');
    if(!chosen)break;
    await sleep(400);solo=await evaluate(soloStateExpr);
   }
   console.log('[live-solo] start '+JSON.stringify(solo));
   assert.equal(solo?.active,true,'Shooter Solo must enter active gameplay');
   assert.equal(solo?.mode,'classic','Frozen gameplay route leaked into Solo');
   assert.equal(solo?.paused,false,'Shooter Solo should be simulating, not paused');
   assert.equal(solo?.worldHeight,3000,'Shooter Solo must use its own arena');
   assert.ok(solo?.elapsed>1,'Shooter Solo did not advance its real-time simulation');
   assert.ok(!solo?.errors,'Shooter Solo runtime error: '+solo.errors);
   await screenshot('live-solo-start');
   const hud=await evaluate('(()=>{const r=document.getElementById("runEnergyRanking"),h=document.getElementById("hud"),b=document.getElementById("toggleHudBtn"),pet=document.querySelector("#petHabitBar .pet-habit-actions"),bar=document.getElementById("petHabitBar"),skills=document.getElementById("activeAbilities"),active=document.getElementById("skinActiveBtn");const br=bar.getBoundingClientRect(),sr=skills.getBoundingClientRect();const before={ranking:getComputedStyle(r).display,opacity:getComputedStyle(h).opacity,pet:getComputedStyle(pet).flexDirection,petAbove:br.bottom<=sr.top+2,rLabel:active.getAttribute("aria-label"),rIcon:!!active.querySelector(".ability-glyph svg"),rKey:active.querySelector(".ability-key")?.textContent};b.click();before.hidden=getComputedStyle(h).display;before.restore=getComputedStyle(b).visibility;before.actions=getComputedStyle(skills).display!=="none"&&getComputedStyle(skills).visibility!=="hidden";before.petVisible=getComputedStyle(bar).display!=="none"&&getComputedStyle(bar).visibility!=="hidden";before.endVisible=getComputedStyle(document.getElementById("endDiveBtn")).visibility!=="hidden";b.click();return before;})()');
   assert.equal(hud.ranking,'none');assert.equal(hud.opacity,'0.6');assert.equal(hud.pet,'column');assert.equal(hud.hidden,'none');assert.equal(hud.restore,'visible');assert.equal(hud.actions,true);assert.equal(hud.petVisible,true);assert.equal(hud.endVisible,true);assert.equal(hud.petAbove,true,'Specimen behavior must sit above ability buttons');assert.ok(hud.rIcon&&hud.rKey==='R'&&!/SONAR/i.test(hud.rLabel),'Solo R must show the equipped specimen ability, not Sonar: '+hud.rLabel);
   // The movement is sent through Chromium's keyboard input, not by
   // teleporting the player or modifying in-game state.
   const key={key:'d',code:'KeyD',windowsVirtualKeyCode:68,nativeVirtualKeyCode:68};
   await command('Input.dispatchKeyEvent',{type:'keyDown',...key});
   await sleep(850);
   await command('Input.dispatchKeyEvent',{type:'keyUp',...key});
   const moved=await evaluate(soloStateExpr);
   console.log('[live-solo] after-movement '+JSON.stringify(moved));
   assert.equal(moved?.active,true,'Shooter Solo ended unexpectedly during movement');
   assert.ok(moved?.elapsed>solo.elapsed+.4,'Shooter Solo simulation stopped after input');
   assert.ok(Number(moved?.x)>Number(solo.x)+2,'D key did not move the Solo diver to the right');
   assert.ok(!moved?.errors,'Shooter Solo movement threw a runtime error: '+moved.errors);
   await screenshot('live-solo-moving');
   return;
  }
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
  await realGameplaySmoke(browser,url+'?stage=hub','desktop-profile');
  await realGameplaySmoke(browser,url+'?stage=hub','mobile-profile');
  await realGameplaySmoke(browser,url+'?stage=hub','mobile-hub');
  await realGameplaySmoke(browser,url+'?stage=cockpit&view=wardrobe','mobile-wardrobe');
  await realGameplaySmoke(browser,url,'mobile-gameplay');

  // Test the actual hatch transition and physical console in a real browser,
  // including mobile; save screenshots for visual acceptance inspection.
  for(const [label,w,h,view] of [['cockpit-desktop',1280,720,'solo'],['cockpit-tablet',900,600,'solo'],['cockpit-wide',1600,900,'solo'],['cockpit-mobile',390,844,'solo'],['cockpit-wardrobe-portrait',390,844,'wardrobe'],['cockpit-wardrobe-small',360,640,'wardrobe'],['cockpit-wardrobe-landscape',844,390,'wardrobe'],['cockpit-shop',1280,720,'shop'],['cockpit-abyssario',1280,720,'specimens'],['cockpit-solo-upgrades',1280,720,'upgrades'],['cockpit-resonance',1280,720,'resonance']]){
   const flags=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars',
    '--no-first-run','--disable-background-networking','--window-size='+w+','+h,
    '--force-device-scale-factor=1','--virtual-time-budget=11000'];
   if(label==='cockpit-mobile'||label.includes('wardrobe'))flags.push('--user-agent=Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36');
   const cockpitURL=url+'?stage=cockpit&view='+view;
   const dom=await run(browser,[...flags,'--dump-dom',cockpitURL]);
   const status=dom.match(/data-cockpit-status="([^"]*)"/)?.[1];
   const error=dom.match(/data-cockpit-error="([^"]*)"/)?.[1];
   assert.equal(status,'ok',label+' failed cockpit integration: '+error);
   console.log('[cockpit-smoke] '+label+' cards='+dom.match(/data-cockpit-cards="([^"]*)"/)?.[1]+' original-art='+dom.match(/data-cockpit-art="([^"]*)"/)?.[1]+' layout='+dom.match(/data-cockpit-layout="([^"]*)"/)?.[1]);
   const screenshot=path.join(output,label+'.png');
   await run(browser,[...flags,'--screenshot='+screenshot,cockpitURL]);
   assert.ok(fs.statSync(screenshot).size>10000,label+' cockpit screenshot missing');
  }
  // Retain legacy Mar Aberto visual QA, but do not require frozen biomes
  // to pass the release check for Shooter Solo.
  if(legacyModes)for(const biome of ['coastal','cinematic','geological']){
   const file=path.join(output,'open-sea-'+biome+'.png');
   await run(browser,['--headless=new','--no-sandbox','--disable-dev-shm-usage',
    '--disable-gpu','--hide-scrollbars','--no-first-run','--disable-background-networking',
    '--window-size=1280,720','--force-device-scale-factor=1',
    '--virtual-time-budget=8500','--screenshot='+file,url+'?stage=sea&biome='+biome]);
   assert.ok(fs.statSync(file).size>15000,'Open Sea screenshot missing: '+biome);
   const pixelStats=pngImageLuminance(file);
   console.log('[visual-acceptance] '+biome+' mean='+pixelStats.mean.toFixed(1)+
    ' bright='+pixelStats.bright+'/'+pixelStats.total);
   assert.ok(pixelStats.mean>11&&pixelStats.bright>pixelStats.total*.45,
    'Biome '+biome+' renders as a black scene: '+JSON.stringify(pixelStats));
  }
  const soloScenarios=[
   ['solo-desktop',1280,720,null,null],
   ['solo-mobile',390,844,'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',null],
   ['solo-mobile-landscape',844,390,'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',null]
  ];
  // These modes remain intact but cannot block the focused Solo release.
  if(legacyModes)soloScenarios.push(
   ['ocean-desktop',1280,720,null,'sea'],
   ['ocean-mobile',390,844,'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36','sea'],
   ['deep-desktop',1280,720,null,'deep'],
   ['boss-desktop',1280,720,null,'boss']
  );
  for(const [label,width,height,ua,stage] of soloScenarios){
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
   if(label==='solo-mobile-landscape'){
    assert.ok(layout.mobilePauseBtn?.display!=='none'&&layout.mobilePauseBtn?.w>=40&&layout.mobilePauseBtn?.h>=40,label+' pause must be visible with usable touch target');
    assert.ok(layout.hud?.h>0&&layout.hud.h<height*.48,label+' HUD must leave the majority of landscape height available for gameplay: '+JSON.stringify(layout.hud));
   }
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
  // Full Fossa replay is retained as an isolated localhost regression for the
  // frozen mode; public players still enter the classic Solo shooter only.
  await realGameplaySmoke(browser,url,'solo');
  if(legacyModes)await realGameplaySmoke(browser,url+'?stage=deep','legacy');
  else console.log('[browser-smoke] Active release: Shooter Solo, legacy expeditions excluded from gating');
 }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(err=>{console.error('[browser-smoke] '+err.stack);process.exitCode=1});
