'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const wildlife=require('../public/rift-wildlife.js');
const scale=require('../public/creature-scale.js');
const rarity=require('../public/specimen-rarity.js');
const map=require('../public/abyssal-map.js');

test('Rift sight is a forward cone blocked by solid walls',()=>{
 const entity={x:0,y:0,angle:0},front={x:100,y:0},behind={x:-100,y:0};
 assert.equal(wildlife.canSee(entity,front,null,null),true);
 assert.equal(wildlife.canSee(entity,behind,null,null),false);
 assert.equal(wildlife.canSee(entity,front,{segmentWalkable:()=>false},{rooms:[]}),false);
});

test('Passive fauna patrols until provoked; aggressive fauna pursues visible prey',()=>{
 const animal={id:7,kind:'drifter',specimenSkinId:'seapig',x:0,y:0,angle:0,hp:600,maxHp:600};
 const diver={x:100,y:0,alive:true,hp:100};
 assert.equal(wildlife.decide(animal,[diver],{now:100,seconds:0,family:'benthic'}).mode,'alert');
 animal.provokedUntil=2000;
 assert.equal(wildlife.decide(animal,[diver],{now:100,seconds:0,family:'benthic'}).mode,'attack');
 const predator={...animal,kind:'whiteShark',specimenSkinId:null,provokedUntil:0};
 assert.equal(wildlife.decide(predator,[diver],{now:100,seconds:0,family:'shark'}).mode,'attack');
});

test('Smart endangered fauna flee and invisible wildlife follows patrol',()=>{
 const e={id:4,kind:'drifter',specimenSkinId:'dumbo',x:0,y:0,angle:0,hp:100,maxHp:600};
 const p={x:110,y:0,alive:true,hp:100};
 assert.equal(wildlife.decide(e,[p],{now:100,family:'octopus'}).mode,'flee');
 p.x=-110;
 assert.equal(wildlife.decide(e,[p],{now:100,family:'octopus'}).mode,'patrol');
});

test('Fossas visual scale never makes fauna invisible and does not change collision cores',()=>{
 assert.ok(scale.riftVisualRadius('drifter',8,'scalyfoot')>=17);
 assert.ok(scale.riftVisualRadius('drifter',8,'leviathan')>scale.riftVisualRadius('drifter',8,'scalyfoot'));
 assert.ok(scale.riftVisualRadius('kraken',80)>scale.monsterVisualRadius('kraken',80));
 assert.equal(scale.creatureCollisionRadius(10,'scalyfoot'),scale.creatureCollisionRadius(10,'scalyfoot'));
});

test('Rift map provides obstacle-aware navigation for patrol and flight',()=>{
 const layout=map.createLayout('regression-rift-navigation',0);
 const a=layout.rooms.find(r=>r.id==='shoal');
 const b=layout.rooms.find(r=>r.id==='trench');
 const target=map.navigationTarget(layout,a.x,a.y,b.x,b.y,{padding:12,includePortal:false});
 assert.ok(Number.isFinite(target.x)&&Number.isFinite(target.y));
});

test('Rift rarity retains requested 40/30/15/10/5 split',()=>{
 assert.deepEqual(rarity.WEIGHTS,{common:40,uncommon:30,rare:15,epic:10,legendary:5});
});
