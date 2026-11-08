'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const Standard=require('../public/skin-standard.js');
const Gravity=require('../public/gravity-cone.js');

test('gravity Nova hits only forward targets inside the same client/server cone',()=>{
 const inCone=Gravity.contains;
 const r=180;
 assert.equal(inCone(0,0,0,100,0,8,r),true);
 assert.equal(inCone(0,0,0,110,45,8,r),true);
 assert.equal(inCone(0,0,0,-100,0,8,r),false);
 assert.equal(inCone(0,0,0,80,140,5,r),false);
 assert.equal(inCone(0,0,0,220,0,5,r),false);
 assert.equal(inCone(0,0,Math.PI/2,0,140,4,r),true);
 assert.equal(inCone(0,0,Math.PI/2,140,0,4,r),false);
});

test('all squid and octopus trail actives paint black ink, other trails keep their palette',()=>{
 assert.equal(Standard.profile('aberration').active,'trail');
 assert.equal(Standard.profile('reefshark').active,'trail');
 assert.equal(Standard.activeSpec('aberration').ink,true);
 assert.equal(Standard.activeSpec('aberration').color,'#05060b');
 assert.equal(Standard.activeSpec('reefshark').ink,false);
 assert.equal(Standard.activeSpec('reefshark').color,'#79dfff');
 for(const id of ['kraken','aberration','dumbo','blanket','mimic','glassoctopus','jewelsquid','bigfin','whiplash']){
  const a=Standard.activeSpec(id);
  if(a.id==='trail'){assert.equal(a.ink,true,id);assert.equal(a.color,'#05060b',id);}
 }
 assert.equal(Standard.ACTIVE.trail.duration,10);
 assert.equal(Standard.ACTIVE.trail.life,10);
 assert.match(Standard.describe('aberration'),/10 segundos/);
});

test('trail activation spawns no instant 5-bubble chain; live samples last ten seconds',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.doesNotMatch(game,/for\(let i=0;i<5;i\+\+\).*sharkWakeTrails\.push/);
 assert.doesNotMatch(server,/for\(const node of nodes\)room\.world\.sharkWakeTrails\.push/);
 assert.match(game,/function updateSkinTrailRuntime\(\)/);
 assert.match(game,/player\.skinTrailUntil=performance\.now\(\)\+10000/);
 assert.match(game,/r:20\/GAME_WORLD_ZOOM,life:10,maxLife:10/);
 assert.match(server,/function tickSkinTrailNodes\(room,players,now\)/);
 assert.match(server,/player\.skinActiveReadyAt=now\+\(active==='trail'\?10000:0\)/);
 assert.match(server,/w\.sharkWakeTrails/);
 assert.match(server,/emit\('skin-trail-node'/);
 assert.match(read('public/online.js'),/socket\.on\('skin-trail-node'/);
 assert.match(game,/renderWakeBubble\(b,b\.ink===true\)/);
 assert.match(server,/processWorldDamage\(ownerSocket,Number\(enemy\.id\),\.9,'skin-active-trail'/);
});

test('fused Nova retains its cone shot and adds field damage, never default shots',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.match(game,/Number\(upgrades\.gravitationalRupture\)>0\|\|Number\(upgrades\.photonRay\)>0\)return/);
 assert.match(game,/Number\(upgrades\.nova\)>0\|\|Number\(upgrades\.gravitationalRupture\)>0/);
 assert.match(game,/type:'gravity-cone'/);
 assert.match(game,/emitPrismaticNovaShards\(novaDamage,volleyId\)/);
 assert.match(game,/if\(upgrades\.gravitationalRupture>0\)/);
 assert.match(server,/const GravityCone = require\('\.\/public\/gravity-cone\.js'\)/);
 assert.match(server,/GravityCone\.contains\(shooter\.x,shooter\.y,heading/);
 assert.match(server,/GravityCone\.contains\(centerX,centerY,heading/);
 assert.match(server,/novaConeUntil/);
});

test('menu streams originate at the swimmer and carry animated labels near it',()=>{
 const menu=read('public/abyssal-menu-ocean.js');
 const css=read('public/abyssal-menu-v2.css');
 assert.match(menu,/stage\.insertBefore\(routesCanvas,diver\)/);
 assert.match(menu,/const fromX=px-camX,fromY=py-camY/);
 assert.match(menu,/function drawNavigationStreams\(now\)/);
 assert.match(menu,/drawNavigationStreams\(now\)/);
 assert.match(menu,/routesCtx\.lineDashOffset=-now\*\.045/);
 assert.match(menu,/routesCtx\.fillText\(station\.label,p\.x,p\.y\)/);
 assert.doesNotMatch(menu,/function drawPortalRoutes\(/);
 assert.match(css,/z-index:5!important;pointer-events:none!important/);
});

test('portrait uses original swim pose and diver hair is individual underwater strands',()=>{
 const game=read('public/game.js'),art=read('public/diver-art.js');
 assert.match(game,/dx=w\*\.42,dy=h\*\.60/);
 assert.match(game,/27,-\.10,-\.10,t,\{gender:diverGender,moving:true\}/);
 assert.match(art,/const hairLength=female\?60:20/);
 assert.match(art,/const locks=female\?29:23/);
 assert.match(art,/Math\.sin\(phase\)/);
});
