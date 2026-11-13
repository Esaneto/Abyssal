'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
test('startup opens the exterior menu, with the cockpit available only on explicit entry',()=>{
 const html=read('public/index.html'),runtime=read('public/abyssal-exploration-runtime.js'),ocean=read('public/abyssal-menu-ocean.js');
 assert.match(html,/<html lang="pt-BR" class="abyssal-startup">/);
 assert.match(html,/html\.abyssal-startup #app\{opacity:0!important/);
 assert.match(html,/body:not\(\.abyss-hatch-navigation\) #menuScreen\.ocean-menu-v2\{display:none!important/);
 assert.match(runtime,/openedPrimaryCockpit=true;showExterior\(\)/);
 assert.match(html,/AbyssalCockpitNavigation\.showExterior\(\)/);
 assert.match(runtime,/submarineWorkshopBtn'\)\?\.addEventListener\('click',openWorkshop\)/);
 assert.match(read('public/game.js'),/AbyssalCockpitNavigation\?\.showExterior\?\.\(\);document\.body\.classList\.add\('abyss-hatch-navigation'\)/);
 assert.match(ocean,/const visible=hatchVisible\(\)/);
 assert.match(read('public/online.js'),/screen\.hidden=false;window\.AbyssalRevealStartup\?\.\(\)/);
 assert.doesNotMatch(read('public/offline-ui.js'),/window\.location\.reload\(/);
});
