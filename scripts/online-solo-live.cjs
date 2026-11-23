'use strict';
// Real-time Chromium acceptance against the actual local Socket.IO server.
// No game-state injection; only a clean adult fixture, preferences and normal menu/auth actions.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-artifacts','online-solo-live');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const propulsorCheck=process.argv.includes('--propulsor');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'abyssal-parity-'));
fs.mkdirSync(out,{recursive:true});
async function until(fn,label,timeout=30000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{last=await fn();if(last)return last;}catch(e){last=e.message;}await sleep(150);}throw Error('Timeout '+label+': '+JSON.stringify(last));}
const executable=process.env.CHROME_BIN||['google-chrome','google-chrome-stable','chromium','chromium-browser'].map(name=>spawnSync('which',[name],{encoding:'utf8'})).find(result=>result.status===0)?.stdout.trim();
async function browser(url,online){
 const profile=fs.mkdtempSync(path.join(temp,online?'online-':'solo-'));
 // Match the Chrome launch parameters used by the passing login/CDP smoke tests.
 // stderr and exit status are mandatory when Chrome fails before DevTools starts.
 const flags=['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run','--remote-debugging-port=0','--remote-allow-origins=*','--window-size=1280,720','--user-data-dir='+profile,'about:blank'];
 const chrome=spawn(executable,flags,{stdio:['ignore','ignore','pipe']});
 let chromeError='',chromeSpawnError=null,ws;
 chrome.stderr?.on('data',part=>{chromeError+=String(part);if(chromeError.length>4000)chromeError=chromeError.slice(-4000);});
 chrome.on('error',err=>{chromeSpawnError=err;});
 try{
  const port=await until(()=>{
   if(chromeSpawnError)throw Error('Chrome spawn: '+chromeSpawnError.message);
   const f=path.join(profile,'DevToolsActivePort');
   if(fs.existsSync(f)){const port=Number(fs.readFileSync(f,'utf8').split('\n')[0]);if(port)return port;}
   if(chrome.exitCode!==null)throw Error('Chrome exited '+chrome.exitCode+': '+chromeError.slice(-1600));
   return false;
  },'CDP port ('+executable+') '+chromeError.slice(-400),20000);
  const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
  let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const d=JSON.parse(e.data),p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p[1](Error(d.error.message)):p[0](d.result);}});
  const cdp=(method,params={})=>new Promise((r,j)=>{const id=++seq;pending.set(id,[r,j]);ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+' '+(r.exceptionDetails.exception?.description||''));return r.result.value;};
  const shot=async(name,w=1280,h=720)=>{const data=Buffer.from((await cdp('Page.captureScreenshot',{format:'png',fromSurface:true})).data,'base64');assert.ok(data.length>10000);assert.equal(data.readUInt32BE(16),w);assert.equal(data.readUInt32BE(20),h);fs.writeFileSync(path.join(out,name+'.png'),data);};
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.setItem('abyssalAgeProfile',JSON.stringify({band:'adult',termsVersion:'2026-11-03-v2',acceptedAt:new Date().toISOString()}));localStorage.setItem('abyssalControlsPc','wasd-aim');if(${propulsorCheck&&!online})localStorage.setItem('abyssalMetaUpgrades',JSON.stringify({dash:1}));}catch(e){}`});
  await cdp('Page.navigate',{url});
  await until(()=>evaluate("Boolean(window.AbyssalGameHooks&&window.AbyssalOnline&&document.getElementById('divePortalBtn')&&!document.documentElement.classList.contains('abyssal-startup'))"),'startup');
  await evaluate("document.getElementById('loginGuestBtn')?.click()");
  await evaluate("(()=>{const e=document.getElementById('submarineWorkshopClose');if(e&&!document.getElementById('submarineWorkshop').hidden)e.click();})()");
  await until(()=>evaluate(`document.body.classList.contains('abyss-hatch-navigation')&&document.getElementById('submarineWorkshop').hidden`),'exterior starting menu');
  await sleep(600);
  await evaluate("document.getElementById('divePortalBtn').click()");
  await until(()=>evaluate("!document.getElementById('abyssalDiveChoicePanel').hidden&&getComputedStyle(document.getElementById('abyssalDiveChoicePanel')).display!=='none'"),'dive chooser');
  const choice=await evaluate("(()=>{const e=document.getElementById('abyssDiveOnlineChoice');return {disabled:e.disabled,opacity:getComputedStyle(e).opacity,after:getComputedStyle(e,'::after').content,text:e.textContent}})()");
  assert.equal(choice.disabled,false);assert.equal(choice.opacity,'1');assert.ok(!choice.after.includes('DESENVOLVIMENTO'));assert.ok(!choice.text.includes('DESENVOLVIMENTO'));
  if(online)await shot('menu-online-liberado');
  await evaluate("document.getElementById('"+(online?'abyssDiveOnlineChoice':'abyssDiveSoloChoice')+"').click()");
  if(online){
   await until(()=>evaluate("Boolean(window.AbyssalOnline.isConnected()&&!document.getElementById('loginScreen').hidden)"),'login screen');
   if(propulsorCheck)await evaluate("document.getElementById('nicknameInput').value='GoogleReviewer01';document.getElementById('passwordInput').value='PropulsorTest2026!';document.getElementById('loginSubmitBtn').click()");
   else await evaluate("document.getElementById('emailInput').value='paritytest@example.test';document.getElementById('nicknameInput').value='ParityTest';document.getElementById('passwordInput').value='ParityTest2026!';document.getElementById('birthDateInput').value='1990-04-02';document.getElementById('createTermsAccept').checked=true;document.getElementById('registerBtn').click();document.getElementById('loginSubmitBtn').click()");
   await until(()=>evaluate("window.AbyssalOnline.isAuthenticated()"),'real authentication');
   if(!propulsorCheck){const sync=await evaluate(`(async()=>{const api=window.AbyssalHudLayout,online=window.AbyssalOnline,layout=api.normalize({desktop:{pulse:{x:.25,y:.8,s:1.1}},online:{desktop:{pulse:{x:.35,y:.8,s:1.2}}}});const r=await new Promise(resolve=>online.saveCosmetics({hudLayout:layout},resolve));if(!r.ok)return r;await new Promise(r=>setTimeout(r,150));const loaded=api.get();const mirror=JSON.parse(localStorage.getItem('abyssalHudLayoutV1'));const patch=api.normalize({desktop:{health:{x:.42,y:.25,s:.8}}});const patched=await new Promise(resolve=>online.saveCosmetics({hudLayout:patch,hudLayoutChanges:['solo:desktop']},resolve));await new Promise(r=>setTimeout(r,100));const merged=api.get();const cleared=await new Promise(resolve=>online.saveCosmetics({hudLayout:api.normalize(null)},resolve));await new Promise(r=>setTimeout(r,150));return {ok:r.ok,solo:loaded.desktop.pulse,online:loaded.online.desktop.pulse,mirror:mirror.desktop.pulse,merged:merged.desktop.health,kept:merged.online.desktop.pulse,patched:patched.ok,reset:Object.keys(api.get().desktop).length,revision:cleared.account?.hudLayoutRevision};})()`);assert.ok(sync.ok&&sync.solo.x===.25&&sync.online.x===.35&&sync.mirror.s===1.1&&sync.patched&&sync.merged.x===.42&&sync.kept.x===.35&&sync.reset===0&&sync.revision>=3,'Server HUD must hydrate the actual client and respect resets: '+JSON.stringify(sync));}

   await until(()=>evaluate(`Boolean(!document.getElementById('roomsScreen').hidden&&document.querySelector('[data-room-id="MERGULHO-ONLINE"]:not([disabled])'))`),'cooperative room browser');
   await evaluate(`document.querySelector('[data-room-id="MERGULHO-ONLINE"]').click()`);
  }
  const inspect=()=>evaluate("window.AbyssalGameHooks.classicParityInspect()");
  await until(async()=>{const d=await inspect();return d.classic&&d.online===online&&d.state==='playing'&&d.submarine.sections.length===3;},'real gameplay');
  await evaluate("(()=>{const guide=document.getElementById('abyssalTutorialOverlay');if(guide&&!guide.hidden)document.getElementById('abyssalGuideStart').click();document.activeElement?.blur();})()");
  await sleep(3500);
  const initial=await inspect();await shot(online?'online':'solo');
  const desktopPreset=await evaluate(`(()=>{const a=window.AbyssalHudLayout,p=a.getEffective(document.body.dataset.hudMode,'desktop'),r=id=>{const e=document.getElementById(id),b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom,hidden:e.hidden};};return {overrides:p,power:r('soloSubmarinePowerBtn'),comms:r('quickCommsToggle'),end:r('endDiveBtn')};})()`);await shot((online?'online':'solo')+'-gamemaster-desktop');assert.ok(!desktopPreset.overrides.pulse,'GameMaster PC must use native shot positions without Nekko overrides');assert.ok(desktopPreset.end.x>1000,'PC end button remains accessible at lower right');if(online&&!desktopPreset.power.hidden)assert.ok(desktopPreset.comms.bottom+3<=desktopPreset.power.y&&Math.abs(desktopPreset.comms.x-desktopPreset.power.x)<3,'Emoji button above energize: '+JSON.stringify(desktopPreset));
  if(online&&!propulsorCheck){
   const edited=await evaluate(`(async()=>{const api=window.AbyssalHudLayout,p=api.createPage();document.body.append(p);const stage=p.querySelector('.hud-editor-stage');for(let i=0;i<60&&!stage.dataset.measured;i++)await new Promise(r=>setTimeout(r,50));if(!stage.dataset.measured)throw Error('Desktop preview not measured');const sel=p.querySelector('[aria-label="Elemento da interface"]');sel.value='health';sel.dispatchEvent(new Event('change'));const piece=p.querySelector('[data-item="health"]');for(let i=0;i<8;i++)piece.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));const size=p.querySelector('input[type=range]');size.value='80';size.dispatchEvent(new Event('input'));const rect=piece.getBoundingClientRect(),expected={x:rect.x+rect.width/2,y:rect.y+rect.height/2,w:rect.width};p.querySelector('.hud-editor-dock .primary-btn').click();p.close();p.remove();for(let i=0;i<60;i++){if(window.AbyssalOnline.getAccount()?.hudLayout?.online?.desktop?.health?.s===.8)break;await new Promise(r=>setTimeout(r,50));}await new Promise(r=>setTimeout(r,100));const a=[...document.querySelectorAll('#hud .bars .bar-label:not(.xp-label),#hud .bars .bar:not(.xp-bar)')].map(e=>e.getBoundingClientRect()),left=Math.min(...a.map(r=>r.left)),right=Math.max(...a.map(r=>r.right)),top=Math.min(...a.map(r=>r.top)),bottom=Math.max(...a.map(r=>r.bottom));return {expected,actual:{x:(left+right)/2,y:(top+bottom)/2,w:right-left},saved:api.get().online.desktop.health,server:window.AbyssalOnline.getAccount()?.hudLayout?.online?.desktop?.health,mode:document.body.dataset.hudMode};})()`);await shot('online-desktop-equipped-hud');assert.ok(edited.mode==='online'&&edited.saved.s===.8&&edited.server.s===.8&&Math.abs(edited.actual.x-edited.expected.x)<2&&Math.abs(edited.actual.y-edited.expected.y)<2&&Math.abs(edited.actual.w-edited.expected.w)<2,'Equipped desktop HUD must match the actual editor preview: '+JSON.stringify(edited));
   await evaluate(`new Promise(resolve=>window.AbyssalOnline.saveCosmetics({hudLayout:window.AbyssalHudLayout.normalize(null),hudLayoutChanges:['online:desktop']},resolve))`);await sleep(150);
  }
  if(!propulsorCheck){
   const geometry=()=>evaluate(`(()=>{const sels=['#toggleHudBtn','#pauseBtn','#skinActiveBtn','#petHabitBar .pet-habit-actions','#hud .hud-top','#hud .bar-label:not(.xp-label)','#hud .xp-label','#bossProgressionTrack','#selectedSkillsPanel','#endDiveBtn'${online?",'#quickCommsToggle'":""}];return Object.fromEntries(sels.map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,[r.x,r.y,r.width,r.height]]}));})()`);const before=await geometry();
   // Real hide/show and contextual visibility changes must not displace any other HUD slot.
   await evaluate("document.getElementById('toggleHudBtn').click()");await sleep(100);await evaluate("document.getElementById('toggleHudBtn').click()");await sleep(150);
   const after=await geometry();await shot((online?'online':'solo')+'-stable-hud-toggle');for(const [id,old] of Object.entries(before))assert.ok(old.slice(0,id==='#selectedSkillsPanel'?3:4).every((n,i)=>Math.abs(n-after[id][i])<2),'HUD toggle moved '+id+': '+JSON.stringify({old,next:after[id]}));
  }
  const hudAudit=await evaluate(`(()=>{const a=window.AbyssalHudLayout,mode=document.body.dataset.hudMode,items=a.eligibleItems(mode,'desktop'),visible=s=>[...document.querySelectorAll(s)].some(e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return !e.closest('[hidden]')&&r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden';});return {mode,items:items.map(i=>i[0]),visible:items.filter(i=>i[2].some(visible)).map(i=>i[0]),comms:visible('#quickComms'),ranking:visible('#runEnergyRanking'),exploration:['#explorationOverlay','#abyssalMiniMap','#abyssDepthMeter','#abyssInventoryToggle','#abyssHotbar','#explorationGatherBtn'].filter(visible)};})()`);console.log('LIVE HUD '+JSON.stringify(hudAudit));assert.equal(hudAudit.mode,online?'online':'solo');assert.equal(hudAudit.items.includes('comms'),online);assert.equal(hudAudit.comms,online);assert.equal(hudAudit.ranking,false);assert.deepEqual(hudAudit.exploration,[]);
  if(online&&!propulsorCheck){
   for(const [w,h] of [[360,640],[844,390]]){
    await cdp('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:true,screenOrientation:{type:w>h?'landscapePrimary':'portraitPrimary',angle:w>h?90:0}});await cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await sleep(400);
    const layout=await evaluate(`(()=>{const api=window.AbyssalHudLayout,mode=document.body.dataset.hudMode,device=innerWidth>innerHeight?'landscape':'portrait',p=api.getEffective(mode,device),v=id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),s=getComputedStyle(e);return {visible:!e.hidden&&s.visibility!=='hidden'&&r.width>0&&r.height>0,w:r.width,h:r.height,hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};};const health=document.querySelector('#hud .bar-label');return {mode,device,mobile:document.body.classList.contains('mobile-game-active'),preset:p.health.s,healthScale:Number(getComputedStyle(health).scale),comms:v('quickCommsToggle'),pause:v('mobilePauseBtn')};})()`);
    console.log('LIVE MOBILE HUD '+JSON.stringify(layout));await shot('online-gamemaster-hud-'+w+'x'+h,w,h);assert.ok(layout.mode==='online'&&layout.mobile&&layout.preset===.65&&Math.abs(layout.healthScale-.65)<.01&&layout.comms.visible&&layout.comms.hit&&layout.pause.visible&&layout.pause.hit,'Online must use the real mobile baseline and reachable emoji button: '+JSON.stringify(layout));
    await evaluate("document.getElementById('quickCommsToggle').click()");await sleep(100);const wheel=await evaluate(`(()=>{const e=document.getElementById('quickCommsWheel'),r=e.getBoundingClientRect();return {open:!e.hidden,left:r.left,right:r.right,top:r.top,bottom:r.bottom,buttons:[...e.querySelectorAll('button')].every(b=>{const q=b.getBoundingClientRect();return b.contains(document.elementFromPoint(q.x+q.width/2,q.y+q.height/2));})};})()`);await shot('online-emoji-wheel-'+w+'x'+h,w,h);assert.ok(wheel.open&&wheel.left>=5&&wheel.right<=w-5&&wheel.top>=5&&wheel.bottom<=h-5&&wheel.buttons,'Emoji menu must stay reachable when its HUD button moves: '+JSON.stringify(wheel));await evaluate("document.getElementById('quickCommsToggle').click()");
   }
   await cdp('Emulation.setTouchEmulationEnabled',{enabled:false});await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});await sleep(400);
   const first=await evaluate(`(()=>{const b=document.getElementById('quickCommsToggle');b.click();document.querySelector('#quickCommsWheel button').click();const t=b.querySelector('.quick-comms-timer');return {disabled:b.disabled,seconds:t.textContent,wheelHidden:document.getElementById('quickCommsWheel').hidden};})()`);await shot('online-emoji-cooldown');assert.ok(first.disabled&&first.seconds==='10s'&&first.wheelHidden,'Emoji immediately enters 10-second cooldown');
   await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyV',bubbles:true}))");assert.equal(await evaluate("document.getElementById('quickCommsWheel').hidden"),true,'Keyboard cannot bypass cooldown');
   await until(()=>evaluate("!document.getElementById('quickCommsToggle').disabled"),'emoji cooldown expiry',15000);assert.equal(await evaluate("document.getElementById('quickCommsToggle').querySelector('.quick-comms-icon').hidden"),false,'Emoji icon returns');
  }
  const sample=await evaluate("(()=>{const source=document.getElementById('game')||Array.from(document.querySelectorAll('canvas')).find(c=>c.width>500&&c.height>300&&c.getBoundingClientRect().width>500);if(!source)throw Error('game canvas missing');const c=document.createElement('canvas');c.width=96;c.height=54;const x=c.getContext('2d');x.drawImage(source,0,0,96,54);return Array.from(x.getImageData(0,0,96,54).data)})()");
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'d',code:'KeyD',windowsVirtualKeyCode:68,nativeVirtualKeyCode:68});
  await sleep(850);await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'d',code:'KeyD',windowsVirtualKeyCode:68,nativeVirtualKeyCode:68});
  await sleep(300);const moved=await inspect();await shot(online?'online-moving':'solo-moving');
  assert.ok(moved.elapsed>initial.elapsed,'game clock advances in real time');
  assert.ok(Math.abs(moved.position.x-initial.position.x)>5,'real keyboard moves the diver');
  let propulsion=null;
  if(propulsorCheck){
   await until(()=>evaluate("!document.getElementById('skillDashBtn').hidden"),'unlocked propulsor');
   const key=async(type,k,code,v)=>cdp('Input.dispatchKeyEvent',{type,key:k,code,windowsVirtualKeyCode:v,nativeVirtualKeyCode:v});
   const toggle=async()=>{await key('keyDown','e','KeyE',69);await key('keyUp','e','KeyE',69);};
   await toggle();await until(async()=>{const p=await inspect();return p.propulsor.equipped;},'E equips propulsor');
   const before=await inspect();assert.equal(Math.round(before.propulsor.energy),100);
   await key('keyDown','a','KeyA',65);await sleep(850);
   const swimming=await inspect();await shot((online?'online':'solo')+'-propulsor');
   await key('keyUp','a','KeyA',65);
   assert.ok(Math.hypot(swimming.position.x-before.position.x,swimming.position.y-before.position.y)>5,'propulsor moves actual diver');
   assert.ok(swimming.propulsor.energy<before.propulsor.energy-1,'propulsor consumes independent battery while moving');
   await toggle();await until(async()=>!(await inspect()).propulsor.equipped,'E restores rifle');
   const stored=await inspect();await sleep(1100);const recovered=await inspect();
   assert.ok(recovered.propulsor.energy>stored.propulsor.energy,'battery recharges while stored');
   await toggle();await until(async()=>{const p=await inspect();return p.propulsor.equipped;},'E re-equips without cooldown');
   await toggle();await until(async()=>!(await inspect()).propulsor.equipped,'E can immediately store again');
   propulsion={before:before.propulsor,swimming:swimming.propulsor,stored:stored.propulsor,recovered:recovered.propulsor};
   console.log('LIVE PROPULSOR '+(online?'online':'solo')+' '+JSON.stringify(propulsion));
  }
  return {choice,initial,moved,sample,propulsion};
 }finally{if(ws)ws.close();if(chrome.exitCode===null)chrome.kill('SIGKILL');await Promise.race([new Promise(resolve=>chrome.once('close',resolve)),sleep(1800)]);}
}
async function main(){
 assert.ok(executable,'Chromium required');
 const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:path.join(temp,'data'),DATABASE_URL:'',ABYSSAL_GAMEMASTER_PASSWORD:'',...(propulsorCheck?{ABYSSAL_REVIEW_PASSWORD_01:'PropulsorTest2026!'}:{})},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',d=>process.stdout.write(d));server.stderr.on('data',d=>process.stderr.write(d));
 try{
  const url='http://127.0.0.1:'+port;
  await until(async()=>{const r=await fetch(url+'/api/browser-version');return r.ok;},'server');
  const solo=await browser(url,false),online=await browser(url,true);
  const {sample:a,...soloReport}=solo,{sample:b,...onlineReport}=online;
  let error=0,similar=0;for(let i=0;i<a.length;i+=4){let d=0;for(let k=0;k<3;k++)d+=Math.abs(a[i+k]-b[i+k]);error+=d;if(d/3<=35)similar++;}
  const report={solo:soloReport,online:onlineReport,comparison:{meanRgbError:error/(a.length/4*3),similarPixelFraction:similar/(a.length/4)}};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('LIVE PARITY REPORT '+JSON.stringify(report));
  if(propulsorCheck){assert.ok(solo.propulsion&&online.propulsion);return;}
  assert.deepEqual(solo.initial.rocks,online.initial.rocks,'identical cavern and hull geometry');
  assert.deepEqual(solo.initial.world,online.initial.world,'identical world and zoom');
  assert.deepEqual(solo.initial.submarine.sections,online.initial.submarine.sections,'identical hull HP');
  assert.equal(solo.initial.submarine.repairSeconds,6);assert.equal(online.initial.submarine.repairSeconds,15);
  assert.equal(solo.initial.petVisible,true);assert.equal(online.initial.petVisible,true);
  assert.ok(report.comparison.similarPixelFraction>.65,'rendered canvas similarity');
 }finally{server.kill('SIGTERM');await sleep(500);}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{try{fs.rmSync(temp,{recursive:true,force:true});}catch{}});
