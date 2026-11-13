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
 assert.match(build,/version:'3\.6\.10'/);
 assert.match(sw,/browser-auto-update-v150/);
});
