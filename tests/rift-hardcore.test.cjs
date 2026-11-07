const test=require('node:test');const assert=require('node:assert/strict');
const H=require('../public/abyssal-rift-hardcore');
const Map=require('../public/abyssal-map');
const AI=require('../public/enemy-ai');
const W=require('../world-simulation');
const Reward=require('../rift-rewards');

test('Fossas hazards are deterministic, diverse, and absent from safe entrance',()=>{
 const layout=Map.createLayout(72433,7);
 const a=H.build(layout,7),b=H.build(layout,7);
 assert.equal(a,b);
 assert.ok(a.length>=12,'multiple rooms have multiple threats');
 assert.ok(!a.some(h=>h.roomId==='start'));
 assert.deepEqual(Object.keys(H.TYPES).sort(),['poisonPlant','tentacle','volcano','vortex']);
 for(const t of ['volcano','poisonPlant','tentacle','vortex'])assert.ok(a.some(h=>h.type===t),t);
 for(const removed of ['fumarole','rockfall','pressure','electric','lure','spikes'])assert.ok(!a.some(h=>h.type===removed),removed+' must be removed');
 for(const h of a){assert.ok(h.radius>0);assert.ok(Number.isFinite(h.x)&&Number.isFinite(h.y));}
});
test('every trap has a telegraph, active hit interval and later becomes harmless',()=>{
 const layout=Map.createLayout(99,6);
 for(const h of H.build(layout,6)){
  const onset=h.period-h.active-h.warning-h.offset;
  if(h.warning>0)assert.equal(H.state(h,onset+h.warning*.5).phase,'warning',h.id);
   else assert.equal(H.state(h,onset+.01).phase,'active',h.id+' has no poison telegraph');
  assert.equal(H.state(h,onset+h.warning+h.active*.5).phase,'active',h.id);
  assert.equal(H.state(h,onset+h.warning+h.active+.01).phase,'idle',h.id);
  assert.equal(H.hit(h,h.x,h.y),true,'center inside trap '+h.id);
 }
});
test('tentacle warning collision uses exactly the same line geometry as the attack',()=>{
 const trap={type:'tentacle',x:500,y:600,angle:0,length:320,radius:82};
 assert.equal(H.hit(trap,500,600),true);
 assert.equal(H.hit(trap,500,660),false);
 const e={id:'final',x:0,y:0,hp:100,maxHp:100,riftAttackSerial:1};
 const mark=H.bossMark(e,[{x:90,y:0,alive:true},{x:400,y:200,alive:true}],1000);
 assert.equal(mark.x,90);assert.equal(mark.y,0);
 assert.ok(mark.hitAt>1000);
 assert.equal(H.bossHit(mark,90,0),true);
 assert.equal(H.bossHit(mark,9999,9999),false);
});
test('the last layer summons the stationary Pesadelo Roxo as the final octopus boss',()=>{
 const w=W.createWorldState(0,'rift');w.mapSeed=75443;w.mapTier=H.FINAL_TIER;w.initialized=true;W.seedRiftEncounters(w);
 const layout=W.mapLayoutFor(w),room=layout.rooms.find(r=>r.id==='boss');
 const spawned=W.activateRiftEncounters(w,[{id:'p',x:room.x,y:room.y,hp:100,alive:true}],()=>.5);
 const boss=spawned.find(b=>b.kind===H.FINAL_KIND);
 assert.ok(boss);
 assert.equal(boss.x,room.x);assert.equal(boss.y,room.y);
 assert.equal(AI.statsForKind(H.FINAL_KIND).speed,0);
 assert.equal(AI.chooseBossKind([],()=>.5,0)!==H.FINAL_KIND,true,'classic bosses unchanged');
});
test('moldy golden final chest grants one hundred thousand coins and a guaranteed skin once',()=>{
 const user={coins:200,ownedSkins:['default']};
 const chest=Reward.grant(user,'final:run42:7',{final:true});
 assert.equal(chest.final,true);
 const first=Reward.open(user,chest.id,()=>0);
 assert.equal(first.ok,true);assert.equal(first.reward.type,'final');
 assert.equal(first.reward.amount,H.FINAL_CHEST_COINS);
 assert.ok(first.reward.skinId);assert.ok(user.ownedSkins.includes(first.reward.skinId));
 assert.equal(user.coins,100200);
 assert.equal(Reward.grant(user,'final:run42:7',{final:true}).id,chest.id);
 const again=Reward.open(user,chest.id);
 assert.equal(again.duplicate,true);assert.equal(user.coins,100200);
});
test('checkpoint chooses the chamber and keeps its origin near the chamber entrance',()=>{
 const layout=Map.createLayout(733,1),chamber=layout.rooms.find(r=>r.id==='trench');
 assert.ok(chamber);
 const cp=H.checkpoint(layout,chamber.x,chamber.y,'start');
 assert.equal(cp.roomId,chamber.id);
 assert.ok(Math.hypot(cp.x-chamber.x,cp.y-chamber.y)<chamber.ry);
});