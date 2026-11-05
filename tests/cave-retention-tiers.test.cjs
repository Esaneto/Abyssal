'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const AbyssalMap=require('../public/abyssal-map.js');
const Rules=require('../public/abyssal-expedition-rules.js');
const World=require('../world-simulation.js');

test('tier 0 remains downward while deeper tiers vary laterally from the same seed',()=>{
 const tier0=AbyssalMap.createLayout(73191,0);
 const tier1=AbyssalMap.createLayout(73191,1);
 const tier1Again=AbyssalMap.createLayout(73191,1);
 assert.equal(tier0.version,5);
 assert.deepEqual(tier1.rooms.map(r=>[r.id,r.x,r.y]),tier1Again.rooms.map(r=>[r.id,r.x,r.y]));
 assert.ok(tier1.rooms.some((room,i)=>room.x!==tier0.rooms[i].x));
 const main=['start','shoal','trench','lantern','junction','hub'];
 const ys=main.map(id=>tier1.rooms.find(r=>r.id===id).y);
 assert.deepEqual([...ys].sort((a,b)=>a-b),ys);
 assert.equal(tier1.portals.boss.type,'tier-descent');
 assert.equal(tier1.portals.boss.unlockedAfterBosses,2);
});

test('physical cave depth changes ecology and room risk profiles',()=>{
 const map=AbyssalMap.createLayout(99,0);
 const shoal=map.rooms.find(r=>r.id==='shoal');
 const boss=map.rooms.find(r=>r.id==='boss');
 const elite=map.rooms.find(r=>r.id==='elite');
 assert.ok(Rules.zoneForRoom(boss,0).minBosses>Rules.zoneForRoom(shoal,0).minBosses);
 assert.equal(AbyssalMap.roomProfile(elite,0).risk,5);
 assert.ok(Rules.roomDensityCap(boss,2,3)>0);
 const shallow=Rules.roomWeights(shoal,0,null);
 const deep=Rules.roomWeights(boss,0,null);
 assert.ok(shallow.drifter>0&&deep.lurker>0);
 assert.notDeepEqual(shallow,deep);
});

test('side encounter is deterministic per expedition seed and tier',()=>{
 const a=Rules.sideEncounterFor(12345,3);
 const b=Rules.sideEncounterFor(12345,3);
 assert.deepEqual(a,b);
 assert.ok(['treasure','ambush','trap'].includes(a.type));
 assert.ok(a.name&&a.reward&&a.risk);
});

test('forced physical room controls fauna spawn location and remains walkable',()=>{
 const world=World.createWorldState(1000,'rift');
 world.initialized=true;world.mapSeed=401;world.mapTier=2;world.bossesDefeated=2;world.enemies=[];world.nextEnemyId=0;
 const enemy=World.spawnEnemy(world,{type:'common',roomId:'landing',random:()=>0.42});
 const map=World.mapLayoutFor(world);
 assert.ok(enemy);
 assert.equal(enemy.spawnRoomId,'landing');
 assert.ok(AbyssalMap.isWalkable(map,enemy.x,enemy.y,Math.max(1,enemy.r/10)));
 assert.ok(enemy.value>=1);
});

test('density selector keeps upper and lower portal layers separated',()=>{
 const world=World.createWorldState(2000,'rift');world.initialized=true;world.mapSeed=812;world.mapTier=0;world.enemies=[];
 const map=World.mapLayoutFor(world),upper=map.rooms.find(r=>r.id==='junction'),lower=map.rooms.find(r=>r.id==='landing');
 const upperRoom=World.chooseDensitySpawnRoom(world,[{x:upper.x,y:upper.y,alive:true}],()=>0.2);
 const lowerRoom=World.chooseDensitySpawnRoom(world,[{x:lower.x,y:lower.y,alive:true}],()=>0.2);
 assert.ok(['shoal','trench','lantern','junction','event','hub'].includes(upperRoom));
 assert.ok(['landing','boss'].includes(lowerRoom));
});

test('entering the optional event room resolves exactly one deterministic encounter per tier',()=>{
 const now=5000,world=World.createWorldState(now,'rift');
 world.initialized=true;world.mapSeed=12001;world.mapTier=1;world.elapsed=12;world.lastTick=now-50;world.nextBossAt=Infinity;world.commonSpawnTimer=999;world.enemies=[];world.orbs=[];world.nextEnemyId=0;world.nextOrbId=0;world.sideEncounterResolvedTier=-1;
 const map=World.mapLayoutFor(world),room=map.rooms.find(r=>r.id==='event');
 const player={id:'p1',x:room.x,y:room.y,r:13/1.55,moveSpeed:150/1.55,skinId:'default',alive:true,hp:100,maxHp:100,shieldCharges:0,invulnerableUntil:0};
 const first=World.tickWorld(world,[player],now,()=>0.4);
 assert.ok(first.sideEncounter);
 assert.equal(world.sideEncounterResolvedTier,1);
 const second=World.tickWorld(world,[player],now+50,()=>0.4);
 assert.equal(second.sideEncounter,null);
});
