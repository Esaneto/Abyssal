'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const Standard=require('../public/skin-standard.js');

test('specimen charge triples base travel and uses 650ms real swimming with invulnerability',()=>{
 assert.equal(Standard.ACTIVE.dash.range,465);
 assert.equal(Standard.ACTIVE.dash.duration,.65);
 const game=read('public/game.js'),server=read('server.js');
 assert.match(game,/function startSkinSpecimenDash\(origin,angle,range,duration=\.65\)/);
 assert.match(game,/s\.dash=\{x1:origin\.x,y1:origin\.y,x2:/);
 assert.match(game,/s\.invuln=Math\.max/);
 assert.match(game,/function drawSpecimenDashArc\(/);
 assert.match(game,/drawSpecimenDashArc\(player\.specimen\.x/);
 assert.doesNotMatch(game,/else if\(spec\.id==='dash'\)\{effects\.push\(\{type:'beam'/);
 assert.match(server,/player\.specimenDashUntil=now\+650/);
 assert.match(server,/specimenInvulnerableUntil.*player\.specimenDashUntil/);
 assert.match(server,/peer\.specimenX=dash\.x1\+\(dash\.x2-dash\.x1\)\*progress/);
 assert.match(server,/pvpSegmentHitsRock\(originX,originY,tx,ty/);
 assert.match(server,/AbyssalMap\.segmentWalkable\(worldLayout,originX,originY,tx,ty/);
 assert.match(server,/now<\(Number\(player\.specimenDashUntil\)\|\|0\)/);
});

test('electric and venom infusion each lasts 10s then receives a full 10s cooldown',()=>{
 for(const key of ['paralysis','poison']){
  assert.equal(Standard.ACTIVE[key].duration,10);
  assert.equal(Standard.ACTIVE[key].cooldown,10);
 }
 const game=read('public/game.js'),server=read('server.js');
 assert.match(game,/player\.skinWeaponBuffUntil=performance\.now\(\)\+10000/);
 assert.match(game,/player\.skinActiveCooldown=Number\(player\.skinWeaponBuffCooldownSeconds\)\|\|10/);
 assert.match(server,/player\.skinWeaponBuffUntil=now\+10000/);
 assert.match(server,/player\.skinActiveReadyAt=now\+activeDuration\+Math\.round/);
 assert.match(server,/active==='paralysis'\|\|active==='poison'\?10:mastery\.cooldown/);
 assert.match(game,/player\.skinWeaponBuffKind=spec\.id/);
 assert.match(server,/function weaponInfusionFor\(player,skillId,now\)/);
 assert.match(server,/applyWeaponInfusionToEnemy\(socket,room,player,enemy,skillId,now\)/);
 assert.match(server,/applyWeaponInfusionToPvp\(room,attacker,primaryTarget,sourceSkill,now\)/);
 assert.match(game,/function drawWeaponInfusion\(/);
 assert.match(game,/drawWeaponInfusion\(player\.x,player\.y,player\.r/);
});

test('electric hits stun for precisely one second and poison hits apply server-owned damage over time',()=>{
 const game=read('public/game.js'),server=read('server.js'),simulation=read('world-simulation.js');
 assert.match(game,/enemy\.paralyzedUntil=Math\.max\(Number\(enemy\.paralyzedUntil\)\|\|0,now\+1000\)/);
 assert.match(server,/enemy\.paralyzedUntil=Math\.max\(Number\(enemy\.paralyzedUntil\)\|\|0,now\+1000\)/);
 assert.match(server,/target\.skinParalyzedUntil=Math\.max\(Number\(target\.skinParalyzedUntil\)\|\|0,now\+1000\)/);
 assert.match(game,/function enemyParalyzedNow\(e\)/);
 assert.match(simulation,/enemy\.paralyzedUntil && now < enemy\.paralyzedUntil/);
 assert.match(server,/enemy\.weaponPoisonProcUntil=now\+2400/);
 assert.match(server,/for\(const delay of \[800,1600,2400\]\)setTimeout/);
 assert.match(server,/skin-active-poison-dot/);
 assert.match(game,/enemy\.poisonTimer=Math\.max\(Number\(enemy\.poisonTimer\)\|\|0,2\.4\)/);
});

test('toxic cloud radius is twice the old radius and synchronized on both game and server',()=>{
 assert.equal(Standard.ACTIVE.cloud.range,300);
 const game=read('public/game.js'),server=read('server.js'),online=read('public/online.js');
 assert.match(game,/spawnPoisonPlantCloudVisual\(x,y,r,color\)/);
 assert.match(server,/const radius=\(Number\(spec\.range\)\|\|160\)\/WORLD_ZOOM/);
 assert.match(server,/const areaEnemies=\(\)=>enemies\.filter/);
 assert.match(server,/active==='cloud'/);
 assert.match(online,/abyssal-specimen-dash/);
 assert.match(online,/abyssal-skin-weapon-impact/);
 assert.match(game,/function updateSkinCloudExpansions\(dt\)/);
 assert.match(game,/cloud\.radius\*\(\.06\+\.94\*\(1-Math\.pow\(1-grow,2\)\)\)/);
 assert.match(game,/cloud\.hitIds\.add\(e\.id\)/);
 assert.match(game,/updateSkinCloudExpansions\(dt\)/);
 assert.match(server,/for\(const delay of \[250,500,800,1150\]\)setTimeout/);
 assert.match(server,/const edge=radius\*\(\.06\+\.94\*\(1-Math\.pow\(1-grow,2\)\)\)/);
 assert.match(server,/touched\.add\(e\.id\)/);
 assert.match(server,/touched\.add\(target\.id\)/);
});
