'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('regular white shark vision is half the shared shark vision range without nerfing the boss',()=>{
 const ai=read('public/enemy-ai.js');
 assert.match(ai,/enemy\?\.kind==='whiteShark'\?SHARK_VISION\.range\*\.5:SHARK_VISION\.range/);
 assert.match(ai,/d>sharkVisionRange\(enemy\)/);
 assert.match(ai,/distance<=sharkVisionRange\(enemy\)\*2\.5/);
});

test('each solo submarine section has 1000 HP',()=>{
 const game=read('public/game.js');
 assert.match(game,/const SOLO_HULL_HP=1000,/);
});

test('enemy-caused movement slow is capped at 100 ms in solo and authoritative simulation',()=>{
 const game=read('public/game.js');
 const world=read('world-simulation.js');
 assert.match(game,/neuro:100/);
 assert.match(game,/Math\.min\(100,skill\.neurotoxinMs\)/);
 assert.match(game,/Math\.min\(100,Number\(data\.neurotoxinMs\)\)/);
 assert.match(world,/neuro:100/);
 assert.match(world,/Math\.min\(100,Math\.max\(0,Number\(skill\.neurotoxinMs\)\|\|0\)\)/);
});
