'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Evasion=require('../public/specimen-evasion.js');
const Rarity=require('../public/specimen-rarity.js');
test('rarity wheel gives 40/30/15/10/5 and never selects locked mission skins',()=>{
 const pool=['solar','thorn','voidwing','atolla','gharial','greensnake'];
 const cases=[[.10,'solar'],[.399,'solar'],[.40,'thorn'],[.69,'thorn'],[.70,'voidwing'],[.849,'voidwing'],[.85,'atolla'],[.949,'atolla'],[.95,'gharial'],[.999,'gharial']];
 for(const [number,expected] of cases)assert.equal(Rarity.roll(pool,()=>number),expected);
 assert.equal(Rarity.roll(['greensnake'],()=>.5),null);
 assert.deepEqual(Rarity.WEIGHTS,{common:40,uncommon:30,rare:15,epic:10,legendary:5});
});
test('companion avoids an enemy directly between itself and an orb',()=>{
 const threat={x:21,y:0,r:8,hp:100,vx:0,vy:0};
 const move=Evasion.steer({position:{x:0,y:0},target:{x:100,y:0},enemies:[threat],speed:50,dt:.2,radius:7,clearance:14});
 assert.ok(move.x<0||Math.abs(move.y)>5,'companion should not swim directly through threat');
});
test('companion retreats even when it is already at the player position',()=>{
 const threat={x:4,y:0,r:12,hp:100};
 const move=Evasion.steer({position:{x:0,y:0},target:{x:0,y:0},enemies:[threat],speed:50,dt:.2,radius:7,clearance:12});
 assert.ok(Math.hypot(move.x,move.y)>0,'must evade instead of stopping at dangerous target');
});
test('companion defers dangerous orbs without cancelling safe rewards',()=>{
 const pos={x:0,y:0},player={x:0,y:0},enemies=[{x:50,y:0,r:15,hp:100}];
 const safe={id:2,x:0,y:95},guarded={id:1,x:50,y:0};
 assert.equal(Evasion.bestOrb(pos,[guarded,safe],player,150,enemies,8,20)?.id,2);
 assert.equal(Evasion.bestOrb(pos,[guarded],player,150,enemies,8,20),null);
});
test('purple orbs and short paralysis are configured at the source',()=>{
 const fs=require('node:fs');
 const game=fs.readFileSync(require.resolve('../public/game.js'),'utf8');
 const server=fs.readFileSync(require.resolve('../server.js'),'utf8');
 assert.match(game,/ctx\.fillStyle='#bc79ff'/);
 assert.match(server,/enemy\.paralyzedUntil=Math\.max\(Number\(enemy\.paralyzedUntil\)\|\|0,now\+100\)/);
});
