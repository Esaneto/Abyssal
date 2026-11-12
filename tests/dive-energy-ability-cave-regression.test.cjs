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
 assert.ok(Math.abs(cave.rayDistance([rock],100,200,1,0,700)-180)<1e-8);
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

test('offensive specimen abilities deal damage and respect solid obstacles',()=>{
 const cut=(a,b)=>game.slice(game.indexOf(a),game.indexOf(b,game.indexOf(a)));
 const code=cut('function marineAbilityLineDistance','function currentSkinActiveSpec')+
 cut('const expandingSkinClouds','function spawnPoisonPlantCloudVisual')+
 cut('function applySoloSkinActive','function activateSkinAbility');
 const hits=[],near={id:1,x:30,y:0,r:10,hp:100},blocked={id:2,x:40,y:0,r:10,hp:100},player={specimen:{alive:true}};
 const context={onlineMode:false,GAME_WORLD_ZOOM:1,clamp:(v,a,b)=>Math.max(a,Math.min(v,b)),specimenOrigin:()=>({x:0,y:0}),enemies:[near,blocked],player,soloAdaptationRun:'test-run',gameState:'playing',effects:[],setTimeout:f=>f(),pveTerrainClear:(a,b,x)=>x!==40,dealEnemyDamage:(e,d,skill)=>hits.push({id:e.id,d,skill})};
 vm.createContext(context);vm.runInContext(code,context);
 for(const [id,damage,range] of [['cloud',50,300],['pulse',60,360],['push',60,330],['shot',80,360],['slowShot',60,320]]){
  context.spec={id,damage,range,color:'#fff'};
  vm.runInContext('applySoloSkinActive(spec,0);updateSkinCloudExpansions(1.55);updateSkinPulses(.72)',context);
 }
 assert.deepEqual(hits.map(x=>[x.id,x.d]),[[1,50],[1,60],[1,60],[1,80],[1,60]]);
 assert.ok(near.poisonTimer>0);assert.ok(near.skinSlowedUntil>Date.now());assert.ok(near.kbVx>0);
});
test('venom and electric weapon infusions apply on real projectile hits',()=>{
 const start=game.indexOf('const INFUSION_SHOT_TYPES'),end=game.indexOf('function triggerHitSynergies',start),source=game.slice(start,end);
 const enemy={hp:100,x:10,y:10},player={skinWeaponBuffUntil:10000,skinWeaponBuffKind:'poison'};
 const context={onlineMode:false,player,enemy,performance:{now:()=>1000},burst:()=>{}};
 vm.createContext(context);vm.runInContext(source+";applySoloWeaponInfusionHit(enemy,'photon')",context);assert.equal(enemy.poisonTimer,2.5);assert.equal(enemy.poisonTick,.5);
 player.skinWeaponBuffKind='paralysis';enemy.weaponInfusionNextAt=0;vm.runInContext("applySoloWeaponInfusionHit(enemy,'electric')",context);assert.equal(enemy.paralyzedUntil,1100);
});

test('hypothermic projectile and venom use the configured balance',()=>{const A=require('../public/skin-standard.js').ACTIVE;assert.equal(A.slowShot.damage,60);assert.equal(A.slowShot.slowDurationMs,2000);assert.equal(A.poison.damage,5);assert.equal(A.poison.tickMs,500);});
