'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=filename=>fs.readFileSync(path.join(__dirname,'..',filename),'utf8');

test('only one mobile X exists outside scrolling body and it is on the left',()=>{
 const js=read('public/abyssal-exploration-runtime.js');
 const css=read('public/mobile-portrait.css');
 assert.match(js,/const floatingClose=document\.createElement\('button'\)/);
 assert.match(js,/floatingClose\.className='abyss-window-floating-close'/);
 assert.match(js,/heading\.append\(floatingClose,column,status\);visor\.append\(heading\)/);
 assert.match(js,/floatingClose\.addEventListener\('click',returnToCabinMenu\)/);
 assert.doesNotMatch(js,/document\.createElement\('button'\);mobileBack\./);
 assert.match(js,/floatingClose\.hidden=atHome/);
 assert.match(css,/#submarineWorkshop \.abyss-window-floating-close:not\(\[hidden\]\)/);
 assert.match(css,/flex:0 0 44px!important/);
 assert.match(css,/\.abyss-visor-body \.abyss-cockpit-embedded :is\(/);
 assert.match(css,/\.mobile-cockpit-back,\.abyss-station-back/);
});

test('closing an internal window restores the cabin station selector rather than exiting submarine',()=>{
 const js=read('public/abyssal-exploration-runtime.js');
 assert.match(js,/function returnToCabinMenu\(\)\{/);
 assert.match(js,/selectedStation='cabine';workshop\.dataset\.station='cabine'/);
 assert.match(js,/activeConsoleSection='solo';soloConsolePage='home'/);
 assert.match(js,/renderWorkshop\(\);\s*return true;/);
 assert.match(js,/back:backEmbedded,returnToCabinMenu,select:selectStation/);
 assert.match(js,/if\(document\.documentElement\.classList\.contains\('abyssal-handheld'\)\)returnToCabinMenu\(\)/);
 assert.match(js,/const showExterior=\(\)=>/);
});

test('mobile versions and offline cache refresh after navigation correction',()=>{
 const html=read('public/index.html'),sw=read('public/offline-sw.js');
 assert.match(html,/mobile-portrait\.css\?v=3\.6\.154\.loop/);
 assert.match(html,/abyssal-exploration-runtime\.js\?v=3\.6\.154\.loop/);
 assert.match(sw,/2026-11-20-animated-ecos-v306/);
});
