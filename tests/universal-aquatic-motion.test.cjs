'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Motion=require('../public/skin-motion.js');
const EnemyAI=require('../public/enemy-ai.js');
const Catalog=require('../public/abyssal-curated-skins.js');

test('every current player skin and hostile species resolves to an aquatic rig',()=>{
 for(const skin of Catalog.items){
  const family=Motion.familyForEntity({skin});
  assert.ok(Motion.PROFILES[family],`${skin.id} has no rig`);
 }
 for(const kind of Object.keys(EnemyAI.ENEMY_STATS)){
  const family=Motion.familyForEntity({kind});
  assert.ok(Motion.PROFILES[family],`${kind} has no rig`);
  assert.ok(Motion.ENEMY_FAMILY[kind],`${kind} needs an explicit biological family`);
 }
 assert.equal(Motion.familyForEntity({kind:'future-abyssal-shark'}),'shark');
 assert.equal(Motion.familyForEntity({kind:'future-giant-octopus'}),'octopus');
});

test('anatomical orientation cannot turn a creature upside down',()=>{
 for(const family of Object.keys(Motion.PROFILES)){
  const limit=Motion.ORIENTATION_LIMIT[family];
  for(let angle=-Math.PI*4;angle<=Math.PI*4;angle+=.071){
   const view=Motion.anatomicalOrientation(angle,family);
   assert.ok(view.facing===1||view.facing===-1);
   assert.ok(Math.abs(view.pitch)<=limit+1e-12,`${family} exceeded pitch limit`);
   assert.ok(Math.cos(view.pitch)>.9,`${family} rendered upside down`);
  }
 }
 assert.ok(Motion.ORIENTATION_LIMIT.octopus<Motion.ORIENTATION_LIMIT.eel,'octopus should remain more lateral');
});

test('tracker derives direction from displacement and smoothly enters and leaves motion',()=>{
 const tracker=Motion.createTracker({maxEntries:4});
 const actor={id:'online:7',kind:'whiteShark',x:100,y:100,angle:Math.PI,nominalSpeed:100};
 const first=tracker.sample(actor,1000);
 const sameReference=tracker.sample({...actor,x:108},1100);
 assert.equal(first,sameReference,'tracker must reuse actor state instead of allocating each frame');
 const accelerating=sameReference.locomotion;
 assert.ok(accelerating>.12,'movement did not increase locomotion');
 assert.equal(sameReference.motionAngle,0,'movement direction should override backward aim');
 tracker.sample({...actor,x:118},1200);
 const moving=tracker.sample({...actor,x:128},1300).locomotion;
 assert.ok(moving>accelerating,'acceleration was not smooth');
 const stopped=tracker.sample({...actor,x:128},1400).locomotion;
 assert.ok(stopped<moving&&stopped>0,'deceleration should be gradual');
 assert.equal(tracker.size(),1);
 tracker.clear();
 assert.equal(tracker.size(),0);
});

test('idle, moving and attack poses stay deterministic and visually distinct',()=>{
 const skin={id:'kraken',family:'octopus'};
 const idle=Motion.pose(skin,2400,0,0);
 const moving=Motion.pose(skin,2400,1,0);
 const attack=Motion.pose(skin,2400,1,1);
 assert.deepEqual(idle,Motion.pose(skin,2400,0,0));
 assert.ok(Math.abs(moving.arms)>Math.abs(idle.arms));
 assert.ok(attack.recoil>0);
 assert.notEqual(attack.stretchY,moving.stretchY);
 assert.notEqual(Motion.pose(skin,2800,0,0).phase,idle.phase,'idle must keep breathing');
});

test('renderer integration covers enemies, bosses, local and remote players without gameplay mutation',()=>{
 const game=fs.readFileSync('public/game.js','utf8');
 const motion=fs.readFileSync('public/skin-motion.js','utf8');
 assert.match(game,/creatureVisualMotion\(skin,kind,enemyState/);
 assert.match(game,/drawFinalBoss\(c,finalBossVisualState,animationTime\)/);
 assert.match(game,/visualId:onlineMode\?'player:self':'player:solo'/);
 assert.match(game,/visualId:'peer:'/);
 assert.match(game,/remoteCreatureAttackUntil\.set/);
 assert.match(game,/player\.visualAttackUntil=performance\.now\(\)\+140/);
 assert.match(game,/hostileSpriteCache/);
 assert.doesNotMatch(game,/const phaseSlot/);
 assert.match(game,/const hostileSpriteState=/);
 assert.match(game,/renderPad.*continue/);
 assert.doesNotMatch(motion,/\.hp\s*=|\.damage\s*=|collision|hitbox/i);
});

test('400-creature tracker hot path is allocation-conscious and bounded',()=>{
 const tracker=Motion.createTracker({maxEntries:640});
 const actors=Array.from({length:400},(_,i)=>({id:'perf-'+i,kind:i%5?'drifter':'kraken',x:i,y:i%17,angle:0,nominalSpeed:90}));
 const started=process.hrtime.bigint();
 for(let frame=0;frame<180;frame++)for(const actor of actors){actor.x+=.8;tracker.sample(actor,frame*16.667);}
 const elapsedMs=Number(process.hrtime.bigint()-started)/1e6;
 assert.equal(tracker.size(),400);
 assert.ok(elapsedMs<250,`aquatic tracker took ${elapsedMs.toFixed(1)} ms for 72,000 samples`);
 const source=fs.readFileSync('public/skin-motion.js','utf8');
 assert.doesNotMatch(source,/Object\.assign\(result/);
 assert.match(source,/state\.phaseTime=now\+state\.phaseOffset/);
});
