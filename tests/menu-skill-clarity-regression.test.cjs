'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const Standard=require('../public/skin-standard.js');
const DiverArt=require('../public/diver-art.js');

test('Nova wave starts at the rifle muzzle on client and authoritative server',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.match(game,/const muzzle=DIVER_ART\?\.muzzle\?\.\(player\.x,player\.y,player\.r,novaAngle\)/);
 assert.match(game,/x:muzzle\.x\/W,y:muzzle\.y\/H/);
 assert.match(game,/spawnNovaVisual\(muzzle\.x,muzzle\.y,novaRange/);
 assert.match(server,/const muzzle=DiverArt\.muzzle\(shooter\.x,shooter\.y,shooter\.r,heading\)/);
 assert.match(server,/shooter\.novaConeOrigin=muzzle/);
 assert.match(server,/centerX=authoritativeMuzzleX,centerY=authoritativeMuzzleY/);
 const origin=DiverArt.muzzle(100,200,14,0);
 assert.ok(origin.x>100);
});

test('portal letters curve with live underwater currents and the submarine is real canvas art',()=>{
 const menu=read('public/abyssal-menu-ocean.js'),html=read('public/index.html'),scene=read('public/ocean-menu-scenery.js');
 assert.match(menu,/currents\.bezierCurveTo\(b\.x,b\.y,c\.x,c\.y,d\.x,d\.y\)/);
 assert.match(menu,/currents\.setLineDash\(/);
 assert.match(menu,/const direction=s\.kind==='solo'\?-1:1/);
 assert.match(scene,/function drawSubmarine\(canvas,width,height\)/);
 assert.match(scene,/draw,drawSubmarine/);
 assert.match(html,/id="menuOceanSubmarine"/);
 assert.doesNotMatch(html,/id="menuOceanHint"/);
});

test('mobile route joystick stays analog, buttons stay native, and arrows are absent',()=>{
 const menu=read('public/abyssal-menu-ocean.js'),html=read('public/index.html'),css=read('public/abyssal-menu-v2.css');
 assert.match(menu,/pad\.classList\.add\('ocean-joystick'\)/);
 assert.match(menu,/joystickX=dx\/length\*scale/);
 assert.match(menu,/#menuOceanMobilePad/);
 assert.match(css,/#menuOceanMobilePad\.ocean-joystick/);
 assert.doesNotMatch(html,/data-ocean-move=/);
 assert.doesNotMatch(css,/@keyframes ocean-v2-kick/);
});

test('cloud expands with Fossas plant irregular geometry, no repeated ring effect',()=>{
 const game=read('public/game.js');
 const a=game.indexOf('function spawnPoisonPlantCloudVisual(');
 const b=game.indexOf('function spawnSkinActiveVisual(',a);
 const source=game.slice(a,b);
 assert.match(source,/type:'poison-plant-cloud'/);
 assert.doesNotMatch(source,/type:'ring'/);
 assert.match(game,/shapeCount=36/);
 assert.match(game,/variation=\.84/);
 assert.match(game,/const grow=Math\.min\(1/);
});

test('pulse and pressure ranges double and push gains 1.5x distance',()=>{
 assert.equal(Standard.ACTIVE.push.range,330);
 assert.equal(Standard.ACTIVE.pulse.range,360);
 const game=read('public/game.js'),server=read('server.js');
 assert.match(game,/e\.kbVx=dx\/d\*430/);
 assert.match(server,/e\.kbVx=dx\/d\*645/);
 assert.match(server,/target\.skinPushImpulse=\{dx:dx\/d\*93\/WORLD_ZOOM/);
 assert.match(game,/function updateSmoothSkinPush\(dt\)/);
});

test('defense protects diver and companion under one translucent bubble',()=>{
 const game=read('public/game.js'),server=read('server.js'),online=read('public/online.js');
 assert.equal(Standard.ACTIVE.shield.duration,2);
 assert.match(game,/type:'specimen-shield-bubble'/);
 assert.match(game,/player\.invuln=Math\.max\(Number\(player\.invuln\)\|\|0,2\)/);
 assert.match(server,/player\.specimenShieldUntil=until/);
 assert.match(server,/player\.invulnerableUntil=Math\.max/);
 assert.match(server,/emit\('skin-shield-bubble'/);
 assert.match(online,/socket\.on\('skin-shield-bubble'/);
});

test('skills have didactic descriptions with passive, active and recovery',()=>{
 for(const id of ['reefshark','aberration','riftSmileRelic','violet','saltcroc']){
  const label=Standard.describe(id);
  assert.match(label,/Passiva:/);
  assert.match(label,/Ativa do Espécime \[R\]:/);
  assert.match(label,/Recarga:/);
 }
});
