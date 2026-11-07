'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Map=require('../public/abyssal-map');
const Hardcore=require('../public/abyssal-rift-hardcore');
const World=require('../world-simulation');

// Seven descents connect tiers 0..7. Test a complete generated map for every
// tier rather than verifying only the initial room and the last boss silhouette.
test('all eight Fossa floors have navigable boss entrances, reachable exit sigils and the correct guardian',()=>{
 for(const seed of [42,99,72433,75443]){
  const world=World.createWorldState(1000,'rift');
  world.mapSeed=seed;
  World.initializeWorld(world,1000,()=>.5);
  for(let tier=0;tier<=Hardcore.FINAL_TIER;tier++){
   assert.equal(world.mapTier,tier);
   const layout=World.mapLayoutFor(world);
   assert.equal(layout.tier,tier);
   const start=layout.rooms.find(r=>r.id==='start'),boss=layout.rooms.find(r=>r.id==='boss');
   assert.ok(start&&boss,'tier '+tier+' rooms missing');
   assert.ok(Map.roomPath(layout,'start','boss').length>=5,'tier '+tier+' path disconnected');
   const spawn=Map.startSpawn(layout);
   assert.ok(Map.isWalkable(layout,spawn.x,spawn.y,12),'tier '+tier+' spawn blocked');
   const surfacePortal=layout.portals.surface;
   assert.ok(surfacePortal,'tier '+tier+' missing surface sigil');
   assert.ok(Map.isWalkable(layout,surfacePortal.x,surfacePortal.y,12),'tier '+tier+' surface sigil in rock');
   if(tier<Hardcore.FINAL_TIER){
    const descentPortal=layout.portals.boss;
    assert.ok(descentPortal,'tier '+tier+' missing descent sigil');
    assert.ok(Map.isWalkable(layout,descentPortal.x,descentPortal.y,12),'tier '+tier+' descent sigil in rock');
   }else assert.equal(layout.portals.boss,null,'final Nightmare chamber must not show another descent portal');
   const guardians=World.activateRiftEncounters(world,[{id:'smoke-player',x:boss.x,y:boss.y,hp:100,alive:true}],()=>.5)
    .filter(enemy=>enemy.spawnRoomId==='boss'||enemy.kind===Hardcore.FINAL_KIND||enemy.boss);
   assert.equal(guardians.length,1,'tier '+tier+' should spawn exactly one guardian');
   assert.ok(guardians[0].hp>0,'tier '+tier+' guardian has no health');
   if(tier===Hardcore.FINAL_TIER)assert.equal(guardians[0].kind,Hardcore.FINAL_KIND,'final guardian identity');
   else assert.notEqual(guardians[0].kind,Hardcore.FINAL_KIND,'final guardian appeared too early');
   const hazards=Hardcore.build(layout,tier);
   assert.ok(hazards.every(h=>h.roomId!=='start'),'tier '+tier+' has hazards in safe entrance');
   if(tier===Hardcore.FINAL_TIER){
    const lastRoomHazards=hazards.filter(h=>h.roomId==='boss');
    assert.equal(lastRoomHazards.length,8,'final guardian needs eight genuine tentacle traps');
    assert.ok(lastRoomHazards.every(h=>h.type==='tentacle'&&h.nightmare===true));
   }
   // The authoritative server performs these same reset steps after each
   // validated portal request. Browser CDP smoke separately executes the
   // actual solo transition handler rather than mutating mapTier directly.
   if(tier<Hardcore.FINAL_TIER){
    world.mapTier=tier+1;world.enemies=[];world.orbs=[];world.riftEncountersSeeded=false;world.riftActivatedRooms={};
    World.seedRiftEncounters(world,()=>.5);
   }
  }
 }
});

test('red Kraken-tentacle telegraph grows from faint to solid for at least three seconds without dealing damage',()=>{
 assert.ok(Hardcore.TYPES.tentacle.warning>=3,'warning must last at least three seconds');
 const layout=Map.createLayout('warning-alpha-journey',Hardcore.FINAL_TIER);
 const trap=Hardcore.build(layout,Hardcore.FINAL_TIER).find(h=>h.roomId==='boss'&&h.type==='tentacle');
 assert.ok(trap&&Number.isFinite(trap.sourceX));
 const sample=(fraction)=>{
  const styles=[];
  const context={
   save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},bezierCurveTo(){},ellipse(){},arc(){},fill(){},
   createRadialGradient(){return {addColorStop(){}};},
   stroke(){const match=String(this.strokeStyle).match(/^rgba\(255,54,82,([\d.]+)\)$/);if(match)styles.push(Number(match[1]));}
  };
  const seconds=trap.period-trap.active-trap.warning-trap.offset+trap.warning*fraction;
  const phase=Hardcore.state(trap,seconds);
  assert.equal(phase.phase,'warning');
  assert.equal(Hardcore.hit(trap,trap.x,trap.y,0,phase),false);
  Hardcore.draw(context,[trap],seconds);
  assert.ok(styles.length,'red curved warning is not drawn');
  return styles[0];
 };
 assert.ok(sample(.2)<sample(.8),'red indicator must increase in opacity, not disappear before impact');
});
test('solo descent rebuilds the next cave map instead of reusing the old geometry',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const game=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 assert.match(game,/const nextTier=activeMapTier\+1;setActiveMapDescriptor\(\{seed:activeMapSeed,tier:nextTier\}\)/);
 assert.doesNotMatch(game,/activeMapTier\+=1;setActiveMapDescriptor/);
});
