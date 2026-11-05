'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Simulation=require('../world-simulation.js');
const Map=require('../public/abyssal-map.js');

test('authoritative common and boss spawns are inside their cave chambers',()=>{
 const world=Simulation.createWorldState(1000,'rift');
 const layout=Simulation.mapLayoutFor(world);
 const common=Simulation.spawnEnemy(world,{type:'common',random:()=>.2});
 const boss=Simulation.spawnEnemy(world,{type:'boss',kindOverride:'boss',random:()=>.2});
 assert.ok(common&&boss);
 assert.equal(Map.isWalkable(layout,common.x,common.y,12),true);
 assert.equal(Map.isWalkable(layout,boss.x,boss.y,12),true);
 assert.equal(boss.spawnRoomId,'boss');
});

test('authoritative elite metadata sends elite creatures to the optional chamber',()=>{
 const world=Simulation.createWorldState(1000,'rift');
 world.bossesDefeated=7;
 world.activeEventId='black_current';world.eventEndsAt=30;
 const values=[.2,.01,.2,.2,.2,.2,.2,.2,.2],random=()=>values.shift()??.2;
 const elite=Simulation.spawnEnemy(world,{type:'common',random});
 assert.ok(elite);
 assert.ok(elite.eliteId);
 assert.equal(elite.spawnRoomId,'elite');
});

test('map cache is deterministic and excluded from serialized deploy state',()=>{
 const world=Simulation.createWorldState(1234,'rift');
 const a=Simulation.mapLayoutFor(world),b=Simulation.mapLayoutFor(world);
 assert.equal(a,b);
 const json=JSON.parse(JSON.stringify(world));
 assert.equal(Object.prototype.hasOwnProperty.call(json,'__mapLayout'),false);
 assert.equal(Number.isFinite(Number(json.mapSeed)),true);
});

test('rift encounters do not respawn and a new tier receives one fresh population',()=>{
 const world=Simulation.createWorldState(5000,'rift'),player={id:'p',x:620,y:260,alive:true,hp:100,maxHp:100,moveSpeed:150};
 Simulation.initializeWorld(world,5000,()=>.3);
 world.enemies=[];world.lastTick=5000;
 for(let i=1;i<=80;i++)Simulation.tickWorld(world,[player],5000+i*50,()=>.3);
 assert.equal(world.enemies.length,0);
 world.mapTier=1;world.riftEncountersSeeded=false;
 const result=Simulation.tickWorld(world,[player],9100,()=>.3);
 assert.ok(result.spawnedEnemies.length>40);
 assert.equal(result.spawnedBosses.length,1);
});
