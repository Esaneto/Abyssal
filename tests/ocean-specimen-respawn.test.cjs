'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const OceanRespawn=require('../public/abyssal-ocean-respawn.js');
const WorldSimulation=require('../world-simulation.js');
const Specimens=require('../public/specimen-system.js');

test('every defeated wild specimen returns after exactly five minutes, independently',()=>{
 assert.equal(OceanRespawn.RESPAWN_MS,300000);
 const t=10_000_000,tracker=OceanRespawn.createTracker();
 assert.equal(tracker.ready('3:2:f0',t),true);
 assert.equal(tracker.mark('3:2:f0',t),true);
 assert.equal(tracker.mark('3:2:f1',t+60000),true);
 assert.equal(tracker.remainingMs('3:2:f0',t+1000),299000);
 assert.equal(tracker.ready('3:2:f0',t+299999),false);
 assert.equal(tracker.ready('3:2:f1',t+299999),false);
 assert.equal(tracker.ready('3:2:f2',t+299999),true);
 assert.equal(tracker.ready('3:2:f0',t+300000),true);
 assert.equal(tracker.ready('3:2:f1',t+300000),false);
 assert.equal(tracker.ready('3:2:f1',t+360000),true);
 assert.equal(tracker.size(),0);
});

test('unloaded fauna is not counted as dead, and expiry records can be pruned',()=>{
 const t=25_000_000,tracker=OceanRespawn.createTracker();
 assert.equal(tracker.mark('',t),false);
 assert.equal(tracker.size(),0);
 assert.equal(tracker.ready('7:4:f0',t+300000),true);
 tracker.mark('7:4:f0',t);
 tracker.mark('7:4:f1',t+150000);
 tracker.prune(t+300000);
 assert.equal(tracker.size(),1);
 assert.equal(tracker.ready('7:4:f1',t+449999),false);
 tracker.clear();
 assert.equal(tracker.size(),0);
});

test('server tracks deaths by stable stream ID only in Mar Aberto',()=>{
 const now=42_000_000,sea=WorldSimulation.createWorldState(now,'open-sea');
 const rift=WorldSimulation.createWorldState(now,'rift');
 const swimmer={id:98,streamId:'0:1:f2'};
 assert.equal(WorldSimulation.markOceanSpecimenDeath(rift,swimmer,now),false);
 assert.equal(WorldSimulation.markOceanSpecimenDeath(sea,{id:99},now),false);
 assert.equal(WorldSimulation.markOceanSpecimenDeath(sea,swimmer,now),true);
 assert.equal(sea.oceanRespawn.ready('0:1:f2',now+299999),false);
 assert.equal(sea.oceanRespawn.ready('0:1:f2',now+300000),true);
 assert.equal(WorldSimulation.createWorldState(now,'open-sea').oceanRespawn.ready('0:1:f2',now+1),true);
});

test("equipped companions use the same five-minute respawn contract as wild fauna",()=>{
 assert.equal(Specimens.BASE_RESPAWN,300);
 assert.equal(Specimens.respawnSeconds(0),300);
 assert.equal(Specimens.respawnSeconds(5000),300);
 assert.equal(Specimens.MAX_RESPAWN_REDUCTION,0);
});

test('saved online room keeps independent death deadlines after serialization and reconnect',()=>{
 const start=12_000_000;
 const world=WorldSimulation.createWorldState(start,'open-sea');
 assert.equal(WorldSimulation.markOceanSpecimenDeath(world,{streamId:'5:3:f0'},start),true);
 assert.equal(WorldSimulation.markOceanSpecimenDeath(world,{streamId:'5:3:f1'},start+120000),true);
 const restored=JSON.parse(JSON.stringify(world));
 assert.equal(typeof restored.oceanRespawn.ready,'undefined');
 assert.equal(WorldSimulation.markOceanSpecimenDeath(restored,{streamId:'5:3:f2'},start+180000),true);
 assert.equal(restored.oceanRespawn.ready('5:3:f0',start+299999),false);
 assert.equal(restored.oceanRespawn.ready('5:3:f0',start+300000),true);
 assert.equal(restored.oceanRespawn.ready('5:3:f1',start+300000),false);
 assert.equal(restored.oceanRespawn.ready('5:3:f1',start+420000),true);
 assert.equal(restored.oceanRespawn.ready('5:3:f2',start+479999),false);
 assert.equal(restored.oceanRespawn.ready('5:3:f2',start+480000),true);
});

test('all death paths and client loading use the same contract',()=>{
 const load=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const sim=load('world-simulation.js'),server=load('server.js');
 const game=load('public/game.js'),html=load('public/index.html');
 assert.match(sim,/markOceanSpecimenDeath\(world,victim,now\)/);
 assert.match(sim,/!world\.oceanRespawn\.ready\(specimen\.id,now\)/);
 assert.match(server,/WorldSimulation\.markOceanSpecimenDeath\(w,enemy,now\)/);
 assert.match(game,/soloOceanRespawn\?\.mark\(e\.streamId,Date\.now\(\)\)/);
 assert.match(game,/soloOceanRespawn\?\.mark\(prey\.streamId,now\)/);
 assert.match(game,/!soloOceanRespawn\.ready\(specimen\.id,respawnNow\)/);
 assert.match(game,/s\.respawnAt=Date\.now\(\)\+specimenProgressStats\(\)\.respawnSeconds\*1000/);
 assert.match(server,/stillDefeated=p\.specimenAlive===false&&now</);
 assert.ok(html.indexOf('abyssal-ocean-respawn.js')<html.indexOf('game.js'));
});
