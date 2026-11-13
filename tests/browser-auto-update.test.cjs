'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('browser exposes uncached live version endpoint',()=>{
 const server=read('server.js');
 assert.match(server,/app\.get\('\/api\/browser-version'/);
 assert.match(server,/Cache-Control','no-store, no-cache, must-revalidate, max-age=0'/);
 assert.match(server,/version:APP_VERSION/);
});

test('browser updater checks server version and refreshes service worker',()=>{
 const updater=read('public/update-manager.js');
 assert.match(updater,/function browserMode\(\)/);
 assert.match(updater,/async function checkBrowser/);
 assert.match(updater,/\/api\/browser-version/);
 assert.match(updater,/navigator\.serviceWorker\.getRegistration/);
 assert.match(updater,/await reg\.update\(\)/);
 assert.match(updater,/location\.replace/);
 assert.match(updater,/setInterval\(.*30000/);
});

test('service worker reload guard is version-aware',()=>{
 const offline=read('public/offline-ui.js');
 assert.match(offline,/abyssalSwReload:/);
 assert.match(offline,/ABYSSAL_CLIENT_BUILD\?\.version/);
});

test('browser auto-update release bumps version and cache',()=>{
 const build=read('public/client-build.js');
 const sw=read('public/offline-sw.js');
 assert.match(build,new RegExp("version:'"+require('../package.json').version.replace(/\./g,'\\.')+"'"));
 assert.match(sw,/exterior-cadence-v159/);
});

test('active gameplay is protected from unsolicited browser reloads',()=>{
 const updater=read('public/update-manager.js'),offline=read('public/offline-ui.js'),game=read('public/game.js');
 assert.match(updater,/blocked&&!allowActive/);
 assert.match(game,/browserUpdateBlocked:\(\)=>gameState!=='menu'/);
 assert.doesNotMatch(offline,/window\.location\.reload\(/);
});
test('maintenance reload stores rejoin data before checking version and restores only a server-approved run',()=>{
 const online=read('public/online.js'),game=read('public/game.js'),server=read('server.js');
 assert.match(online,/sessionStorage\.setItem\(updateResumeKey/);
 assert.match(online,/checkBrowser\(false,true\)/);
 assert.match(online,/data\.resumedRun&&saved\?\.id===roomId/);
 assert.match(game,/startGame\(Boolean\(d\.resumedRun\)\)/);
 assert.match(server,/room\.isPrivate&&!authorizedDeployResume/);
});

const vm=require('node:vm');
test('browser updater defers gameplay but permits maintenance handoff without a service worker',async()=>{
 const storage=new Map(),reloads=[],notices=[];let blocked=true,fetches=0;
 const window={ABYSSAL_CLIENT_BUILD:{version:'3.6.12'},location:{protocol:'https:',hostname:'abyssal.example',origin:'https://abyssal.example',href:'https://abyssal.example/',replace:url=>reloads.push(url)},AbyssalGameHooks:{browserUpdateBlocked:()=>blocked,notifyBrowserUpdate:()=>notices.push(1)},addEventListener(){}};
 const context={window,navigator:{onLine:true},document:{readyState:'loading',addEventListener(){},body:{classList:{contains:()=>blocked}}},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},fetch:async()=>{fetches++;return {ok:true,json:async()=>({ok:true,version:'3.6.13'})};},URL,AbortSignal,console,setTimeout:(fn)=>{fn();return 1;},clearTimeout(){},setInterval(){}};
 vm.runInNewContext(read('public/update-manager.js'),context);
 const deferred=await window.AbyssalUpdater.checkBrowser();assert.equal(deferred.reloadStarted,false);assert.equal(reloads.length,0);assert.equal(notices.length,1);
 const updated=await window.AbyssalUpdater.checkBrowser(false,true);assert.equal(updated.reloadStarted,true);assert.equal(reloads.length,1);assert.match(reloads[0],/abyssVersion=3.6.13/);assert.equal(fetches,2);
});
test('service worker proves the installed cache release before reload',()=>{const sw=read('public/offline-sw.js'),updater=read('public/update-manager.js');assert.match(sw,/abyssal-client-build/);assert.match(updater,/workerBuild\(navigator\.serviceWorker\.controller\)/);assert.match(updater,/if\(!ready\)/);});
