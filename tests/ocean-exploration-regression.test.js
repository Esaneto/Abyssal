'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const eco=require('../public/abyssal-open-sea-ecology.js');
const pet=require('../public/abyssal-pet-tactics.js');
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
 for(const id of ['burst','ricochet','spread','power','photonRay']){
  assert.ok(config.RESEARCH[id],id);
  assert.equal(research.unlocked(id,{}),false);
 }
 assert.equal(research.unlocked('range',{}),true,'basic optics are standard equipment');
 assert.equal(research.migrateLegacy({}, {pulse:1,dash:1}).levels.pulse,1);
});

test('online gameplay integrates authoritative pickup, study and survival',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const game=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 const online=fs.readFileSync(path.join(__dirname,'../public/online.js'),'utf8');
 assert.match(server,/socket\.on\('exploration-collect'/);
 assert.match(server,/ResourceFields\.eligible\(node,p\.x,p\.y,inventory,125,tool\)/);
 assert.match(server,/socket\.on\('exploration-study'/);
 assert.match(server,/ExplorationConfig\.oxygenAfterTick\(diver\.oxygen,capacity,elapsed,depth,diver\.y,diver\.r\)/);
 assert.match(online,/function explorationCollect\(id,callback\)/);
 assert.match(game,/function resonanceAvailable\(id,mode='pve'\)/);
});


test('equipped specimen keeps a stable attack perimeter while facing a moving target',()=>{
 const profile=pet.attackProfile('default','fish',20);
 const companion={x:100,y:100,facingAngle:0};
 const target={x:180,y:100,r:15,hp:100};
 const first=pet.attackGoal(companion,target,profile,0);
 target.y=108;
 const stable=pet.attackGoal(companion,target,profile,first.approachAngle);
 assert.equal(stable.approachAngle,0);
 assert.ok(Math.abs(stable.y-target.y)<.001);
 assert.ok(stable.angle>0);
});

test('open-sea separation keeps a smoothed correction vector',()=>{
 const a={id:'a',x:100,y:100,r:15,hp:10,wildlifeMode:'passive',schoolId:'s',specimenSkinId:'default'};
 const b={id:'b',x:104,y:100,r:15,hp:10,wildlifeMode:'passive',schoolId:'s',specimenSkinId:'default'};
 const first=eco.separateContact(a,[a,b],.05);a.x=first.x;a.y=first.y;b.y=104;
 const second=eco.separateContact(a,[a,b],.05);
 assert.ok(Number.isFinite(second.x)&&Number.isFinite(second.y));
 assert.ok(Number.isFinite(a.aiSeparationX)&&Number.isFinite(a.aiSeparationY));
});
