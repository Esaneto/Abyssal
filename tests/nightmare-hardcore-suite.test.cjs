'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const H=require('../public/abyssal-rift-hardcore');
const Map=require('../public/abyssal-map');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const map=Map.createLayout('nightmare-v2',H.FINAL_TIER),hazards=H.build(map,H.FINAL_TIER);

test('Pesadelo Roxo owns exactly eight staggered anchored curved tentacle traps in the final chamber',()=>{
 const arms=hazards.filter(h=>h.roomId==='boss');
 assert.equal(arms.length,8);
 assert.ok(arms.every(h=>h.type==='tentacle'&&h.nightmare===true));
 assert.equal(new Set(arms.map(a=>a.offset)).size,8,'stagger attacks instead of simultaneous unavoidable eight-way hit');
 for(const arm of arms){
  assert.ok(Number.isFinite(arm.sourceX)&&Number.isFinite(arm.sourceY));
  assert.ok(arm.length>=300);
  const target=map.rooms.find(r=>r.id==='boss');
  const pick=H.targetNearest(arm,[{id:'remote',alive:true,x:target.x+30,y:target.y},{id:'elsewhere',x:target.x+300,y:target.y+420,alive:true}],map);
  assert.equal(pick.id,'remote');
 }
});
test('curved tentacles aim once per attack, have a late bend and collide during extension and withdrawal',()=>{
 const h=hazards.find(h=>h.roomId==='boss'&&h.type==='tentacle');
 assert.ok(h);
 const cycle=2;
 const aim=H.aimTentacle(h,cycle,h.sourceX+Math.cos(h.angle)*h.length*.71+40,h.sourceY+Math.sin(h.angle)*h.length*.71+70);
 assert.equal(aim.cycle,cycle);
 const points=H.tentaclePath(h,{cycle});
 assert.equal(points.length,33);
 const curved=points.slice(1,-1).some(p=>{
  const delta=Math.abs((p.x-h.sourceX)*Math.sin(h.angle)-(p.y-h.sourceY)*Math.cos(h.angle));
  return delta>8;
 });
 assert.ok(curved,'curved red footprint must bend, not be a straight line');
 const progress=q=>({phase:'active',cycle,progress:q});
 const contact=points[8]; // 1/4 of path: covered on both directions
 assert.equal(H.hit(h,contact.x,contact.y,0,progress(.23)),true,'tip passes on outbound');
 assert.equal(H.hit(h,contact.x,contact.y,0,progress(.68)),true,'body still hurts on return');
 assert.equal(H.hit(h,contact.x,contact.y,0,progress(.98)),false,'after full withdrawal no collision');
 assert.equal(H.hit(h,contact.x,contact.y,0,{phase:'warning',cycle,progress:.9}),false,'warning never deals damage');
 const repeated=H.aimTentacle(h,cycle,0,0);
 assert.equal(repeated.aimX,aim.aimX,'target is frozen at first warning, no frame-by-frame tracking unfairness');
});
test('rockfall begins on ceiling, falls more quickly than base player, shatters and fades',()=>{
 const rocks=hazards.filter(h=>h.type==='rockfall');
 assert.ok(rocks.length>0,'map has falling rocks');
 for(const h of rocks){
  assert.equal(h.wallKind,'ceiling');
  assert.ok(Map.isWalkable(map,h.sourceX,h.sourceY+60));
  assert.ok(h.length>180);
  const opening=H.rockfallState(h,{phase:'active',progress:.01});
  const descent=H.rockfallState(h,{phase:'active',progress:.55});
  assert.ok(descent.y>opening.y+30,'rock falls down from ceiling');
  const impact=H.rockfallState(h,{phase:'active',progress:1});
  assert.equal(impact.impact,true);assert.ok(impact.fade<.1,'impact shards fade before a new cycle');
  assert.equal(H.hit(h,impact.x,impact.y,0,{phase:'active',progress:1}),false);
 }
});
test('nightmare foreground is interactive but its eight background arms are purely painted',()=>{
 const src=read('public/abyssal-rift-hardcore.js'),server=read('world-simulation.js');
 assert.match(src,/for\(let i=0;i<8;i\+\+\)\{/);
 assert.match(src,/drawNightmareRelic/);
 assert.match(server,/nightmare-head-contact/);
 assert.match(server,/bossAbilityHit\(enemy,target,50/);
 assert.match(server,/hazard\.type==='tentacle'&&enemy\.kind===RiftHardcore\.FINAL_KIND/);
 assert.match(server,/environmentDamages/);
 assert.doesNotMatch(server,/abilityId:'rift-tentacle-warning'/,'old separate boss marks must not double the eight wall arms');
});
test('one collected rift orb can grant XP to every party member without recreating the orb',()=>{
 const src=read('server.js'),client=read('public/game.js'),simulation=read('world-simulation.js');
 assert.match(src,/if\(room\.mode==='rift'\)\{\s*const collector=room\.players\.get\(pickup\.playerId\)/);
 assert.match(src,/for\(const member of room\.players\.values\(\)\)/);
 assert.match(src,/SkinAbilities\.orbExperienceMultiplier\(member\.skinId\)/);
 assert.match(src,/source:'rift-team-orb'/);
 assert.match(simulation,/baseValue:orbValue/);
 assert.match(client,/function applySharedXp\(data\)/);
 assert.match(src,/expeditionMultiplier=expedition\?\(1\+Math\.min\(\.75,bossesKilled\*\.15\)\):1/);
});
test('prismatic skill is a passive, secondary hits preserve selected shot cosmetics, recipes are gold',()=>{
 const game=read('public/game.js'),server=read('server.js'),ui=read('public/index.html'),styles=read('public/style.css');
 assert.match(game,/shots:\['electric','pierce','photon','photonRay','nova','echoShot'\]/);
 assert.match(game,/passive:\['burst','ricochet','spread'\]/);
  assert.match(game,/prismOffsets=Array\.from/);
 assert.match(server,/p\.prismaticLevel = clamp/);
  assert.doesNotMatch(server,/'prismatic-passive'/);
 assert.match(ui,/id="resonanceFusionGuide"/);
 for(const name of ['RUPTURA GRAVITACIONAL','CADEIA DE ARCOS','OLHO DO ABISMO','DRENO VITAL'])assert.ok(game.includes(name));
 assert.match(styles,/.resonance-fusion-guide/);
});
test('the final relic is different from boss art, all chests are aged and moss-covered',()=>{
 const game=read('public/game.js'),src=read('public/abyssal-rift-hardcore.js'),chest=read('public/rift-treasure.js');
 assert.match(game,/drawNightmareRelic\(c,0,0,r,t\)/);
 assert.match(game,/riftSmile:\{name:'Pesadelo Roxo'/);
 assert.match(src,/function drawFinalBoss/);
 assert.match(src,/function drawNightmareRelic/);
 assert.match(chest,/chest-ancient-moss/);
 assert.match(chest,/chest-creeping-arms/);
});
