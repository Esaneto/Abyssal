const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Scale=require('../public/creature-scale.js');
const EnemyAI=require('../public/enemy-ai.js');
const World=require('../world-simulation.js');

test('health starts at twenty percent and increases ten points every two minutes',()=>{
  for(let step=0;step<=8;step++){
    assert.equal(Scale.scaledHealth(600,step*120),120+60*step);
    if(step<8)assert.equal(Scale.scaledHealth(600,step*120+119.999),120+60*step);
  }
  assert.equal(Scale.scaledHealth(600,3600),600);
  assert.equal(Scale.scaledHealth(1,0),1);
});

test('health ramp preserves damage fraction and is idempotent',()=>{
  const enemy={fullHp:600,hp:60,maxHp:120,damageRevision:0};
  assert.equal(Scale.applyHealthRamp(enemy,120),true);
  assert.equal(enemy.hp,90);
  assert.equal(enemy.maxHp,180);
  assert.equal(Scale.applyHealthRamp(enemy,120),false);
  assert.equal(Scale.applyHealthRamp(enemy,960),true);
  assert.equal(enemy.hp,300);
  assert.equal(enemy.maxHp,600);
  enemy.hp=0;
  assert.equal(Scale.applyHealthRamp(enemy,1000),false);
  assert.equal(enemy.hp,0);
});

test('all common species meet minimum length, all bosses and companions are capped',()=>{
  assert.equal(Scale.DIVER_METERS,1.8);
  for(const [kind,length] of Object.entries(Scale.MONSTER_METERS)){
    assert.ok(length>=Scale.MIN_HOSTILE_METERS,kind);
    assert.ok(Scale.creatureCollisionRadius(10,null,kind)>0,kind);
  }
  for(const [kind,length] of Object.entries(Scale.BOSS_METERS))assert.ok(length>=4&&length<=8,kind);
  for(const id of Object.keys(Scale.ADULT_METERS))assert.ok(Scale.companionMeters(id)>=.5&&Scale.companionMeters(id)<=3,id);
  assert.equal(Scale.companionMeters('reefshark'),3);
});

test('server spawns use catalogue health and shared physical scale',()=>{
  const world=World.createWorldState(Date.now(),'classic');
  world.elapsed=0;
  const shark=World.spawnEnemy(world,{type:'common',kindOverride:'whiteShark',position:{x:138,y:138},initial:true,random:()=>.2});
  assert.ok(shark);
  assert.equal(shark.fullHp,600);
  assert.equal(shark.hp,120);
  assert.equal(shark.r,Scale.creatureCollisionRadius(24,null,'whiteShark')*EnemyAI.WORLD_ZOOM);
  world.elapsed=960;
  const boss=World.spawnEnemy(world,{type:'boss',kindOverride:'kraken',position:{x:138,y:138},random:()=>.2});
  assert.ok(boss);
  assert.equal(boss.hp,Scale.CLASSIC_HP.kraken);
});

test('presets allow ten skills with exactly one shot',()=>{
  const base=require('../public/abyssal-solo-base.js');
  const others=base.BUFFS.slice(0,12);
  const result=base.normalizePresets({pve:['photon','electric',...others],pvp:others});
  for(const mode of ['pve','pvp']){
    assert.equal(result[mode].length,10);
    assert.equal(result[mode].filter(id=>base.SHOTS.includes(id)).length,1);
  }
  assert.equal(result.pve[0],'photon');
  assert.equal(result.pvp[0],'electric');
});
