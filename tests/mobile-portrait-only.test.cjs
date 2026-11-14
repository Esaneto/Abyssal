'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Android native build permits both orientations',()=>{
 const cfg=read('scripts/configure-android.cjs');
 assert.match(cfg,/android:screenOrientation="fullUser"/);
 assert.match(cfg,/SCREEN_ORIENTATION_FULL_USER/);
 assert.doesNotMatch(cfg,/android:screenOrientation="landscape"/);
});

test('installed web app permits both orientations',()=>{
 const manifest=JSON.parse(read('public/manifest.webmanifest'));
 assert.equal(manifest.orientation,'any');
});

test('mobile browser adapts gameplay without blocking landscape',()=>{
 const js=read('public/mobile-portrait.js');
 const css=read('public/mobile-portrait.css');
 const index=read('public/index.html');
 assert.match(js,/innerWidth>root\.innerHeight/);
 assert.match(js,/abyssal-handheld-landscape/);
 assert.doesNotMatch(js,/orientation\.lock\('portrait-primary'\)/);
 assert.doesNotMatch(css,/#abyssalPortraitGate/);
 assert.match(index,/mobile-portrait\.css/);
 assert.match(index,/mobile-portrait\.js/);
});
