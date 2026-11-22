'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');

test('spotlight shows one centered menu with only adjacent faded choices',()=>{
 const runtime=read('public/abyssal-exploration-runtime.js'),css=read('public/abyssal-cockpit-stations.css');
 new vm.Script(runtime,{filename:'abyssal-exploration-runtime.js'});
 assert.match(runtime,/const state=distance===0\?'is-active':distance===1\?'is-next':distance===count-1\?'is-prev':'is-distant'/);
 assert.match(runtime,/CONSOLE_BUTTONS\.forEach\(\(option,index\)=>rail\.append\(createStationKey\(option,index\)\)\)/);
 assert.match(runtime,/key\.setAttribute\('aria-pressed',String\(state==='is-active'\)\)/);
 assert.match(runtime,/if\(state==='is-distant'\)\{key\.hidden=true;key\.tabIndex=-1/);
 assert.doesNotMatch(runtime,/abyss-station-loop-copy|const mobileLoop=|rail\.dataset\.infinite/);
 assert.match(css,/\.abyss-station-key\.is-prev/);
 assert.match(css,/\.abyss-station-key\.is-next/);
 assert.match(css,/\.abyss-station-key\.is-active/);
 assert.match(css,/\.abyss-station-key\.is-distant\{display:none!important\}/);
});
test('touch swipes, horizontal wheel, arrows and keyboard navigate circularly',()=>{
 const runtime=read('public/abyssal-exploration-runtime.js');
 assert.match(runtime,/CONSOLE_BUTTONS\[\(\(i\+offset\)%count\+count\)%count\]\.station/);
 assert.match(runtime,/const prev=step\(-1,'‹','Estação anterior'\),next=step\(1,'›','Próxima estação'\)/);
 assert.match(runtime,/touchstart/);assert.match(runtime,/touchend/);
 assert.match(runtime,/passive:false/);
 assert.match(runtime,/e\.key==='ArrowLeft'\|\|e\.key==='ArrowRight'/);
});
test('mobile and landscape retain cockpit visor and selector simultaneously',()=>{
 const mobile=read('public/mobile-portrait.css'),css=read('public/abyssal-cockpit-stations.css');
 const html=read('public/index.html');
 assert.match(mobile,/Android station navigation v303/);
 assert.match(mobile,/grid-template-columns:44px minmax\(0,1fr\) 44px!important/);
 assert.doesNotMatch(mobile,/rail\.dataset\.infinite/);
 assert.match(css,/grid-template-columns:minmax\(0,\.78fr\) minmax\(0,1\.42fr\) minmax\(0,\.78fr\)/);
 assert.match(css,/abyss-visor-expanded/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(html,/abyssal-exploration-runtime\.js\?v=3\.6\.154\.loop/);
 assert.match(html,/mobile-portrait\.css\?v=3\.6\.154\.loop/);
});
