'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Android native build is locked to portrait',()=>{
 const cfg=read('scripts/configure-android.cjs');
 assert.match(cfg,/android:screenOrientation="portrait"/);
 assert.match(cfg,/SCREEN_ORIENTATION_PORTRAIT/);
 assert.doesNotMatch(cfg,/android:screenOrientation="landscape"/);
});

test('installed web app requests portrait orientation',()=>{
 const manifest=JSON.parse(read('public/manifest.webmanifest'));
 assert.equal(manifest.orientation,'portrait');
});

test('mobile browser blocks gameplay while phone is in landscape',()=>{
 const js=read('public/mobile-portrait.js');
 const css=read('public/mobile-portrait.css');
 const index=read('public/index.html');
 assert.match(js,/innerWidth>root\.innerHeight/);
 assert.match(js,/abyssal-mobile-landscape/);
 assert.match(js,/orientation\.lock\('portrait-primary'\)/);
 assert.match(css,/#abyssalPortraitGate/);
 assert.match(index,/mobile-portrait\.css/);
 assert.match(index,/mobile-portrait\.js/);
});
