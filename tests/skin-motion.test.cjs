'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Motion=require('../public/skin-motion.js'),Catalog=require('../public/abyssal-curated-skins.js');
test('every curated and signature skin has bounded deterministic moving anatomical pose',()=>{
 const all=[...Catalog.items,...['default','kraken','aberration','leviathan','maw','devourer','riftSmileRelic'].map(id=>({id}))];
 const poses=[];
 for(const skin of all){
  const pose=Motion.pose(skin,1600,.8),future=Motion.pose(skin,1970,.8);
  assert.deepEqual(pose,Motion.pose(skin,1600,.8),skin.id+' pose is non-deterministic');
  assert.notDeepEqual([pose.bob,pose.roll,pose.tail,pose.fin,pose.phase],[future.bob,future.roll,future.tail,future.fin,future.phase],skin.id+' is static');
  assert.ok(Object.hasOwn(Motion.PROFILES,pose.family),skin.id+' unknown family');
  assert.ok(pose.stretchX>.80&&pose.stretchX<1.20,skin.id+' stretches too far');
  assert.ok(pose.stretchY>.80&&pose.stretchY<1.20,skin.id+' stretches too far');
  assert.ok(Math.abs(pose.roll)<.15,skin.id+' spins unnaturally');
  poses.push(pose.phase);
 }
 assert.equal(new Set(poses.map(n=>n.toFixed(4))).size,poses.length,'duplicate skin rhythms');
});
test('locomotion has idle and moving degrees without affecting hitboxes',()=>{
 const slow=Motion.pose({id:'eagleray',family:'ray'},800,0),fast=Motion.pose({id:'eagleray',family:'ray'},800,1);
 assert.ok(Math.abs(slow.bob)<Math.abs(fast.bob));
 assert.ok(Math.abs(slow.fin)<Math.abs(fast.fin));
 assert.ok(Math.abs(slow.roll)<Math.abs(fast.roll));
 assert.ok(Number.isFinite(fast.tail)&&Number.isFinite(fast.arms));
});
test('game renders procedural pose on marine and signature creatures, previews only visible cards',()=>{
 const marine=fs.readFileSync('public/marine-art.js','utf8');
 const game=fs.readFileSync('public/game.js','utf8');
 assert.match(marine,/AbyssalSkinMotion\?\.pose/);
 assert.match(game,/AbyssalSkinMotion\?\.pose/);
 assert.match(game,/function animateVisibleShopSkins\(/);
 assert.match(game,/getBoundingClientRect\(\)/);
 assert.match(game,/if\(!screen\|\|screen\.hidden\|\|document\.hidden\)/);
 assert.match(game,/const limit=isMobileDevice\(\)\?2:4/);
});
