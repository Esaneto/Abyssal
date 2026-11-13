'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const geo=require('../public/abyssal-ocean-geography.js');
const sea=require('../public/abyssal-ocean-stream.js');
const eco=require('../public/abyssal-open-sea-ecology.js');
const resources=require('../public/abyssal-resource-fields.js');
const survival=require('../public/abyssal-exploration-config.js');

test('Mar Aberto uses one deeper geometry shared by rendering and fauna streaming',()=>{
 assert.equal(geo.HEIGHT,21000);
 assert.equal(sea.HEIGHT,geo.HEIGHT);
 assert.equal(sea.WIDTH,geo.WIDTH);
 const cell=sea.generate('ecosystem-contract',2,0,eco);
 assert.equal(cell.resources.length,0);
 assert.deepEqual(resources.streamNear('ecosystem-contract',1500,900,2000),resources.streamNear('ecosystem-contract',1500,900,2000));
 assert.deepEqual(resources.create('ecosystem-contract','classic',4800,3000,80),[]);
 assert.equal(resources.ENABLED,true);
 assert.equal(geo.isSolid(520,95,18),false,'the starting diver must be able to swim away from the submarine');
 assert.ok(geo.ROCKS.some(r=>r.type==='arch'||r.type==='spire'),'actual geological formations must remain in the ocean');
});

test('predators keep attacking across the sight cone edge instead of oscillating',()=>{
 const shark={id:13,specimenSkinId:'reefshark',wildlifeMode:'aggressive',
   schoolId:'p:shark',x:100,y:100,homeX:100,homeY:100,angle:0,hp:96,maxHp:96};
 const diver={id:'diver-1',x:190,y:100,alive:true};
 assert.equal(eco.decide(shark,[diver],0,100,[]).mode,'attack');
 diver.x=405;
 assert.equal(eco.decide(shark,[diver],.1,150,[]).mode,'attack','moving past the old 245 range must not instantly end a committed chase');
 shark.angle=Math.PI;
 assert.equal(eco.decide(shark,[diver],.2,280,[]).mode,'attack','a head turn must not lose a visible, unblocked recent target');
 assert.equal(eco.decide(shark,[diver],3,2400,[]).mode,'patrol','after chase memory expires, a hidden target is no longer pursued');
});

test('prey flee a nearby predator while predators hunt and use catalog actives',()=>{
 const shark={id:1,specimenSkinId:'reefshark',wildlifeMode:'aggressive',
   schoolId:'shark:1',x:100,y:100,homeX:100,homeY:100,angle:0,hp:96,maxHp:96,damage:20,r:24};
 const turtle={id:2,specimenSkinId:'hawksbill',wildlifeMode:'passive',
   schoolId:'turtle:2',x:120,y:100,homeX:120,homeY:100,angle:Math.PI,hp:70,maxHp:70,damage:6,r:20};
 const hunt=eco.decide(shark,[],0,1000,[shark,turtle]);
 assert.equal(hunt.mode,'forage');
 assert.equal(shark.aiIndicator,'attack');
 const flee=eco.decide(turtle,[],0,1000,[shark,turtle]);
 assert.equal(flee.mode,'evade-predator');
 assert.equal(turtle.aiIndicator,'flee');
 const hp=turtle.hp;
 const hits=eco.simulatePredation([shark,turtle],.05,1000);
 assert.equal(hits.length,1);
 assert.equal(hits[0].hunterId,1);
 assert.equal(hits[0].preyId,2);
 assert.ok(turtle.hp<hp);
 assert.equal(hits[0].abilityId,'trail');
 assert.deepEqual(eco.simulatePredation([shark,turtle],.05,1050),[],'ecological damage is not broadcast on every 50ms tick');
});

test('predatory sea creatures use their configured Specimens skills, without zero-damage shields becoming attacks',()=>{
 const diver={id:'diver',x:170,y:100,alive:true};
 const reefshark={id:11,specimenSkinId:'reefshark',x:100,y:100,angle:0,aiMode:'attack',hp:96};
 const skill=eco.activateAgainstPlayer(reefshark,diver,1000);
 assert.ok(skill);
 assert.equal(skill.id,'trail');
 assert.ok(skill.damage>0);
 assert.equal(eco.activateAgainstPlayer(reefshark,diver,1100),null,'skill cooldown is enforced');
 const shieldBearer={id:12,specimenSkinId:'blackcaiman',x:100,y:100,angle:0,aiMode:'attack',hp:110};
 const shield=eco.activateAgainstPlayer(shieldBearer,diver,1000);
 assert.equal(shield.id,'shield');
 assert.equal(shield.damage,0);
 assert.ok(shieldBearer.wildlifeShieldUntil>1000);
});

test('suit pressure and empty tank injury progress rather than being overcome by low passive regeneration',()=>{
 const safe=survival.safeDepth(0);
 assert.equal(survival.pressureDamage(safe-1,safe),0);
 assert.ok(survival.pressureDamage(safe+30,safe)>survival.pressureDamage(safe+10,safe));
 assert.ok(survival.pressureDamage(safe+80,safe)>=60);
 assert.ok(survival.oxygenDamage(40)>survival.oxygenDamage(1));
 assert.equal(survival.environmentDamage(safe-1,safe,0),0);
});

test('Online defaults to classic coop while the Open Sea world remains distinct',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const game=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 const online=fs.readFileSync(path.join(__dirname,'../public/online.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 assert.match(server,/makeWorldState\(mode='coop'\)/);
 assert.match(server,/CLASSIC_ROOM_ID,name:'Mergulho Online',capacity:6,mode:'coop'/);
 assert.match(server,/mode==='open-sea'\?'open-sea':'classic'/);
 assert.match(server,/\['coop','open-sea'\]\.includes\(room\.mode\)/);
 assert.match(game,/onlineRoomMode=\['pvp','rift','open-sea'\]/);
 assert.match(game,/isOpenSeaRun=\(\)=>onlineMode\?onlineRoomMode==='open-sea'/);
 assert.match(online,/AbyssalPreferredRoomMode='coop'/);
 assert.match(online,/socket\.emit\('create-room',\{[^\n]+mode:'coop'/);
 assert.match(html,/<option value="coop" selected>/);
 const runtime=fs.readFileSync(path.join(__dirname,'../public/abyssal-exploration-runtime.js'),'utf8');
 const chart=fs.readFileSync(path.join(__dirname,'../public/abyssal-navigation-chart.js'),'utf8');
 assert.match(runtime,/const p=cfg\(\),active=p\?\.mode==='open-sea'/);
 assert.match(chart,/!\['rift','open-sea'\]\.includes\(p\.mode\)/);
});

test('sighted species have stable habitat and depth metadata',()=>{
 for(const id of ['reefshark','hawksbill','angler','viperfish','seapig']){
  const d=eco.speciesHabitat(id);
  assert.ok(d&&typeof d.name==='string'&&d.name.length>0,id);
  assert.ok(d.minDepth<d.maxDepth&&d.maxDepth<=2200,id);
 }
});

test('discoveries do not create removed resource items in either world mode',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const runtime=fs.readFileSync(path.join(__dirname,'../public/abyssal-exploration-runtime.js'),'utf8');
 const serverDiscovery=server.slice(server.indexOf("socket.on('specimen-discovered'"),server.indexOf("socket.on('tutorial-state'"));
 const soloDiscovery=runtime.slice(runtime.indexOf("window.addEventListener('abyssal-specimen-discovery-request'"),runtime.indexOf("window.addEventListener('abyssal-companion-sonar'"));
 assert.ok(serverDiscovery.includes('user.discoveredSpecimens.push(id)'),'registered species are retained');
 assert.doesNotMatch(serverDiscovery,/resourceInventory\.(?:bioSample|deepCrystal)\s*[+]?=/,'no material mint on online discovery');
 assert.doesNotMatch(soloDiscovery,/localInventory\.bioSample\s*[+]?=/,'no material mint on solo discovery');
});

test('ocean obstacle navigation holds a coherent bypass waypoint between ticks',()=>{
 const rock=geo.ROCKS.find(r=>r.type==='spire');
 const animal={id:99,x:rock.x-rock.rx-160,y:rock.y,aiMode:'patrol'};
 const goal={x:rock.x+rock.rx+160,y:rock.y};
 assert.equal(geo.segmentClear(animal.x,animal.y,goal.x,goal.y,18),false);
 const a=eco.navigationTarget(animal,goal,18,1000);
 assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));
 const b=eco.navigationTarget(animal,{x:goal.x+20,y:goal.y+10},18,1200);
 assert.deepEqual({x:a.x,y:a.y},{x:b.x,y:b.y});
 assert.ok(animal.aiNavUntil>1200);
});


test('idle fauna commits to broad habitat waypoints instead of vibrating around spawn',()=>{
 const animal={id:731,streamId:'4:5:f1',schoolId:'4:5:solo1',specimenSkinId:'seapig',x:6200,y:5200,homeX:6200,homeY:5200,angle:0,hp:50,maxHp:50,wildlifeMode:'passive'};
 const first=eco.decide(animal,[],0,1000,[animal]);
 assert.equal(first.mode,'patrol');
 assert.ok(Math.hypot(first.target.x-animal.homeX,first.target.y-animal.homeY)>250,'patrol target should use meaningful habitat space');
 const second=eco.decide(animal,[],.05,1050,[animal]);
 assert.deepEqual(second.target,first.target,'waypoint must remain stable across AI ticks');
 assert.equal(eco.habitatAt(first.target.x,first.target.y).id,eco.habitatAt(animal.homeX,animal.homeY).id,'roaming remains inside the creature habitat');
});

test('a touching school separates symmetrically without breaking its shared habitat patrol',()=>{
 const a={id:101,streamId:'0:0:f0',schoolId:'0:0:s0',specimenSkinId:'eagleray',
  wildlifeMode:'passive',x:520,y:95,homeX:520,homeY:95,hp:70,maxHp:70,angle:0,r:20};
 const b={...a,id:102,streamId:'0:0:f1'};
 const first=eco.decide(a,[],0,1000,[a,b]);
 const second=eco.decide(b,[],0,1000,[a,b]);
 assert.equal(first.mode,'patrol');assert.equal(second.mode,'patrol');
 assert.ok(Math.hypot(first.target.x-second.target.x,first.target.y-second.target.y)>100,
  'two creatures at one spot should receive distinct formation targets');
 const nextA=eco.separateContact(a,[a,b],.05),nextB=eco.separateContact(b,[a,b],.05);
 const da={x:nextA.x-a.x,y:nextA.y-a.y},db={x:nextB.x-b.x,y:nextB.y-b.y};
 assert.ok(Math.hypot(da.x,da.y)>0&&Math.hypot(db.x,db.y)>0,'touching animals must be pushed apart');
 assert.ok(da.x*db.x+da.y*db.y<0,'exact overlap must resolve in opposite directions');
 assert.equal(geo.isSolid(nextA.x,nextA.y,10),false);
 assert.equal(geo.isSolid(nextB.x,nextB.y,10),false);
});

test('both online simulation and solo exploration enforce wildlife spacing after navigation',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const server=fs.readFileSync(path.join(__dirname,'../world-simulation.js'),'utf8');
 const solo=fs.readFileSync(path.join(__dirname,'../public/game.js'),'utf8');
 assert.match(server,/OpenSeaEcology\.separateContact\(enemy,ecologyNeighbors\(ecologySpatial,enemy,180\),dt\)/);
 assert.match(solo,/OPEN_SEA_ECOLOGY\.separateContact\(e,wildlifeNeighborCandidates,dt\)/);
 assert.match(server,/rebuildEcologySpatial\(world\)/);
 assert.match(solo,/collectEnemyCandidatesNear\(e\.x,e\.y,180\/GAME_WORLD_ZOOM,wildlifeNeighborCandidates\)/);
});
