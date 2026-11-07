'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Motion=require('../public/skin-motion.js'),Catalog=require('../public/abyssal-curated-skins.js');
test('every skin has a deterministic individual presentation animation without hitbox changes',()=>{
 const src=fs.readFileSync('public/game.js','utf8');
 const base=[{id:'default'},...Catalog.items,
  ...['reefshark','hammerhead','kraken','aberration','angler','maw','leviathan','devourer','electriceel','armoredgator','saltcroc'].map(id=>({id}))];
 const ids=new Set(),motions=new Set();
 for(const skin of base){
  const id=skin.id;
  assert.ok(!ids.has(id),'duplicate skin '+id);ids.add(id);
  const before=Motion.pose(skin,1500),after=Motion.pose(skin,2050);
  assert.deepEqual(Motion.pose(skin,1500),before,'pose must be deterministic');
  for(const key of ['phase','bob','roll','stretchX','stretchY','tail','fin','arms','gait'])assert.ok(Number.isFinite(before[key]),id+' invalid '+key);
  assert.notEqual(before.phase,after.phase,'static motion phase for '+id);
  assert.ok(Math.abs(before.bob)+Math.abs(before.roll)+Math.abs(before.tail)+Math.abs(before.fin)>0,id+' no movement');
  motions.add(before.phase.toFixed(4));
  assert.ok(before.stretchX>.80&&before.stretchX<1.20,id+' non-physical scaling');
  assert.ok(before.stretchY>.80&&before.stretchY<1.20,id+' non-physical scaling');
 }
 assert.ok(motions.size>=Catalog.items.length-2,'species rhythms should not be synchronized');
 assert.match(src,/AbyssalSkinMotion\?\.pose\?\.\(skin,t,1\)/);
 assert.match(src,/animateVisibleShopSkins/);
 assert.match(src,/lowPowerRendering\|\|isMobileDevice\(\)/);
 assert.match(fs.readFileSync('public/marine-art.js','utf8'),/AbyssalSkinMotion\?\.pose/);
});
test('movement profiles distinguish fins, serpentine tails, tentacles, jelly pulses and walking legs',()=>{
 const families=['fish','shark','ray','eel','octopus','squid','jelly','crustacean','mollusc','reptile','benthic','signature'];
 for(const f of families)assert.ok(Motion.PROFILES[f],f);
 const poses=families.map(f=>Motion.pose({id:'test-'+f,family:f},1800));
 assert.ok(Motion.PROFILES.eel.tail>Motion.PROFILES.shark.tail);
 assert.ok(Motion.PROFILES.ray.fin>Motion.PROFILES.shark.fin);
 assert.ok(Motion.PROFILES.jelly.pulse>Motion.PROFILES.crustacean.pulse);
 assert.ok(Motion.PROFILES.crustacean.speed>Motion.PROFILES.mollusc.speed);
 assert.equal(new Set(poses.map(p=>p.phase.toFixed(3))).size,families.length);
 assert.equal(Motion.familyFor('aberration'),'octopus');
 assert.equal(Motion.familyFor('greensnake'),'eel');
 assert.equal(Motion.familyFor('armoredgator'),'crustacean');
});
