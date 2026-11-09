'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const game=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');

test('Olho Profundo controls zoom without resizing viewport or modifying hitboxes',()=>{
 assert.match(game,/const bonus=upgrades\?\.abyssEye\?CAMERA_RANGE_MAX:Number\(upgrades\?\.range\)\|\|1/);
 assert.match(game,/return base\/clamp\(bonus,1,CAMERA_RANGE_MAX\)/);
 assert.match(game,/worldZoom\+=\(target-worldZoom\)\*\(1-Math\.exp\(-dt\*11\)\)/);
 assert.match(game,/updateCamera\(\);ctx\.setTransform\(dpr\*worldZoom/);
 assert.match(game,/const visibleWorldW=viewW\/worldZoom,visibleWorldH=viewH\/worldZoom/);
 assert.match(game,/player\.r=13\/GAME_WORLD_ZOOM/);
});

test('Zoom ratios match the existing range upgrade at every level',()=>{
 for(const base of [.78,.48]){
  const v=[0,1,2,3].map(n=>base/Math.pow(1.22,n));
  assert.equal(v.length,4);
  assert.ok(v.every((x,i)=>i===0||x<v[i-1]));
  assert.ok(Math.abs(v[3]*Math.pow(1.22,3)-base)<1e-10);
 }
});

test('Range skill explains the expanded vision and fusion retains zoom',()=>{
 assert.match(game,/Afasta a câmera e amplia a visão e o alcance dos disparos/);
 assert.match(game,/upgrades\?\.abyssEye\?CAMERA_RANGE_MAX/);
});

test('Both client and server allow slow shots to traverse the upgraded range',()=>{
 assert.match(game,/life:upgrades\.abyssEye\?18:Math\.max\(1\.33,maxRange\/Math\.max\(1,shotSpeed\)\+\.12\)/);
 assert.match(server,/lifetime:shot\.modifiers\?\.abyssEye===true\?8:Math\.max\(1\.05,Math\.min\(2\.5,maxDistance\/Math\.max\(1,speed\)\+\.14\)\)/);
 assert.match(server,/const allowedRange=294\*rangeStrength\*rangeMultiplier\/WORLD_ZOOM/);
});
