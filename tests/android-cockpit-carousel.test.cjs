'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('five real cockpit stations support native horizontal touch scrolling and infinite copies on Android',()=>{
 const runtime=read('public/abyssal-exploration-runtime.js');
 const mobile=read('public/mobile-portrait.css');
 const stations=read('public/abyssal-cockpit-stations.css');
 new vm.Script(runtime,{filename:'abyssal-exploration-runtime.js'});
 assert.match(runtime,/const mobileLoop=document\.documentElement\.classList\.contains\('abyssal-handheld'\)/);
 assert.match(runtime,/if\(mobileLoop\)for\(const option of CONSOLE_BUTTONS\)rail\.append\(createStationKey\(option,true\)\)/);
 assert.match(runtime,/rail\.dataset\.infinite='true'/);
 assert.match(runtime,/const period=firstReal\.offsetLeft-firstCopy\.offsetLeft/);
 assert.match(runtime,/rail\.scrollLeft\+=center<left\?period:-period/);
 assert.match(runtime,/key\.setAttribute\('aria-hidden','true'\);key\.tabIndex=-1/);
 assert.doesNotMatch(runtime,/rail\.setPointerCapture/);
 assert.match(mobile,/\.abyss-station-deck>\.abyss-station-rail\{/);
 assert.match(mobile,/touch-action:pan-x!important/);
 assert.match(stations,/touch-action:pan-x/);
 assert.doesNotMatch(stations,/touch-action:pan-y/);
});

test('arrow and keyboard navigation wrap on both ends without disabling the buttons',()=>{
 const runtime=read('public/abyssal-exploration-runtime.js');
 assert.match(runtime,/CONSOLE_BUTTONS\[\(\(i\+offset\)%count\+count\)%count\]\.station/);
 assert.match(runtime,/const prev=step\(-1,'‹','Estação anterior'\),next=step\(1,'›','Próxima estação'\)/);
 assert.doesNotMatch(runtime,/b\.disabled=stationIndex/);
 assert.match(runtime,/e\.key==='ArrowLeft'\|\|e\.key==='ArrowRight'/);
});

test('Android portrait and landscape overrides prevent old four-column station deck layout',()=>{
 const mobile=read('public/mobile-portrait.css');
 const html=read('public/index.html');
 const sw=read('public/offline-sw.js');
 assert.match(mobile,/Android station navigation v303/);
 assert.match(mobile,/grid-template-columns:44px minmax\(0,1fr\) 44px!important/);
 assert.match(mobile,/overflow-x:auto!important;overflow-y:hidden!important/);
 assert.match(mobile,/@media\(orientation:portrait\)/);
 assert.match(mobile,/@media\(orientation:landscape\)/);
 assert.match(html,/abyssal-exploration-runtime\.js\?v=3\.6\.154\.loop/);
 assert.match(html,/mobile-portrait\.css\?v=3\.6\.154\.loop/);
 assert.match(sw,/combat-engagement-v315/);
});
