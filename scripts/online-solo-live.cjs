'use strict';
// Real-time Chromium acceptance against the actual local Socket.IO server.
// No game-state injection; only a clean adult fixture, preferences and normal menu/auth actions.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-artifacts','online-solo-live');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'abyssal-parity-'));
fs.mkdirSync(out,{recursive:true});
async function until(fn,label,timeout=30000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{last=await fn();if(last)return last;}catch(e){last=e.message;}await sleep(150);}throw Error('Timeout '+label+': '+JSON.stringify(last));}
const executable=process.env.CHROME_BIN||['google-chrome','chromium','chromium-browser'].find(x=>spawnSync('which',[x]).status===0);
async function browser(url,online){
 const profile=path.join(temp,online?'online':'solo');fs.mkdirSync(profile,{recursive:true});
 const chrome=spawn(executable,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--disable-background-timer-throttling','--disable-renderer-backgrounding','--remote-debugging-port=0','--remote-allow-origins=*','--window-size=1280,720','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
 let ws;
 try{
  const port=await until(()=>{const f=path.join(profile,'DevToolsActivePort');return fs.existsSync(f)&&Number(fs.readFileSync(f,'utf8').split('\n')[0]);},'CDP port');
  const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
  let seq=0;const pending=new Map();ws.addEventListener('message',e=>{const d=JSON.parse(e.data),p=pending.get(d.id);if(p){pending.delete(d.id);d.error?p[1](Error(d.error.message)):p[0](d.result);}});
  const cdp=(method,params={})=>new Promise((r,j)=>{const id=++seq;pending.set(id,[r,j]);ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+' '+(r.exceptionDetails.exception?.description||''));return r.result.value;};
  const shot=async name=>{const data=Buffer.from((await cdp('Page.captureScreenshot',{format:'png',fromSurface:true})).data,'base64');assert.ok(data.length>10000);assert.equal(data.readUInt32BE(16),1280);assert.equal(data.readUInt32BE(20),720);fs.writeFileSync(path.join(out,name+'.png'),data);};
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.setItem('abyssalAgeProfile',JSON.stringify({band:'adult',termsVersion:'2026-11-03-v2',acceptedAt:new Date().toISOString()}));localStorage.setItem('abyssalControlsPc','wasd-aim');}catch(e){}`});
  await cdp('Page.navigate',{url});
  await until(()=>evaluate("Boolean(window.AbyssalGameHooks&&window.AbyssalOnline&&document.getElementById('divePortalBtn')&&!document.documentElement.classList.contains('abyssal-startup'))"),'startup');
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
   await evaluate("document.getElementById('emailInput').value='paritytest@example.test';document.getElementById('nicknameInput').value='ParityTest';document.getElementById('passwordInput').value='ParityTest2026!';document.getElementById('registerBtn').click()");
   await until(()=>evaluate("window.AbyssalOnline.isAuthenticated()"),'real authentication');
   await until(()=>evaluate(`Boolean(!document.getElementById('roomsScreen').hidden&&document.querySelector('[data-room-id="MERGULHO-ONLINE"]:not([disabled])'))`),'cooperative room browser');
   await evaluate(`document.querySelector('[data-room-id="MERGULHO-ONLINE"]').click()`);
  }
  const inspect=()=>evaluate("window.AbyssalGameHooks.classicParityInspect()");
  await until(async()=>{const d=await inspect();return d.classic&&d.online===online&&d.state==='playing'&&d.submarine.sections.length===3;},'real gameplay');
  await evaluate("(()=>{const guide=document.getElementById('abyssalTutorialOverlay');if(guide&&!guide.hidden)document.getElementById('abyssalGuideStart').click();document.activeElement?.blur();})()");
  await sleep(3500);
  const initial=await inspect();await shot(online?'online':'solo');
  const sample=await evaluate("(()=>{const source=document.getElementById('game')||Array.from(document.querySelectorAll('canvas')).find(c=>c.width>500&&c.height>300&&c.getBoundingClientRect().width>500);if(!source)throw Error('game canvas missing');const c=document.createElement('canvas');c.width=96;c.height=54;const x=c.getContext('2d');x.drawImage(source,0,0,96,54);return Array.from(x.getImageData(0,0,96,54).data)})()");
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'d',code:'KeyD',windowsVirtualKeyCode:68,nativeVirtualKeyCode:68});
  await sleep(850);await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'d',code:'KeyD',windowsVirtualKeyCode:68,nativeVirtualKeyCode:68});
  await sleep(300);const moved=await inspect();await shot(online?'online-moving':'solo-moving');
  assert.ok(moved.elapsed>initial.elapsed,'game clock advances in real time');
  assert.ok(Math.abs(moved.position.x-initial.position.x)>5,'real keyboard moves the diver');
  return {choice,initial,moved,sample};
 }finally{if(ws)ws.close();chrome.kill('SIGKILL');}
}
async function main(){
 assert.ok(executable,'Chromium required');
 const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
 const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),DATA_DIR:path.join(temp,'data'),DATABASE_URL:'',ABYSSAL_GAMEMASTER_PASSWORD:''},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',d=>process.stdout.write(d));server.stderr.on('data',d=>process.stderr.write(d));
 try{
  const url='http://127.0.0.1:'+port;
  await until(async()=>{const r=await fetch(url+'/api/browser-version');return r.ok;},'server');
  const solo=await browser(url,false),online=await browser(url,true);
  const {sample:a,...soloReport}=solo,{sample:b,...onlineReport}=online;
  let error=0,similar=0;for(let i=0;i<a.length;i+=4){let d=0;for(let k=0;k<3;k++)d+=Math.abs(a[i+k]-b[i+k]);error+=d;if(d/3<=35)similar++;}
  const report={solo:soloReport,online:onlineReport,comparison:{meanRgbError:error/(a.length/4*3),similarPixelFraction:similar/(a.length/4)}};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('LIVE PARITY REPORT '+JSON.stringify(report));
  assert.deepEqual(solo.initial.rocks,online.initial.rocks,'identical cavern and hull geometry');
  assert.deepEqual(solo.initial.world,online.initial.world,'identical world and zoom');
  assert.deepEqual(solo.initial.submarine.sections,online.initial.submarine.sections,'identical hull HP');
  assert.equal(solo.initial.submarine.repairSeconds,6);assert.equal(online.initial.submarine.repairSeconds,15);
  assert.equal(solo.initial.petVisible,true);assert.equal(online.initial.petVisible,true);
  assert.ok(report.comparison.similarPixelFraction>.65,'rendered canvas similarity');
 }finally{server.kill('SIGTERM');await sleep(500);}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{try{fs.rmSync(temp,{recursive:true,force:true});}catch{}});
