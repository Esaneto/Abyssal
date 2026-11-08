'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const diver=require('../public/diver-art.js');

test('human swim has flexed knees, flowing layered hair, and lowered gun with synchronized muzzle',()=>{
 const source=read('public/diver-art.js'),server=read('server.js');
 assert.match(source,/const knee=\[-28\+4\*kick/);
 assert.match(source,/const locks=female\?46:34/);
 assert.match(source,/c\.translate\(0,GUN_OFFSET_Y\)/);
 assert.equal(diver.GUN_OFFSET_Y,12);
 const m=diver.muzzle(100,200,14,0);
 assert.ok(Math.abs(m.x-141.4)<1e-8);
 assert.ok(Math.abs(m.y-207.2)<1e-8);
 assert.match(server,/DiverArt\.GUN_OFFSET_Y/);
 assert.match(server,/Math\.sin\(shotHeading\)\*below/);
});

test('ocean routes flow out of screen without player-to-portal tethers or circular buttons',()=>{
 const source=read('public/abyssal-menu-ocean.js');
 const css=read('public/abyssal-lab-menu.css');
 assert.match(source,/const direction=s\.kind==='solo'\?-1:1/);
 assert.match(source,/endX=s\.wx\+direction\*w\*\.37/);
 assert.match(source,/currents\.bezierCurveTo\(b\.x,b\.y,c\.x,c\.y,d\.x,d\.y\)/);
 assert.match(source,/if\(s\.kind==='rift'\)continue/);
 assert.match(source,/if\(nearElapsed>\.38\)playEntrance\(nearby\)/);
 assert.match(css,/\.abyss-destination\.abyss-current-entry::before/);
 assert.match(css,/border:0!important;box-shadow:none!important/);
});

test('Fossas are carved at the same coordinates as the real seafloor',()=>{
 const ocean=read('public/abyssal-menu-ocean.js');
 const scene=read('public/ocean-menu-scenery.js');
 assert.match(ocean,/id:'riftPortalBtn',x:\.50,y:\.835/);
 assert.match(scene,/const fissureX=width\*\.50,fissureY=height\*\.835/);
 assert.match(scene,/const mouthX=width\*\.5,mouthY=height\*\.835/);
 assert.match(scene,/const bedY=x=>/);
});

test('mobile gameplay shows more world without forcing a blurry low-DPI buffer',()=>{
 const game=read('public/game.js'),html=read('public/index.html'),sw=read('public/offline-sw.js');
 assert.match(game,/return mobileViewport\?\.48:FAIR_VIEW_REFERENCE\.zoom/);
 assert.match(game,/Math\.sqrt\(3500000\/\(viewW\*viewH\)\)/);
 assert.match(game,/mobileViewport\?2:1\.8/);
 assert.match(html,/abyssal-lab-menu\.css\?v=2026\.11\.8\.14/);
 assert.match(sw,/'abyssal-lab-menu\.css'/);
});

test('all bottom actions share dimensions and lab, profile, and roulette visual identities',()=>{
 const css=read('public/abyssal-lab-menu.css');
 assert.match(css,/\.abyss-ocean-utilities>\.abyss-ocean-utility\{/);
 assert.match(css,/min-height:48px!important/);
 assert.match(css,/#shopScreen #skinGrid \.skin-card \.skin-preview::before/);
 assert.match(css,/#shopScreen #skinGrid \.skin-card>p::before/);
 assert.match(css,/#profileScreen \.profile-modal/);
 assert.match(css,/#wheelScreen \.wheel-modal/);
});
