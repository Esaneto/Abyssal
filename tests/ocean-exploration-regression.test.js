'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const eco=require('../public/abyssal-open-sea-ecology.js');
const resources=require('../public/abyssal-resource-fields.js');
const config=require('../public/abyssal-exploration-config.js');
const research=require('../public/abyssal-research-system.js');

test('open-sea fauna inhabit defined zones and behavior is not automatic pursuit',()=>{
 assert.ok(eco.ZONES.length>=5); // Only reachable geological biomes are listed.
 const animal={id:9,x:100,y:100,homeX:100,homeY:100,angle:0,hp:70,maxHp:70,wildlifeMode:'passive'};
 const diver={x:170,y:100,alive:true,hp:100};
 assert.equal(eco.decide(animal,[diver],0,100).mode,'flee');
 assert.equal(eco.decide({...animal,wildlifeMode:'aggressive'},[diver],0,100).mode,'attack');
 assert.equal(eco.decide({...animal,wildlifeMode:'aggressive'},[{...diver,x:900}],0,100).mode,'patrol');
});

test('curated geological resources stream only in Mar Aberto and keep Fossas untouched',()=>{
 assert.equal(resources.ENABLED,true);
 assert.deepEqual(resources.create('unit-world','classic',4800,3000,90),[]);
 assert.equal(resources.eligible({id:'3',type:'salvageMetal',x:200,y:220},200,220).reason,'invalid-node');
 const ores=resources.streamNear('unit-world',4000,8000,1800);
 assert.deepEqual(ores,resources.streamNear('unit-world',4000,8000,1800));
});
test('combat technologies require lab research and legacy purchases migrate',()=>{
 assert.equal(config.RESEARCH.dash.slot,'E');
 assert.equal(config.RESEARCH.pulse.slot,'Q');
 for(const id of ['burst','ricochet','spread','power','range','photonRay']){
  assert.ok(config.RESEARCH[id],id);
  assert.equal(research.unlocked(id,{}),false);
 }
 assert.equal(research.migrateLegacy({}, {pulse:1,dash:1}).levels.pulse,1);
});

test('online gameplay integrates authoritative pickup, study and survival',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const game=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 const online=fs.readFileSync(path.join(__dirname,'../public/online.js'),'utf8');
 assert.match(server,/socket\.on\('exploration-collect'/);
 assert.match(server,/ResourceFields\.eligible\(node,p\.x,p\.y,u\.resourceInventory,115,chosenTool\)/);
 assert.match(server,/socket\.on\('exploration-study'/);
 assert.match(server,/ExplorationConfig\.gasConsumption\(depth,1\)/);
 assert.match(online,/function explorationCollect\(id,callback\)/);
 assert.match(game,/function resonanceAvailable\(id,mode='pve'\)/);
});
