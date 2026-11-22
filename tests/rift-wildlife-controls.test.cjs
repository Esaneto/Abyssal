'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Wildlife=require('../public/rift-wildlife.js');
const Scale=require('../public/creature-scale.js');
const Specimen=require('../public/specimen-system.js');
const EnemyAI=require('../public/enemy-ai.js');
const src=p=>fs.readFileSync(p,'utf8');
const map={segmentWalkable:(_l,x1,y1,x2,y2)=>!(x1<50&&x2>50)};
const layout={rooms:[]},room={id:'shoal',x:150,y:150,rx:450,ry:250,depth:1};
test('all 41 curated specimens retain recognizable minimum size',()=>{
 const ids=Object.keys(Scale.ADULT_METERS);
 assert.ok(ids.length>=70);
 for(const id of ids)assert.ok(Scale.companionMeters(id)>=.5&&Scale.companionMeters(id)<=3&&Scale.visualRadius(id)>0,id);
 assert.ok(Scale.visualRadius('kraken')>Scale.visualRadius('dumbo'));
 assert.ok(Scale.monsterMeters('riftSmile')>Scale.monsterMeters('whiteShark'));
});
test('ecology assigns aggressive, passive and smart traits from species',()=>{
 assert.equal(Wildlife.disposition('whiteShark','greenland','shark'),'aggressive');
 assert.equal(Wildlife.disposition('drifter','atolla','jelly'),'passive');
 assert.equal(Wildlife.disposition('drifter','mimic','octopus'),'smart');
 assert.equal(Wildlife.health('drifter','viperfish','fish'),2100);
 assert.equal(Wildlife.health('brute','yeticrab','crustacean'),1200);
 assert.equal(Wildlife.health('stinger','atolla','jelly'),600);
});
test('cone sight ignores back targets and never penetrates obstacles',()=>{
 const enemy={x:100,y:100,angle:0};
 assert.equal(Wildlife.canSee(enemy,{x:140,y:100},null,null),true);
 assert.equal(Wildlife.canSee(enemy,{x:70,y:100},null,null),false);
 assert.equal(Wildlife.canSee({x:10,y:100,angle:0},{x:140,y:100},map,layout),false);
 assert.equal(Wildlife.canSee(enemy,{x:900,y:100},null,null),false);
});
test('aggressor pursues, passive observes, smart animal may flee',()=>{
 const player={x:180,y:100,alive:true,hp:100};
 const predator={kind:'whiteShark',specimenSkinId:'greenland',x:100,y:100,angle:0,hp:2100,maxHp:2100,id:2};
 assert.equal(Wildlife.decide(predator,[player],{room,now:1000,family:'shark'}).mode,'attack');
 const passive={...predator,kind:'drifter',specimenSkinId:'atolla',hp:600,maxHp:600};
 assert.equal(Wildlife.decide(passive,[player],{room,now:1000,family:'jelly'}).mode,'alert');
 passive.provokedUntil=2000;
 assert.equal(Wildlife.decide(passive,[player],{room,now:1000,family:'jelly'}).mode,'attack');
 const smart={...predator,kind:'drifter',specimenSkinId:'mimic',hp:20,maxHp:600};
 assert.equal(Wildlife.decide(smart,[player],{room,now:1000,family:'octopus'}).mode,'flee');
});
test('Fossas population prewarms in capped batches both clients',()=>{
 const server=src('world-simulation.js'),game=src('public/game.js');
 assert.match(server,/let budget=2; \/\/ maximum two new entities/);
 assert.match(game,/let budget=2;\s*while\(budget-->0&&soloRiftSpawnQueue\.length\)/);
 assert.match(server,/RiftWildlife\.decide\(/);
 assert.match(game,/RIFT_WILDLIFE\.decide\(/);
 assert.match(server,/SpecimenSystem\.biologicalStats\(specimenSkinId\)\.hp/);
 assert.match(game,/SPECIMEN_SYSTEM\?\.biologicalStats\?\.\(specimenSkinId\)/);
});
test('manual firing: aim mode never autofires and mobile uses the reticle as trigger',()=>{
 const game=src('public/game.js'),html=src('public/index.html'),style=src('public/style.css');
 assert.match(game,/if\(isRiftRun\(\)\|\|isOpenSeaRun\(\)\)\{controlSettings\.pc='wasd-aim';controlSettings\.mobile='dual-stick';\}/);
 assert.match(game,/fireTimer<=0&&\(!isManualFiringMode\(\)\|\|manualShotRequested\)/);
 assert.match(game,/const manualShotRequested=manualFireDown\(\)\|\|Number\(player\.manualFireQueuedUntil\)>performance\.now\(\)/);
 assert.match(game,/stick\.addEventListener\('pointerdown'/);assert.match(game,/mobileFireHeld=true;mobileFireTap=true/);
 assert.doesNotMatch(html,/id="mobileFireBtn"/);assert.match(html,/aria-label="Mirar e disparar"/);
 assert.doesNotMatch(style,/\.abyss-mobile-fire/);
});
test('shark and boss speeds are set for physical movement',()=>{
 assert.equal(EnemyAI.statsForKind('whiteShark').speed,300);
 assert.equal(EnemyAI.statsForKind('whiteSharkBoss').speed,400);
});

test('rendering must never overwrite a creature kind when estimating sprite bounds',()=>{
 const game=src('public/game.js');
 assert.doesNotMatch(game,/\be\.kind\s*=\s*['"]kraken['"]/);
 assert.match(game,/\(e\.kind===['"]kraken['"]\?5\.1/);
});
