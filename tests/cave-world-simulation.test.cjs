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
 const elite=Simulation.spawnEnemy(world,{type:'elite',roomId:'elite',forceElite:true,random:()=>.2});
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
 const world=Simulation.createWorldState(5000,'rift'),layout=Simulation.mapLayoutFor(world),shoal=layout.rooms.find(room=>room.id==='shoal'),player={id:'p',x:shoal.x,y:shoal.y,alive:true,hp:100,maxHp:100,moveSpeed:150};
 Simulation.initializeWorld(world,5000,()=>.3);
 assert.equal(world.enemies.length,0);
 world.lastTick=5000;
 const first=Simulation.tickWorld(world,[player],5050,()=>.3);
 assert.equal(first.spawnedEnemies.length,7);
 world.enemies=[];
 for(let i=1;i<=80;i++)Simulation.tickWorld(world,[player],5000+i*50,()=>.3);
 assert.equal(world.enemies.length,0);
 world.mapTier=1;world.riftEncountersSeeded=false;
 const result=Simulation.tickWorld(world,[player],9100,()=>.3);
 assert.equal(result.spawnedEnemies.length,7);
 assert.equal(result.spawnedBosses.length,0);
});
