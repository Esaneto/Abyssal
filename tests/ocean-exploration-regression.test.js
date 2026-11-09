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
 assert.ok(eco.ZONES.length>=6);
 const animal={id:9,x:100,y:100,homeX:100,homeY:100,angle:0,hp:70,maxHp:70,wildlifeMode:'passive'};
 const diver={x:170,y:100,alive:true,hp:100};
 assert.equal(eco.decide(animal,[diver],0,100).mode,'flee');
 assert.equal(eco.decide({...animal,wildlifeMode:'aggressive'},[diver],0,100).mode,'attack');
 assert.equal(eco.decide({...animal,wildlifeMode:'aggressive'},[{...diver,x:900}],0,100).mode,'patrol');
});

test('resource deposits are reproducible, restricted to habitat resources',()=>{
 const a=resources.create('unit-world','classic',4800,3000,90),b=resources.create('unit-world','classic',4800,3000,90);
 assert.deepEqual(a,b);
 assert.equal(a.length,90);
 for(const row of a){
  assert.ok(eco.habitatAt(row.x,row.y).resources.includes(row.type));
  assert.ok(config.RESOURCES[row.type]);
 }
});

test('server-style gathering checks exact range and researched tools',()=>{
 const point={id:'3',type:'salvageMetal',x:200,y:220};
 assert.equal(resources.eligible(point,500,220,{}).reason,'too-far');
 assert.equal(resources.eligible(point,200,220,{}).reason,'tool-required');
 assert.equal(resources.eligible(point,200,220,{salvageTool:1}).ok,true);
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
 assert.match(server,/ResourceFields\.eligible\(node,p\.x,p\.y,levels,115\)/);
 assert.match(server,/socket\.on\('exploration-study'/);
 assert.match(server,/ExplorationConfig\.gasConsumption\(depth,1\)/);
 assert.match(online,/function explorationCollect\(id,callback\)/);
 assert.match(game,/function resonanceAvailable\(id,mode='pve'\)/);
});
