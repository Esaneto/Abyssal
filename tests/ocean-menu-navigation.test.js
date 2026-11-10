'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=name=>fs.readFileSync(path.join(__dirname,'../public',name),'utf8');

test('restored swimming menu loads instead of the expedition hub overlay',()=>{
 const html=src('index.html');
 assert.match(html,/<script src="abyssal-menu-ocean\.js\?v=/);
 assert.doesNotMatch(html,/<script src="abyssal-expedition-hub\.js/);
 assert.doesNotMatch(html,/<link rel="stylesheet" href="abyssal-expedition-hub\.css/);
 for(const id of ['menuOceanDiver','menuOceanDiverCanvas','menuOceanSubmarine','divePortalBtn','openSeaPortalBtn','riftPortalBtn'])
  assert.match(html,new RegExp('id="'+id+'"'));
});
test('classic triggers are preserved exactly once but not exposed as separate currents',()=>{
 const html=src('index.html'),menu=src('abyssal-menu-ocean.js'),css=src('abyssal-menu-navigation.css');
 for(const id of ['playBtn','onlineBtn']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
  assert.match(html,new RegExp('<button id="'+id+'"[^>]*hidden'));
 }
 assert.match(css,/#playBtn/);assert.match(css,/#onlineBtn/);
 assert.doesNotMatch(menu,/\{id:'playBtn',x:/);
 assert.doesNotMatch(menu,/\{id:'onlineBtn',x:/);
});
test('left current selects classic solo or the existing online room browser',()=>{
 const menu=src('abyssal-menu-ocean.js');
 assert.match(menu,/\{id:'divePortalBtn',x:\.19/);
 assert.match(menu,/getElementById\('playBtn'\)\?\.click\(\)/);
 assert.match(menu,/getElementById\('onlineBtn'\)\?\.click\(\)/);
 assert.match(menu,/abyssDiveSoloChoice/);
 assert.match(menu,/abyssDiveOnlineChoice/);
});
test('right current is a separate launch event and Fossas stay independent',()=>{
 const menu=src('abyssal-menu-ocean.js'),game=src('game.js');
 assert.match(menu,/\{id:'openSeaPortalBtn',x:\.81/);
 assert.match(menu,/\{id:'riftPortalBtn',x:\.50/);
 assert.match(menu,/CustomEvent\('abyssal-start-open-sea'\)/);
 assert.match(game,/addEventListener\('abyssal-start-open-sea',[^\n]*requestedRunMode='open-sea'/);
 assert.match(game,/\$\('playBtn'\)\.addEventListener\('click',[^\n]*requestedRunMode='classic'/);
 assert.match(game,/addEventListener\('abyssal-start-rift-solo'/);
});

test('boot renders only one swimmer scene with no flash of a legacy portal layout',()=>{
 const html=src('index.html'),menu=src('abyssal-menu-ocean.js'),css=src('abyssal-menu-navigation.css');
 assert.match(html,/id="menuScreen" class="screen ocean-menu-v2 submarine-menu"/);
 assert.match(css,/not\(\.menu-ready\)/);
 assert.match(menu,/menu\.classList\.add\('menu-ready'\)/);
 assert.equal((html.match(/id="menuOceanStage"/g)||[]).length,1);
 assert.doesNotMatch(html,/abyssal-menu-orbit\.(?:js|css)/);
 assert.doesNotMatch(html,/abyssal-expedition-hub\.(?:js|css)/);
});

test('offline service worker excludes old menu versions and refreshes cache on deploy',()=>{
 const sw=src('offline-sw.js'),offline=src('offline-ui.js');
 assert.doesNotMatch(sw,/['"]abyssal-menu-orbit\.(?:js|css)['"]/);
 assert.doesNotMatch(sw,/['"]abyssal-expedition-hub\.(?:js|css)['"]/);
 assert.match(sw,/single-swimmer-menu-v62-classic-perimeter/);
 assert.match(sw,/'abyssal-menu-navigation\.css'/);
 assert.match(sw,/'abyssal-menu-ocean\.js'/);
 assert.match(sw,/'diver-hitbox\.js'/);
 assert.match(offline,/controllerchange/);
 assert.match(offline,/sessionStorage\.setItem/);
});
