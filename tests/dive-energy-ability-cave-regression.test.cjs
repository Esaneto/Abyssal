'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8'),game=read('public/game.js'),server=read('server.js');
const cave=require('../public/abyssal-solo-cavern.js'),pet=require('../public/abyssal-pet-tactics.js');
test('100 percent collected energy plus only the equipped specimen bonus',()=>{
 const source=game.match(/function diveEnergyCalculation\(\)\{[^\n]+/)[0];
 const calculate=(percent)=>vm.runInNewContext(source+';diveEnergyCalculation()', {score:0,level:1,bossKillsThisRun:5,diveStats:{energyCollected:1000},SkinAbilities:{endDiveEnergyBonus:()=>percent},diveEnergySkinId:'default'});
 assert.equal(calculate(0).energyBonus,0);assert.equal(calculate(.1).energyBonus,100);assert.equal(calculate(.1).energyBonusPercent,10);
 assert.match(server,/Math.floor\(Number\(run.energyCollected\|\|0\)\*specimenBonus\)/);
 for(const id of ['finalEnergyBonusPercent','finalEnergyBonus','finalEnergyWithBonus'])assert.ok(read('public/index.html').includes('id="'+id+'"'));
});
test('shark vision rays stop at solid rock, including narrow corners',()=>{
 const rock={x:300,y:200,rx:20,ry:30,r:37,angle:0,vertices:[[-20,-30],[20,-30],[20,30],[-20,30]],cavernSolid:true};
 assert.equal(cave.rayDistance([rock],100,200,1,0,700),180);
 assert.equal(cave.rayDistance([rock],300,200,1,0,700),0);
 const fan=cave.visionFan([rock],100,200,0,.275,700);
 assert.ok(fan.some(p=>p.x<280&&Math.abs(p.y-200)<1));
 assert.ok(fan.every(p=>!cave.isBlocked([rock],p.x,p.y,0)));
 assert.ok(fan.every(p=>!cave.segmentBlocked([rock],100,200,p.x,p.y,0)));
});
test('pet ignores inaccessible orbs while retaining a reachable target',()=>{
 const result=pet.choose({mode:'passive',pet:{x:100,y:100},player:{x:100,y:100},orbs:[{id:1,x:110,y:100},{id:2,x:155,y:100}],routeCost:o=>o.id===1?Infinity:55});
 assert.equal(result.orb.id,2);
});
test('solo specimen dash uses swept movement, actual impact origin and one hit per enemy',()=>{
 const start=game.indexOf('function updateSpecimenRuntime(dt)'),end=game.indexOf('function hurtSpecimenSolo',start);
 const code=game.slice(start,end);
 const target={id:1,x:40,y:0,r:10,hp:100},outside={id:2,x:40,y:90,r:10,hp:100};
 const player={specimen:{x:0,y:0,r:10,alive:true,invuln:1,dash:{x1:0,y1:0,x2:100,y2:0,startedAt:0,durationMs:100,angle:0,damage:70,hitIds:new Set()}}};
 let now=50,hits=[];
 const context={player,onlineMode:false,isClassicShooterRun:()=>true,soloSubmarine:{spawnFx:0},performance:{now:()=>now},clamp:(v,a,b)=>Math.max(a,Math.min(v,b)),enemies:[target,outside],GAME_WORLD_ZOOM:1,pveTerrainClear:()=>true,dealEnemyDamage:(e,d,skill,opts)=>hits.push({id:e.id,d,skill,origin:opts.origin})};
 vm.createContext(context);vm.runInContext(code+';updateSpecimenRuntime(.05)',context);
 now=100;vm.runInContext('updateSpecimenRuntime(.05)',context);
 assert.equal(hits.length,1);assert.equal(hits[0].id,1);assert.equal(hits[0].d,70);assert.equal(hits[0].skill,'skin-active-dash');
 assert.equal(player.specimen.dash,null);
});
