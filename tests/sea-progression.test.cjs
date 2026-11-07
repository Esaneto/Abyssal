'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Sea=require('../public/sea-progression.js');
const Simulation=require('../world-simulation.js');
const AI=require('../public/enemy-ai.js');

test('Mar Aberto caps the total to 100, with 99 common slots and a boss slot',()=>{
 assert.equal(Sea.MAX_SEA_ENEMIES,100);
 assert.equal(Sea.MAX_SEA_COMMON_ENEMIES,99);
 const world=Simulation.createWorldState(1000,'classic');
 Simulation.initializeWorld(world,1000,()=>.3);
 for(let i=0;i<250;i++)Simulation.spawnEnemy(world,{type:'common',random:()=>.3});
 assert.equal(Simulation.countCommons(world),99);
 assert.equal(world.enemies.length,99);
 const boss=Simulation.spawnEnemy(world,{type:'boss',random:()=>.3});
 assert.ok(boss,'reserve permits boss to spawn despite the full regular cap');
 assert.equal(world.enemies.length,100);
 assert.equal(Simulation.spawnEnemy(world,{type:'common',random:()=>.3}),null);
 assert.equal(Simulation.spawnEnemy(world,{type:'boss',random:()=>.3}),null);
});

test('common sea monster HP increases progressively with survival time',()=>{
 const base=AI.statsForKind('brute');
 const samples=[0,60,300,600,1200,1500,3000].map(seconds=>{
  const world=Simulation.createWorldState(1000,'classic');
  world.elapsed=seconds;
  const enemy=Simulation.spawnEnemy(world,{type:'common',kindOverride:'brute',initial:true,random:()=>.3});
  return {seconds,hp:enemy.hp,xp:Simulation.xpValueForEnemy(world,enemy),factor:enemy.seaXpMultiplier};
 });
 assert.equal(samples[0].hp,base.hp,'baseline remains familiar at the start');
 for(let i=1;i<samples.length;i++){
  assert.ok(samples[i].hp>=samples[i-1].hp,'health cannot decline over time');
  assert.ok(samples[i].xp>=samples[i-1].xp,'XP cannot decline over time');
 }
 assert.equal(samples[3].factor,1.8,'10 min gives 80 percent more XP');
 assert.equal(samples[3].hp,Math.round(base.hp*2.2),'10 min gives 120 percent more HP');
 assert.equal(samples[5].hp,Math.round(base.hp*4),'25 min caps health at 4x');
 assert.equal(samples[5].factor,3,'25 min caps XP at 3x');
 assert.deepEqual(samples[5],{...samples[6],seconds:1500},'growth is capped after 25 minutes');
});

test('bosses and Fossas enemy rules remain unaffected',()=>{
 const sea=Simulation.createWorldState(1000,'classic');sea.elapsed=1800;
 const boss=Simulation.spawnEnemy(sea,{type:'boss',random:()=>.2});
 assert.equal(boss.seaXpMultiplier,1,'boss does not inherit common-monster XP multiplier');
 assert.equal(boss.hp,AI.statsForKind(boss.kind).hp,'boss keeps its established cycle scaling');
 const rift=Simulation.createWorldState(1000,'rift');rift.elapsed=1800;
 const enemy=Simulation.spawnEnemy(rift,{type:'common',kindOverride:'drifter',initial:true,random:()=>.2});
 assert.ok(enemy);
 assert.equal(enemy.hp,AI.statsForKind('drifter').hp);
 assert.equal(enemy.seaXpMultiplier,1);
 assert.equal(Simulation.xpValueForEnemy(rift,enemy),Simulation.xpValueForEnemy({...rift,mode:'classic'},{...enemy,seaXpMultiplier:1}));
 assert.equal(Simulation.MAX_ENEMIES,400,'Fossas keeps its existing world capacity');
});

test('shared game client and server load the same sea progression rules',()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 const root=path.resolve(__dirname,'..');
 const game=fs.readFileSync(path.join(root,'public/game.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
 const server=fs.readFileSync(path.join(root,'world-simulation.js'),'utf8');
 assert.match(html,/sea-progression\.js\?v=/);
 assert.ok(html.indexOf('sea-progression.js?v=')<html.indexOf('game.js?v='),'rules load before the game');
 assert.match(game,/SEA_PROGRESSION\?\.strengthenCommon\?\.\(data,elapsed\)/);
 assert.match(game,/SEA_PROGRESSION\?\.scaleXp\?\.\(xpValue,e\.seaXpMultiplier\)/);
 assert.match(server,/SeaProgression\.strengthenCommon\(stats,world\.elapsed\)/);
 assert.match(server,/SeaProgression\.scaleXp\(base,enemy\.seaXpMultiplier\)/);
});
