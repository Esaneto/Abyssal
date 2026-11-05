'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const AbyssalMap=require('../public/abyssal-map.js');
const World=require('../world-simulation.js');

test('400-entity cave navigation remains bounded and inside walkable geometry',()=>{
 const now=9000,world=World.createWorldState(now);
 world.initialized=true;world.mapSeed=73003;world.mapTier=2;world.elapsed=80;world.lastTick=now-50;world.nextBossAt=Infinity;world.commonSpawnTimer=999;world.sideEncounterResolvedTier=2;world.enemies=[];world.nextEnemyId=0;
 const rooms=['shoal','trench','lantern','junction','event','hub','landing','boss'];
 let cursor=0;
 while(world.enemies.length<World.MAX_COMMON_ENEMIES){
  const roomId=rooms[cursor++%rooms.length];
  const enemy=World.spawnEnemy(world,{type:'common',roomId,random:()=>0.37});
  if(!enemy)break;
 }
 // Fill the four reserved boss slots with inert common-shaped entities so the hot path
 // is exercised at the production MAX_ENEMIES=400 without spawning overlapping bosses.
 while(world.enemies.length<World.MAX_ENEMIES){
  const base=world.enemies[world.enemies.length%Math.max(1,world.enemies.length)]||{x:1200,y:600};
  world.enemies.push({id:++world.nextEnemyId,kind:'drifter',x:base.x,y:base.y,r:10,hp:22,maxHp:22,speed:51/1.55,damage:0,value:1,angle:0,phase:0,attackCd:999,vx:0,vy:0,spawnRoomId:'shoal'});
 }
 const map=World.mapLayoutFor(world),room=map.rooms.find(r=>r.id==='junction');
 const player={id:'p1',x:room.x,y:room.y,r:13/1.55,moveSpeed:150/1.55,skinId:'default',alive:true,hp:100,maxHp:100,shieldCharges:0,invulnerableUntil:0};
 const started=performance.now();
 const result=World.tickWorld(world,[player],now,()=>0.31);
 const duration=performance.now()-started;
 assert.equal(world.enemies.length,World.MAX_ENEMIES);
 assert.ok(result.movedEnemyCount>0);
 assert.ok(duration<900,`400-entity cave tick took ${duration.toFixed(1)} ms`);
 for(const enemy of world.enemies)assert.ok(AbyssalMap.isWalkable(map,enemy.x,enemy.y,0),`enemy ${enemy.id} left cave geometry`);
});
