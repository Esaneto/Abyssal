'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Sim=require('../world-simulation.js');
const CaveMap=require('../public/abyssal-map.js');
const SkinStandard=require('../public/skin-standard.js');
const CuratedSkins=require('../public/abyssal-curated-skins.js');
const Payments=require('../payments.js');
test('fresh and reinitialized expeditions have no inherited XP orbs',()=>{
 const world=Sim.createWorldState(1000,'rift');
 assert.deepEqual(world.orbs,[]);
 assert.equal(world.nextOrbId,0);
 world.orbs.push({id:1,x:200,y:200,value:5});
 Sim.initializeWorld(world,1000,()=>.35);
 assert.deepEqual(world.orbs,[]);
 world.orbs.push({id:2,x:1,y:1,value:5});
 Sim.resetWorldState(world,2000);
 assert.deepEqual(world.orbs,[]);
});
test('Fossas summon real shop specimen IDs on common enemies',()=>{
 const world=Sim.createWorldState(1000,'rift');
 world.mapSeed=CaveMap.seedValue('shop-specimen-encounter');
 Sim.initializeWorld(world,1000,()=>.28);
 const room=Sim.mapLayoutFor(world).rooms.find(r=>r.id==='shoal');
 const player={id:'test',x:room.x,y:room.y,alive:true,hp:100,maxHp:100};
 Sim.tickWorld(world,[player],1050,()=>.28);
 const Rarity=require('../public/specimen-rarity.js');
 const catalog=new Set(Object.keys(SkinStandard.profiles).filter(id=>Rarity.rarityFor(id)));
 assert.ok(world.enemies.length>0);
 assert.ok(world.enemies.every(e=>catalog.has(e.specimenSkinId)));
});
test('XP is reduced and preserves enemy differentiation',()=>{
 const world=Sim.createWorldState(1000,'rift');
 const slow={kind:'drifter',r:10,value:10},heavy={kind:'brute',r:25,value:100};
 assert.ok(Sim.xpValueForEnemy(world,slow)>=1);
 assert.ok(Sim.xpValueForEnemy(world,heavy)>Sim.xpValueForEnemy(world,slow));
 assert.ok(Sim.xpValueForEnemy(world,heavy)<100);
});
test('rarity price and attribute bands agree at purchase and gameplay boundaries',()=>{
 for(const id of ['phantomjelly','bloodmoon','toxic','butterflyray','hawksbill','greenland']){
  assert.equal(SkinStandard.profile(id).percent,12);
  assert.equal(Payments.calculateOrder(id,[]).brlAmount,199);
 }
 for(const id of ['reefshark','hammerhead','saltcroc','blackcaiman']){
  assert.equal(SkinStandard.profile(id).percent,14);
  assert.equal(Payments.calculateOrder(id,[]).brlAmount,499);
 }
 assert.equal(SkinStandard.profile('default').percent,10);
});
test('specimen skill configuration has immediate and periodic values',()=>{
 const A=SkinStandard.ACTIVE;
 assert.equal(A.cloud.damage,50);
 assert.equal(A.cloud.dotDamage,5);
 assert.equal(A.cloud.tickMs,500);
 assert.equal(A.dash.damage,70);
 assert.equal(A.push.damage,60);
 assert.equal(A.pulse.damage,60);
 assert.equal(A.shot.damage,80);
 assert.equal(A.poison.damage,5);
 assert.equal(A.trail.tickMs,500);
});
