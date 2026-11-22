'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('five stations integrate with the production cockpit and offline shell',()=>{
 const html=read('public/index.html'),sw=read('public/offline-sw.js'),css=read('public/abyssal-cockpit-stations.css');
 assert.match(html,/abyssal-exploration-runtime\.js/);
 assert.match(html,/abyssal-cockpit-stations\.css/);
 assert.match(sw,/'abyssal-cockpit-stations\.css'/);
 assert.doesNotMatch(html,/abyssal-cockpit-navigation\.js/);
 assert.doesNotMatch(html,/abyssal-menu-interactions\.js/);
 assert.match(html,/ARSENAL DE ECOS/);
 assert.doesNotMatch(html,/CATÁLOGO DE ESPÉCIMES/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/\[data-station="arsenal"\]/);
});
test('core cockpit controller owns navigation, preserving account and research handlers',()=>{
 const src=read('public/abyssal-exploration-runtime.js');
 new vm.Script(src,{filename:'abyssal-exploration-runtime.js'});
 const ids=['social','cabine','laboratorio','arsenal','perfil'];
 for(const id of ids)assert.match(src,new RegExp("station:'"+id+"'"));
 assert.match(src,/function selectStation\(id\)/);
 assert.match(src,/function openEchoCatalog\(/);
 assert.match(src,/function renderConsoleUtility\(/);
 assert.match(src,/navigateEmbedded\('shopScreen'\)/);
 assert.match(src,/navigateCommand\('hudEditor'\)/);
 assert.match(src,/AbyssalResearchTree\?\.mount/);
 assert.match(src,/studyCombatEnergy\(/);
 assert.match(src,/window\.AbyssalCockpitNavigation=Object\.freeze/);
 assert.match(src,/select:selectStation/);
 assert.match(src,/restoreEmbeddedCatalog\(\)/);
 assert.match(src,/abyss-station-rail/);
});
test('tour and copy use the renamed Echo identity and old handlers remain stable',()=>{
 const game=read('public/game.js'),tour=read('public/abyssal-menu-tour.js');
 new vm.Script(tour,{filename:'abyssal-menu-tour.js'});
 new vm.Script(game,{filename:'game.js'});
 assert.match(game,/ARSENAL DE ECOS/);
 assert.match(game,/ESPÉCIME ABATIDO|ECO ABATIDO/);
 assert.match(tour,/nav\.select\(target\)/);
 assert.match(tour,/nav\.routeCommand\('wardrobe'\)/);
 assert.match(tour,/nav\.routeScreen\('resonanceScreen'\)/);
 assert.match(tour,/localStorage\.setItem\(KEY,'1'\)/);
});

test('restored panoramic cockpit is the only menu implementation and offline cache rotates',()=>{
 const html=read('public/index.html');
 const sw=read('public/offline-sw.js');
 const css=read('public/abyssal-cockpit-stations.css');
 assert.match(html,/abyssal-cockpit-stations\.css\?v=3\.6\.154\.loop/);
 assert.doesNotMatch(html,/abyssal-deep-menu(?:-cinematic|-native)?\.(?:js|css)/);
 assert.doesNotMatch(sw,/abyssal-deep-menu/);
 assert.match(sw,/2026-11-21-squad-terrain-v307/);
 assert.match(css,/Refinamento discreto da cabine panorâmica/);
 assert.match(css,/prefers-reduced-motion/);
});
