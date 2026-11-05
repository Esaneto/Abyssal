'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');

const Rules=require('../public/abyssal-expedition-rules.js');
const Simulation=require('../world-simulation.js');

test('depth zones advance on boss milestones without changing the depth formula',()=>{
  assert.equal(Rules.depthForBosses(0),350);
  assert.equal(Rules.depthForBosses(1),1000);
  assert.equal(Rules.depthForBosses(7),4900);
  assert.equal(Rules.zoneForBosses(0).id,'twilight');
  assert.equal(Rules.zoneForBosses(1).id,'mesopelagic');
  assert.equal(Rules.zoneForBosses(3).id,'midnight');
  assert.equal(Rules.zoneForBosses(5).id,'hadal');
  assert.equal(Rules.zoneForBosses(7).id,'unknown');
});

test('deeper zones make elites more likely while preserving a strict cap',()=>{
  assert.ok(Rules.eliteChance(0)<Rules.eliteChance(3));
  assert.ok(Rules.eliteChance(3)<Rules.eliteChance(7));
  assert.ok(Rules.eliteChance(7,'black_current')<=.24);
  assert.ok(Rules.eliteChance(7,'black_current')>Rules.eliteChance(7));
});

test('elite mutations increase reward and threat without mutating base stats',()=>{
  const base={r:10,hp:100,speed:50,damage:10,value:4,color:'#fff'};
  const armored=Rules.applyEliteStats(base,'carapace');
  const frenzy=Rules.applyEliteStats(base,'frenzy');
  const spectral=Rules.applyEliteStats(base,'spectral');
  assert.deepEqual(base,{r:10,hp:100,speed:50,damage:10,value:4,color:'#fff'});
  assert.ok(armored.hp>base.hp&&armored.value>base.value&&armored.speed<base.speed);
  assert.ok(frenzy.damage>base.damage&&frenzy.speed>base.speed&&frenzy.value>base.value);
  assert.ok(spectral.hp>base.hp&&spectral.value>base.value);
});

test('rare events alter composition, pacing or XP through one shared rules module',()=>{
  assert.equal(Rules.eventSpawnIntervalMultiplier('predator_migration'),.80);
  assert.equal(Rules.eventXpMultiplier('resonance_bloom'),1.35);
  const base=Rules.commonWeights(5,null);
  const migration=Rules.commonWeights(5,'predator_migration');
  const dark=Rules.commonWeights(5,'black_current');
  assert.ok(migration.whiteShark>base.whiteShark);
  assert.ok(dark.lurker>base.lurker);
});

test('authoritative world spawns elite metadata once on entity creation',()=>{
  const world=Simulation.createWorldState(1000);
  world.initialized=true;
  world.bossesDefeated=7;
  world.activeEventId='black_current';
  world.eventEndsAt=30;
  const values=[.5,.01,.2,.2,.2,.2,.2,.2];
  let index=0;
  const random=()=>values[index++]??.2;
  const enemy=Simulation.spawnEnemy(world,{type:'common',random});
  assert.ok(enemy);
  assert.equal(enemy.eliteId,'spectral');
  assert.ok(enemy.hp>0&&enemy.maxHp===enemy.hp);
  assert.ok(enemy.value>=2);
});

test('authoritative depth events expire inside the server world tick',()=>{
  const world=Simulation.createWorldState(1000);
  world.initialized=true;
  world.elapsed=0;
  world.lastTick=1000;
  world.nextBossAt=9999;
  world.commonSpawnTimer=9999;
  world.activeEventId='resonance_bloom';
  world.eventEndsAt=.05;
  world.eventSerial=3;
  const player={id:'p1',x:2400,y:1500,r:13/.78,alive:true,hp:100,maxHp:100,moveSpeed:150/.78,lastPositionAt:1100,clientHidden:true};
  const result=Simulation.tickWorld(world,[player],1100,()=>.5);
  assert.equal(result.eventEnded?.id,'resonance_bloom');
  assert.equal(result.eventEnded?.serial,3);
  assert.equal(world.activeEventId,null);
  assert.equal(world.eventEndsAt,0);
});

test('starting an event stores only compact world state and exposes a reusable descriptor',()=>{
  const world=Simulation.createWorldState(1000);
  world.initialized=true;
  world.bossesDefeated=5;
  world.elapsed=20;
  const seq=[.01,.1];
  let i=0;
  const event=Simulation.startDepthEvent(world,()=>seq[i++]??.1);
  assert.ok(event);
  assert.equal(event.id,'black_current');
  assert.equal(world.activeEventId,'black_current');
  assert.ok(world.eventEndsAt>world.elapsed);
  assert.equal(Simulation.currentDepthEvent(world).id,'black_current');
});
