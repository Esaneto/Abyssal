'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');

test('exactly three cockpit stations are visible, with two truly hidden outside the rail',()=>{
 const runtime=read('public/abyssal-exploration-runtime.js'),css=read('public/abyssal-cockpit-stations.css');
 new vm.Script(runtime,{filename:'abyssal-exploration-runtime.js'});
 assert.match(runtime,/return \[0,1,2,-2,-1\]\[distance\]/);
 assert.match(runtime,/const slot=spotlightSlot\(index,center\)/);
 assert.match(runtime,/key\.dataset\.slot=String\(slot\)/);
 assert.match(runtime,/if\(offscreen\)\{key\.tabIndex=-1;key\.setAttribute\('aria-hidden','true'\)/);
 assert.match(runtime,/CONSOLE_BUTTONS\.forEach\(\(option,index\)=>rail\.append\(createStationKey\(option,index\)\)\)/);
 assert.doesNotMatch(runtime,/abyss-station-loop-copy|const mobileLoop=|rail\.dataset\.infinite/);
 for(const slot of [-2,-1,0,1,2])assert.ok(css.includes('[data-slot="'+slot+'"]'),'missing slot '+slot);
 assert.match(css,/left:17%!important/);
 assert.match(css,/left:50%!important/);
 assert.match(css,/left:83%!important/);
 assert.match(css,/visibility:hidden!important/);
 assert.match(css,/transition:left \.40s/);
 assert.doesNotMatch(css,/\.abyss-station-key\.is-distant\{display:none!important\}/);
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
 assert.match(css,/position:relative!important/);
 assert.match(css,/display:block!important/);
 assert.match(css,/overflow:hidden!important/);
 assert.match(mobile,/\.abyss-visor-expanded \.abyss-control-deck\.abyss-station-deck/);
 assert.match(css,/abyss-visor-expanded/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(html,/abyssal-exploration-runtime\.js\?v=3\.6\.154\.loop/);
 assert.match(html,/mobile-portrait\.css\?v=3\.6\.154\.loop/);
});
