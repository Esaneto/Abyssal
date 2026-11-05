'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Simulation=require('../world-simulation.js');
const Map=require('../public/abyssal-map.js');

test('authoritative common and boss spawns are inside their cave chambers',()=>{
 const world=Simulation.createWorldState(1000);
 const layout=Simulation.mapLayoutFor(world);
 const common=Simulation.spawnEnemy(world,{type:'common',random:()=>.2});
 const boss=Simulation.spawnEnemy(world,{type:'boss',kindOverride:'boss',random:()=>.2});
 assert.ok(common&&boss);
 assert.equal(Map.isWalkable(layout,common.x,common.y,12),true);
 assert.equal(Map.isWalkable(layout,boss.x,boss.y,12),true);
 assert.equal(boss.spawnRoomId,'boss');
});

test('authoritative elite metadata sends elite creatures to the optional chamber',()=>{
 const world=Simulation.createWorldState(1000);
 world.bossesDefeated=7;
 world.activeEventId='black_current';world.eventEndsAt=30;
 const values=[.2,.01,.2,.2,.2,.2,.2,.2,.2],random=()=>values.shift()??.2;
 const elite=Simulation.spawnEnemy(world,{type:'common',random});
 assert.ok(elite);
 assert.ok(elite.eliteId);
 assert.equal(elite.spawnRoomId,'elite');
});

test('map cache is deterministic and excluded from serialized deploy state',()=>{
 const world=Simulation.createWorldState(1234);
 const a=Simulation.mapLayoutFor(world),b=Simulation.mapLayoutFor(world);
 assert.equal(a,b);
 const json=JSON.parse(JSON.stringify(world));
 assert.equal(Object.prototype.hasOwnProperty.call(json,'__mapLayout'),false);
 assert.equal(Number.isFinite(Number(json.mapSeed)),true);
});
