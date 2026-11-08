'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Hitbox=require('../public/diver-hitbox.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('the hitbox is an anatomical collection of head torso arm and leg capsules',()=>{
 const human={x:100,y:100,r:14,bodyAngle:0,swimming:false};
 const zones=Hitbox.zones(human,0).map(z=>z.name);
 for(const part of ['torso','head','left-arm','right-arm','left-thigh','right-thigh','left-leg','right-leg'])assert.ok(zones.includes(part),part);
 assert.equal(zones.length,10);
 assert.ok(zones.includes('left-forearm'));
 assert.ok(zones.includes('right-forearm'));
 assert.equal(Hitbox.DRAW_SCALE,.60);
});
test('a bullet hits a human leg outside the obsolete central player circle',()=>{
 const human={x:100,y:100,r:14,bodyAngle:0,swimming:false};
 assert.ok(Math.hypot(72-100,93-100)>14);
 assert.match(Hitbox.circleHit(human,72,93,2,0),/left-(leg|thigh)/);
 assert.equal(Hitbox.circleHit(human,12,5,2,0),null);
});
test('rotating the swimmer also rotates physical limb hitboxes',()=>{
 const human={x:100,y:100,r:14,bodyAngle:Math.PI/2,swimming:false};
 assert.equal(Hitbox.circleHit(human,72,93,2,0),null);
 assert.ok(Hitbox.circleHit(human,100,118,2,0));
});
test('laser segment can hit legs and arms, but not distant parallel segments',()=>{
 const human={x:100,y:100,r:14,bodyAngle:0,swimming:false};
 assert.ok(Hitbox.segmentHit(human,62,93,77,93,1,0));
 assert.equal(Hitbox.segmentHit(human,2,2,20,2,1,0),null);
 assert.equal(Hitbox.segmentSegmentDistance(0,0,1,0,3,0,4,0),2);
});
test('Rift hazards, monster contact and PvP projectiles use the shared anatomical hitbox',()=>{
 const world=read('world-simulation.js'),game=read('public/game.js'),pvp=read('pvp-projectiles.js'),server=read('server.js');
 assert.match(world,/function riftTouchesDiver/);
 assert.match(world,/DiverHitbox\.circleHit\(target,enemy\.x,enemy\.y/);
 assert.match(world,/DiverHitbox\.segmentHit\(target,enemy\.x,enemy\.y/);
 assert.match(game,/function riftTouchesDiver/);
 assert.match(game,/updateSoloSpecimenContact\(\)/);
 assert.match(pvp,/DiverHitbox\.circleHit\(target,px,py/);
 assert.match(server,/DiverHitbox\.segmentHit\(target,sx,sy,ex,ey/);
});
test('specimen can be damaged by monsters, boss powers and traps online and offline',()=>{
 const server=read('server.js'),game=read('public/game.js');
 assert.match(server,/function applySpecimenImpact/);
 for(const ability of ['pressure-lance','gulper-chomp','ink-trail'])assert.ok(server.includes(ability));
 assert.match(server,/RiftHardcore\.hit\(h,pos\.x,pos\.y,pos\.r,phase\)/);
 assert.match(game,/RIFT_HARDCORE\.hit\(h,specimen\.x,specimen\.y,specimen\.r,phase\)/);
 assert.match(game,/hurtSpecimenSolo\(24\*\.72\)/);
});
test('menu is a camera-following world and remote portal clicks cause swimming',()=>{

 const menu=read('public/abyssal-menu-ocean.js'),css=read('public/abyssal-menu-v2.css'),html=read('public/index.html');
 assert.match(menu,/event\.stopImmediatePropagation\(\)/);
 assert.match(menu,/function playEntrance\(s\)/);
 assert.match(menu,/transition=\{station:s/);
 assert.match(menu,/stage\.addEventListener\('pointerdown'/);
 assert.match(menu,/moveTarget=\{x:clamp/);
 assert.match(menu,/nearElapsed>\.38/);
 assert.match(css,/#menuScreen\.ocean-menu-v2\.submarine-menu #riftPortalBtn/);
 assert.match(html,/diver-hitbox\.js\?v=/);
});

test('the bent arms remain hittable while the gun rotates independently of swim heading',()=>{
 const diver={x:200,y:200,r:14,bodyAngle:0,weaponAngle:Math.PI/2,swimming:false};
 const zones=Hitbox.zones(diver,0);
 const far=zones.find(z=>z.name==='left-forearm');
 const near=zones.find(z=>z.name==='right-forearm');
 assert.ok(far&&near);
 const mx=(far.ax+far.bx)/2,my=(far.ay+far.by)/2;
 assert.equal(Hitbox.circleHit(diver,mx,my,1,0),'left-forearm');
 assert.ok(Math.hypot(mx-200,my-200)>4);
});

test('visual knees, lowered rifle arms and predicted collision coordinates use one shared anatomy',()=>{
 const art=read('public/diver-art.js');
 const hitbox=read('public/diver-hitbox.js');
 const simulation=read('world-simulation.js');
 assert.match(art,/const knee=\[-28\+4\*kick/);
 assert.match(hitbox,/const kneeFor=side=>\[-28\+4\*kickFor\(side\)/);
 assert.match(art,/c\.translate\(0,GUN_OFFSET_Y\)/);
 assert.match(hitbox,/limb\('right-arm',4,20,15,29/);
 assert.match(simulation,/contactTarget\.bodyAngle=Number\(target\.bodyAngle\)/);
 assert.match(simulation,/DiverHitbox\.circleHit\(resolvedContactTarget,enemy\.x,enemy\.y,enemyBodyRadius,now\)/);
});
