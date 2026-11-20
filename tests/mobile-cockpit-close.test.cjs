'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=filename=>fs.readFileSync(path.join(__dirname,'..',filename),'utf8');

test('all cockpit windows receive a persistent labelled close button outside the scrolling body',()=>{
 const js=read('public/abyssal-exploration-runtime.js');
 const css=read('public/mobile-portrait.css');
 assert.match(js,/const floatingClose=document\.createElement\('button'\)/);
 assert.match(js,/floatingClose\.className='abyss-window-floating-close'/);
 assert.match(js,/heading\.append\(mobileBack,column,status,floatingClose\);visor\.append\(heading\)/);
 assert.match(js,/const body=document\.createElement\('div'\);body\.className='abyss-visor-body'/);
 assert.match(js,/floatingClose\.addEventListener\('click',exitCurrentWindow\)/);
 assert.match(css,/#submarineWorkshop \.abyss-window-floating-close/);
 assert.match(css,/position:absolute!important;display:grid!important/);
 assert.match(css,/min-width:44px!important/);
 assert.match(css,/env\(safe-area-inset-right/);
});

test('back from home exits to the exterior and back from an inner window navigates one level',()=>{
 const js=read('public/abyssal-exploration-runtime.js');
 assert.match(js,/if\(soloConsolePage==='home'\)\{showExterior\(\);return;\}/);
 assert.match(js,/soloConsolePage='home';renderWorkshop\(\);return;/);
 assert.match(js,/backEmbedded\(\);\s*\};/);
 assert.match(js,/mobileBack\.addEventListener\('click',exitCurrentWindow\)/);
 assert.match(js,/showExterior=\(\)=>/);
});

test('mobile assets are refreshed for installed Android offline cache',()=>{
 const html=read('public/index.html'),sw=read('public/offline-sw.js');
 assert.match(html,/mobile-portrait\.css\?v=3\.6\.152\.close/);
 assert.match(html,/abyssal-exploration-runtime\.js\?v=3\.6\.152\.stickyclose/);
 assert.match(sw,/2026-11-20-mobile-cockpit-close-v301/);
});
