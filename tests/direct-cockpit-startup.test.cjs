'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('startup opens a single navigable cockpit after login, retaining legacy bridges',()=>{
 const html=read('public/index.html'),runtime=read('public/abyssal-exploration-runtime.js'),ocean=read('public/abyssal-menu-ocean.js');
 assert.match(html,/<html lang="pt-BR" class="abyssal-startup">/);
 assert.match(html,/html\.abyssal-startup #app\{opacity:0!important/);
 assert.match(runtime,/openedPrimaryCockpit=true;openWorkshop\(\)/);
 assert.match(runtime,/submarineWorkshopBtn'\)\?\.addEventListener\('click',openWorkshop\)/);
 assert.match(read('public/game.js'),/cockpitNav\?\.open\?\.\(\)/);
 assert.match(ocean,/const visible=hatchVisible\(\)/);
 assert.match(read('public/online.js'),/openLogin\(\{startup:true\}\)/);
 assert.match(html,/id="loginGuestBtn"/);
 assert.match(html,/abyssal-deep-menu\.js/);
 assert.doesNotMatch(read('public/offline-ui.js'),/window\.location\.reload\(/);
});
