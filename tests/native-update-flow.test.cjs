'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/update-manager.js'),'utf8');
function harness({platform='windows',active=false,version='3.6.55',permission=false,play=false,playAvailable=true,playAccepted=true,updatable=true}={}){
 const storage=new Map(),requests=[],installs=[],releases=[];
 let playChecks=0,playStarts=0;const lifecycle={};
 let blocked=active;const nodes=new Map();
 function element(tag){
  return {tag,children:[],dataset:{},listeners:{},isConnected:true,disabled:false,textContent:'',
   setAttribute(){},append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);if(item.id)nodes.set(item.id,item);},
   addEventListener(event,fn){this.listeners[event]=fn;},remove(){this.isConnected=false;nodes.delete(this.id);}};
 }
 const doc={readyState:'loading',visibilityState:'visible',body:element('body'),createElement:element,getElementById:id=>nodes.get(id)||null,addEventListener(){}};
 doc.body.classList={contains:()=>blocked};
 const bridge={installApk:async data=>{installs.push(data);return permission?{ok:false,permissionRequired:true}:{ok:true,launched:true};},
  getUpdateChannel:async()=>({channel:play?'play':'direct'}),
  checkPlayUpdate:async()=>{playChecks++;return {available:playAvailable,immediateAllowed:true,versionCode:500};},
  startPlayUpdate:async()=>{playStarts++;installs.push('play');return {ok:playAccepted};}};
 const window={ABYSSAL_CLIENT_BUILD:{version:'3.6.54'},ABYSSAL_SERVER_URL:'https://abyssal.example',
  AbyssalOffline:{nativeAssets:true,localDesktop:platform==='windows'},location:{protocol:'abyssal:',origin:'abyssal://app'},addEventListener(event,fn){lifecycle[event]=fn;},
  AbyssalGameHooks:{browserUpdateBlocked:()=>blocked},AbyssalLoadingScreen:{status(){},resolveUpdateGate(){},beginUpdate(){},updateDownload(){},updateInstall(){},releaseAfterUpdate:msg=>releases.push(msg),updateError(){}},
  AbyssalNativeUpdater:{installUpdate:async data=>{installs.push(data);return {ok:true,launched:true};}},
  Capacitor:platform==='android'?{getPlatform:()=> 'android',Plugins:{AbyssalUpdater:bridge}}:undefined};
 const context={window,document:doc,navigator:{onLine:true,userAgent:platform==='windows'?'Windows':'Android'},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},fetch:async url=>{requests.push(url);return {ok:true,json:async()=>({ok:true,platform,latestVersion:version,updatable,sha256:'a'.repeat(64),url:'https://github.com/Esaneto/Abyssal/releases/download/downloads-2/'+(platform==='windows'?'Abyssal-Setup.exe':'Abyssal-Android.apk')})};},URL,AbortSignal,console,setTimeout:()=>1,clearTimeout(){},setInterval(){}};
 vm.runInNewContext(source,context);
 const buttons=()=>nodes.get('abyssalUpdatePrompt')?.children[0]?.children.find(e=>e.className==='abyssal-update-actions')?.children||[];
 return {api:window.AbyssalUpdater,requests,installs,releases,buttons,nodes,lifecycle,
  playChecks:()=>playChecks,playStarts:()=>playStarts,setPlayAvailable:v=>{playAvailable=v;},
  unblock:()=>{blocked=false;},block:()=>{blocked=true;}};
}
test('Windows notifies, waits for consent and sends a verified package to native bridge',async()=>{
 const h=harness();await h.api.check(true);assert.equal(h.requests.length,1);assert.equal(h.installs.length,0);
 assert.equal(h.buttons()[0].textContent,'ATUALIZAR AGORA');await h.buttons()[0].listeners.click();
 assert.equal(h.installs.length,1);assert.equal(h.installs[0].sha256,'a'.repeat(64));assert.equal(h.installs[0].version,'3.6.55');
});
test('native update never interrupts an active run and can be checked from menu',async()=>{
 const h=harness({active:true});assert.equal(await h.api.check(true),null);assert.equal(h.requests.length,0);
 h.unblock();await h.api.check(true);assert.equal(h.buttons().length,2);
});
test('Android permission refusal releases startup overlay and leaves retry available',async()=>{
 const h=harness({platform:'android',permission:true});await h.api.check(true);await h.buttons()[0].listeners.click();
 assert.equal(h.installs.length,1);assert.equal(h.buttons()[0].disabled,false);assert.ok(h.releases.some(s=>s.includes('Autorize')));
});
test('Google Play checks its own channel and starts official update only on confirmation',async()=>{
 const h=harness({platform:'android',play:true});await h.api.check(true);assert.equal(h.requests.length,0);assert.equal(h.installs.length,0);
 await h.buttons()[0].listeners.click();assert.deepEqual(h.installs,['play']);
});
test('non-updatable release is never offered as an installable package',async()=>{
 const h=harness({updatable:false});await h.api.check(true);assert.equal(h.buttons().length,0);assert.equal(h.installs.length,0);
});

test('native notification is deferred when a dive starts during the version request',async()=>{
 const h=harness();const pending=h.api.check(true);h.block();await pending;
 assert.equal(h.buttons().length,0);assert.equal(h.installs.length,0);
 h.unblock();await h.api.check(true);assert.equal(h.buttons().length,2);
});
test('native install rechecks gameplay before invoking the installer',async()=>{
 const h=harness();await h.api.check(true);h.block();
 await h.buttons()[0].listeners.click();assert.equal(h.installs.length,0);assert.equal(h.buttons()[0].disabled,false);
 h.unblock();await h.buttons()[0].listeners.click();assert.equal(h.installs.length,1);
});


test('Play update at cold launch is mandatory, with only one Update CTA',async()=>{
 const h=harness({platform:'android',play:true});
 const result=await h.api.check(false);
 assert.equal(result.required,true);
 assert.equal(h.playChecks(),1);
 assert.equal(h.requests.length,0,'Play channel must not contact direct APK server');
 assert.equal(h.buttons().length,1,'No postpone button for mandatory Play update');
 assert.equal(h.buttons()[0].textContent,'ATUALIZAR PELA GOOGLE PLAY');
 assert.equal(h.nodes.get('abyssalUpdatePrompt').dataset.required,'true');
 // Forced/manual checks cannot turn an existing mandatory prompt into optional.
 assert.equal((await h.api.check(true)).required,true);
 assert.equal(h.playChecks(),1);
});
test('canceled Play update keeps blocking prompt and permits another attempt',async()=>{
 const h=harness({platform:'android',play:true,playAccepted:false});
 await h.api.check(false);
 const update=h.buttons()[0];await update.listeners.click();
 assert.equal(h.playStarts(),1);
 assert.equal(h.nodes.get('abyssalUpdatePrompt').isConnected,true);
 assert.equal(update.disabled,false);
 assert.equal(h.buttons().length,1);
 assert.equal(h.releases.length,0,'Cancellation must not release loading/game gate');
 await update.listeners.click();
 assert.equal(h.playStarts(),2,'The user can retry the official update');
});
test('a Play update published mid-session waits for next cold launch',async()=>{
 const h=harness({platform:'android',play:true,playAvailable:false});
 const first=await h.api.check(false);assert.equal(first.available,false);
 h.setPlayAvailable(true);
 await h.api.check(false);
 assert.equal(h.playChecks(),1,'No background Play checks in the current session');
 assert.equal(h.nodes.has('abyssalUpdatePrompt'),false);
 // A deliberate manual check is allowed, but is postponable in this
 // already-started session; the next cold start enforces the update.
 const manual=await h.api.check(true);
 assert.equal(manual.required,false);
 assert.equal(h.playChecks(),2);
 assert.equal(h.buttons().length,2);
});
test('offline Play startup does not lock players behind an unavailable update',async()=>{
 const h=harness({platform:'android',play:true,playAvailable:false});
 await h.api.check(false);assert.equal(h.nodes.has('abyssalUpdatePrompt'),false);
});
