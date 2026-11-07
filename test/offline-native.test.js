'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('offline web shell caches the complete solo game and ignores account APIs',async()=>{
 const events={};
 const stored=new Map();
 const cache={
  addAll:async urls=>{for(const url of urls){
   const pathname=new URL(url).pathname.slice(1);
   assert.ok(fs.existsSync(path.join(root,'public',pathname)),'Missing precache asset '+pathname);
   stored.set(pathname,new Response('offline-'+pathname,{status:200,headers:{'content-type':'text/plain'}}));
  }},
  match:async req=>stored.get(new URL(req.url).pathname.slice(1))||null,
  put:async(req,response)=>{stored.set(new URL(req.url).pathname.slice(1),response.clone());}
 };
 const context={
  self:{
   location:{origin:'https://abyssal.example'},
   registration:{scope:'https://abyssal.example/'},
   clients:{claim:async()=>{}},
   skipWaiting:async()=>{},
   addEventListener:(name,handler)=>{events[name]=handler}
  },
  caches:{open:async()=>cache,keys:async()=>['abyssal-game-shell-old','abyssal-game-shell-2026-11-06-offline-v1'],delete:async()=>true},
  URL,Request,Response,AbortController,setTimeout,clearTimeout,
  fetch:async()=>{throw new Error('network down')}
 };
 vm.runInNewContext(read('public/offline-sw.js'),context,{filename:'offline-sw.js'});
 assert.equal(typeof events.install,'function');
 assert.equal(typeof events.fetch,'function');
 let installPromise;
 events.install({waitUntil:p=>{installPromise=p;}});
 await installPromise;
 for(const asset of ['index.html','game.js','online.js','abyssal-map.js','offline-ui.js','offline-ui.css','server-config.js']){
  assert.ok(stored.has(asset),'Game unavailable offline: '+asset);
 }
 async function simulate(url,mode='cors'){
  let responsePromise=null;
  events.fetch({request:{method:'GET',url,mode,headers:new Headers()},respondWith:p=>{responsePromise=p;}});
  return responsePromise?await responsePromise:null;
 }
 const page=await simulate('https://abyssal.example/','navigate');
 const game=await simulate('https://abyssal.example/game.js?v=2026','cors');
 assert.match(await page.text(),/offline-index\.html/);
 assert.match(await game.text(),/offline-game\.js/);
 assert.equal(await simulate('https://abyssal.example/api/account'),null);
 assert.equal(await simulate('https://abyssal.example/socket.io/?EIO=4'),null);
 assert.equal(await simulate('https://another.example/game.js'),null);
});

test('Android Capacitor and Electron carry local web assets, not only remote URLs',()=>{
 const capacitor=JSON.parse(read('capacitor.config.json'));
 const legacy=JSON.parse(read('mobile/capacitor.config.json'));
 const desktop=JSON.parse(read('desktop/package.json'));
 const main=read('desktop/main.cjs');
 const androidCi=read('.github/workflows/ci.yml');
 const windowsCi=read('.github/workflows/download-builds.yml');
 assert.equal(capacitor.webDir,'public');
 assert.equal(legacy.webDir,'../public');
 assert.ok(!capacitor.server.url,'Android main shell must not depend on remote server.url');
 assert.ok(!legacy.server.url,'Legacy Android shell must not depend on remote server.url');
 assert.ok(desktop.build.extraResources.some(x=>x.from==='../public'&&x.to==='offline-web'));
 assert.match(main,/protocol\.registerSchemesAsPrivileged/);
 assert.match(main,/protocol\.handle\('abyssal'/);
 assert.match(main,/const OFFLINE_URL = 'abyssal:\/\/app\/index\.html'/);
 assert.match(main,/mainWindow\.loadURL\(GAME_URL\)\.catch\(loadLocal\)/);
 assert.match(main,/code !== -3/);
 assert.match(main,/localWebRoot\(\)/);
 assert.match(main,/configuredGameUrl\(\)/);
 assert.doesNotMatch(main,/abyssal-ej5j\.onrender\.com/);
 assert.match(read('public/server-config.js'),/DEFAULT_NATIVE_SERVER_URL/);
 assert.match(windowsCi,/desktop\/dist\/win-unpacked\/resources\/offline-web/);
 assert.match(androidCi,/android\/app\/src\/main\/assets\/public\/index\.html/);
});

test('offline solo startup avoids blocking Socket.IO CDN and online maintenance overlays',()=>{
 const html=read('public/index.html');
 const online=read('public/online.js');
 const game=read('public/game.js');
 const ui=read('public/offline-ui.js');
 assert.doesNotMatch(html,/<script src="https:\/\/cdn\.socket\.io/);
 assert.ok(html.indexOf('offline-ui.js?v=1')<html.indexOf('game.js?v='));
 assert.match(online,/function loadSocketClient\(\)/);
 assert.match(online,/navigator\.onLine===false/);
 assert.match(online,/window\.AbyssalGameHooks\?\.getPlayerPosition\?\.\(\)/);
 assert.match(ui,/register\('\/offline-sw\.js'/);
 assert.match(ui,/onlineButton\.disabled=offline/);
 assert.match(game,/addEventListener\('click',\(\)=>\{requestedRunMode='classic';onlineMode=false;startGame\(\)/);
 assert.match(game,/addEventListener\('abyssal-start-rift-solo',\(\)=>\{requestedRunMode='rift';onlineMode=false;startGame\(\)/);
});

test('offline storage is a local cache and never caches authenticated responses',()=>{
 const sw=read('public/offline-sw.js');
 const online=read('public/online.js');
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
 assert.match(sw,/url\.pathname\.startsWith\('\/socket\.io\/'\)/);
 assert.match(sw,/request\.headers\.has\('authorization'\)/);
 assert.doesNotMatch(sw,/cache\.addAll\([^)]+\bcookie\b/);
 assert.match(online,/const SERVER_URL=window\.ABYSSAL_SERVER_URL\|\|window\.location\.origin/);
});
