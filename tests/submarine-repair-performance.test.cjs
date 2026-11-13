'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const game=fs.readFileSync(path.resolve(__dirname,'../public/game.js'),'utf8');

test('submarine hull repair takes exactly six seconds',()=>{
 assert.match(game,/const SOLO_HULL_REPAIR_SECONDS=6;/);
 assert.match(game,/job\.elapsed=Math\.min\(SOLO_HULL_REPAIR_SECONDS/);
 assert.match(game,/Math\.ceil\(SOLO_HULL_REPAIR_SECONDS-job\.elapsed\)/);
});

test('submarine turrets reuse one visible-enemy candidate list per gameplay frame',()=>{
 assert.match(game,/const soloSubmarineTargetCandidates=\[\];/);
 assert.match(game,/function refreshSoloSubmarineTargetCandidates\(\)/);
 assert.match(game,/const candidates=refreshSoloSubmarineTargetCandidates\(\);/);
 assert.match(game,/soloSubmarineTarget\(id,candidates\)/);
 assert.doesNotMatch(game,/function soloSubmarineTarget\(id\)\{[\s\S]{0,600}for\(const e of enemies\)/);
});

test('submarine area weapons do not clone the entire enemy array before each pulse',()=>{
 const weaponStart=game.indexOf('function fireSoloSubmarineWeapon');
 const weaponEnd=game.indexOf('function updateSoloSubmarine',weaponStart);
 const body=game.slice(weaponStart,weaponEnd);
 assert.doesNotMatch(body,/\[\.\.\.enemies\]/);
 assert.match(body,/for\(const e of enemies\)/);
});

test('submarine targeting avoids square roots until a target has actually been selected',()=>{
 const start=game.indexOf('function soloSubmarineTarget');
 const end=game.indexOf('function clearSoloSubmarinePhotonRay',start);
 const body=game.slice(start,end);
 assert.match(body,/rangeSq=SOLO_SUB_RANGE\*SOLO_SUB_RANGE/);
 assert.match(body,/dSq=dx\*dx\+dy\*dy/);
 assert.doesNotMatch(body,/Math\.hypot/);
});
