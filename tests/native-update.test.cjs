'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('native build version matches package version',()=>{
 const pkg=require('../package.json');
 const client=read('public/client-build.js');
 assert.match(client,new RegExp("version:'"+pkg.version.replace(/\./g,'\\.')+"'"));
});

test('server exposes stable Android and Windows update channels without forcing upgrades',()=>{
 const server=read('server.js');
 assert.match(server,/app\.get\('\/api\/client-update'/);
 assert.match(server,/Abyssal-Android\.apk/);
 assert.match(server,/Abyssal-Setup\.exe/);
 assert.match(server,/Abyssal-Android-build\.json/);
 assert.match(server,/required:false/);
 assert.match(server,/latestVersion:APP_VERSION/);
});

test('installed clients verify promoted artifact metadata and auto-start a validated update',()=>{
 const updater=read('public/update-manager.js');
 assert.match(updater,/AbyssalOffline\?\.nativeAssets/);
 assert.match(updater,/metadataUrl/);
 assert.match(updater,/published\.version/);
 assert.match(updater,/published\.sha256/);
 assert.match(updater,/published\.updatable!==true/);
 assert.match(updater,/sessionStorage\.setItem\('abyssalUpdateDeferred'/);
 assert.match(updater,/checkNativeUpdateBtn/);
 assert.match(updater,/navigator\.onLine===false/);
 assert.match(updater,/modal\(data,!force\)/);
 assert.match(updater,/setTimeout\(\(\)=>\{if\(now\.isConnected&&!now\.disabled\)now\.click\(\);\},260\)/);
 assert.match(updater,/AbyssalLoadingScreen\?\.beginUpdate/);
});

test('web boot loads branded startup and updater locally and therefore remains offline-capable',()=>{
 const html=read('public/index.html');
 assert.match(html,/client-build\.js/);
 assert.match(html,/loading-screen\.js/);
 assert.match(html,/loading-screen\.css/);
 assert.match(html,/update-manager\.js/);
 assert.match(html,/update-manager\.css/);
 assert.match(html,/abyssal-startup-ready/);
 assert.match(html,/id="checkNativeUpdateBtn"/);
 const loading=read('public/loading-screen.js');
 assert.match(loading,/assets\/branding\/loading\/0\.b64/);
 assert.match(loading,/assets\/branding\/icon\/0\.b64/);
 assert.match(loading,/MODO OFFLINE/);
 assert.match(loading,/resolveUpdateGate/);
 const offline=read('public/offline-ui.js');
 assert.match(offline,/Capacitor/);
 assert.match(offline,/nativeAssets/);
});

test('Android CI publishes versioned stable metadata after building the APK',()=>{
 const ci=read('.github/workflows/ci.yml');
 assert.match(ci,/CLIENT_VERSION=\$\(node -p "require\('\.\/package\.json'\)\.version"\)/);
 assert.match(ci,/\"updatable\":%s,\"signing\":\"%s\"/);
 assert.match(ci,/assembleRelease/);
 assert.match(ci,/gh release upload downloads-2 Abyssal-Android\.apk Abyssal-Android-build\.json --clobber/);
 assert.match(ci,/android\/app\/src\/main\/assets\/public\/update-manager\.js/);
});


test('native icon builds use the generated kraken artwork instead of the legacy SVG',()=>{
 const buildIcons=read('scripts/build-app-icons.cjs');
 assert.match(buildIcons,/public','assets','branding','icon/);
 assert.match(buildIcons,/readChunkedBase64/);
 assert.doesNotMatch(buildIcons,/abyssal-icon\.svg/);
 for(const file of [
  'public/assets/branding/icon/0.b64',
  'public/assets/branding/icon/1.b64',
  'public/assets/branding/icon/2.b64',
  'public/assets/branding/loading/0.b64',
  'public/assets/branding/loading/5.b64'
 ]){
  assert.ok(fs.statSync(path.join(root,file)).size>1000,file+' should contain embedded artwork');
 }
});
