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

test('vertical travel keeps side-on skins upright and does not collapse the body',()=>{
 for(const family of Object.keys(Motion.PROFILES)){
  for(const angle of [-Math.PI,-Math.PI/2,-.8,0,.8,Math.PI/2,Math.PI]){
   const orientation=Motion.anatomicalOrientation(angle,family);
   assert.equal(orientation.pitch,0,`${family} must not rotate vertically`);
   assert.equal(Math.abs(orientation.facing),1);
  }
 }
 const tracker=Motion.createTracker({maxEntries:4});
 const swimmer={id:'vertical-swimmer',kind:'whiteShark',x:100,y:100,angle:0,nominalSpeed:90};
 tracker.sample(swimmer,1000);
 const vertical=tracker.sample({...swimmer,y:120},1100);
 assert.equal(vertical.pitch,0);
 assert.equal(vertical.facing,1);
 assert.equal(vertical.facingScale,1);
 const verticalAgain=tracker.sample({...swimmer,y:140},1200);
 assert.equal(verticalAgain.facingScale,1);
 assert.ok(verticalAgain.locomotion>0,'appendages should continue swimming while moving vertically');
 const left=tracker.sample({...swimmer,x:70,y:140},1300);
 assert.equal(left.facing,-1);
 assert.equal(left.facingScale,-1,'turns must not squeeze the animal to zero width');
 assert.equal(left.pitch,0);
});

test('marine and legacy player skins follow mouse aim through 360 degrees',()=>{
 const game=fs.readFileSync('public/game.js','utf8');
 const marine=fs.readFileSync('public/marine-art.js','utf8');
 const legacy=game.slice(game.indexOf('function applyCreatureVisualTransform('),game.indexOf('let enemyCollisionGrid=',game.indexOf('function applyCreatureVisualTransform(')));
 const draw=marine.slice(marine.indexOf('function draw(c,x,y,r,'),marine.indexOf('function drawDetails('));
 assert.match(legacy,/const followsAim=Number\.isFinite\(heading\)/);
 assert.match(legacy,/c\.rotate\(\(followsAim\?heading:0\)/);
 assert.match(legacy,/followsAim\?1:/);
 assert.match(draw,/const facing=followAim\?1:/);
 assert.match(draw,/c\.rotate\(\(followAim&&Number\.isFinite\(angle\)\?angle:0\)/);
 assert.match(game,/getLocalSkinCursorAngle\(\),currentSkinColor\(\),'player'/);
 assert.match(game,/AbyssalMarineArt\.draw\(c,x,y,r,angle,skin,animationTime,hit,visualMotion,liveSkinHeading!==null\)/);
 assert.doesNotMatch(legacy,/c\.rotate\([^;]*motion\.pitch/);
 assert.match(marine,/const movement=root\.AbyssalSkinMotion\?\.pose\?\.\(s,t,1\)/);
});

test('mouse visual heading follows every cardinal direction without changing shot control',()=>{
 const game=fs.readFileSync('public/game.js','utf8');
 const start=game.indexOf('function getLocalSkinCursorAngle(){');
 const end=game.indexOf('function getFiringRange()',start);
 assert.ok(start>0&&end>start,'local visual heading helper is available');
 const helper=game.slice(start,end);
 const makeHeading=(x,y)=>{
  const player={x:100,y:100,r:13,angle:.2},pointer={clientX:x,clientY:y};
  const canvas={getBoundingClientRect:()=>({left:0,top:0})};
  const getter=new Function('player','pointer','canvas','cameraX','cameraY','worldZoom','isMobileDevice',helper+';return getLocalSkinCursorAngle;')(player,pointer,canvas,0,0,1,()=>false);
  return getter();
 };
 for(const [x,y,expected] of [[200,100,0],[100,200,Math.PI/2],[0,100,Math.PI],[100,0,-Math.PI/2],[200,200,Math.PI/4]]){
  assert.ok(Math.abs(makeHeading(x,y)-expected)<1e-9,'mouse heading mismatch at '+x+','+y);
 }
 const controls=game.slice(game.indexOf('function isPcMouseAimMode()'),game.indexOf('function getActiveShotId()'));
 assert.match(controls,/function updateMouseAimFromCursor\(\)/);
 assert.match(controls,/controlAimAngle=Math\.atan2/);
 assert.doesNotMatch(helper,/player\.angle\s*=/);
 assert.doesNotMatch(helper,/controlAimAngle\s*=/);
});

test('marine skins render crisp supersampled contours without changing world-space size',()=>{
 const marine=fs.readFileSync('public/marine-art.js','utf8');
 assert.match(marine,/const requestedScale=followAim\?2\.25:1\.5/);
 assert.match(marine,/Math\.sqrt\(650000\/\(4\*cx\*cy\)\)/);
 assert.match(marine,/canvas\.width=Math\.ceil\(cx\*2\*detailScale\)/);
 assert.match(marine,/entry\.context\.setTransform\(detailScale,0,0,detailScale,0,0\)/);
 assert.match(marine,/entry\.context\.imageSmoothingQuality='high'/);
 assert.match(marine,/const frame=Math\.floor\(\(Number\(t\)\|\|0\)\/\(followAim\?42:68\)\)/);
 assert.match(marine,/c\.drawImage\(entry\.canvas,-entry\.cx,-entry\.cy,entry\.cx\*2,entry\.cy\*2\)/);
 assert.match(marine,/const facing=followAim\?1:/);
 assert.match(marine,/const movement=root\.AbyssalSkinMotion\?\.pose\?\.\(s,t,1\)/);
});

test('enemy and boss rigs point toward actual displacement in every direction',()=>{
 const testCases=[['drifter',100,0,0],['whiteShark',0,100,Math.PI/2],['kraken',-100,0,Math.PI],['leviathan',0,-100,-Math.PI/2],['maw',100,100,Math.PI/4]];
 for(const [kind,dx,dy,expected] of testCases){
  const tracker=Motion.createTracker();
  const actor={id:'mob-'+kind,kind,x:200,y:200,angle:0,nominalSpeed:90};
  tracker.sample(actor,1000);
  let pos=null;
  for(let i=1;i<=22;i++){
   pos=tracker.sample({...actor,x:200+dx*i/22,y:200+dy*i/22},1000+i*16);
  }
  const difference=Math.atan2(Math.sin(pos.heading-expected),Math.cos(pos.heading-expected));
  assert.ok(Math.abs(difference)<.08,kind+' heading missed actual movement by '+difference);
  assert.ok(Math.abs(pos.facingScale)===1,'heading may not flatten creature');
 }
});

test('idle monsters retain heading; wraparound turns take the shortest arc',()=>{
 const tracker=Motion.createTracker();
 const entity={id:'elite',kind:'whiteSharkBoss',x:200,y:200,angle:Math.PI-0.04};
 tracker.sample(entity,1000);
 const idle=tracker.sample(entity,1016);
 assert.equal(idle.heading,Math.PI-.04,'idle monsters must not reset heading');
 const moving=tracker.sample({...entity,x:190,y:199.4},1032);
 assert.ok(Math.abs(moving.heading-Math.PI)<.1,'heading should transition near pi rather than spinning a full turn');
 const still=tracker.sample({...entity,x:190,y:199.4},1048);
 assert.equal(still.heading,moving.heading,'stopping must preserve travel orientation');
});

test('live hostile sprite cache applies heading once, not inside cached artwork',()=>{
 const game=fs.readFileSync('public/game.js','utf8');
 const draw=game.slice(game.indexOf('function drawCreature('),game.indexOf('const boss=BOSS_KINDS.includes(kind)',game.indexOf('function drawCreature(')));
 assert.match(draw,/const movingEnemyHeading=!playerCreature&&renderContext===ctx/);
 assert.match(draw,/Number\.isFinite\(visualMotion\?\.heading\)\?visualMotion\.heading/);
 assert.match(draw,/applyCreatureVisualTransform\(c,visualMotion,r,movingEnemyHeading\)/);
 assert.match(draw,/hostileSpriteState\.__visualMotion=visualMotion/);
 assert.match(draw,/drawCreature\(sprite\.center,sprite\.center,r,0/);
 assert.match(draw,/kind!==RIFT_HARDCORE\?\.FINAL_KIND/);
 assert.match(game,/const renderPad=e\.r\*1\.42\*/);
});
