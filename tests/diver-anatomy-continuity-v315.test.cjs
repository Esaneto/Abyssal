'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),rig=require('../public/abyssal-diver-rig.js');
const finite=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const grips=angle=>rig.rifleGrips.map(([x,y])=>[x,y*Math.cos(angle)]);
const body=(p,a,o)=>[p[0]*Math.cos(a)-(p[1]+o)*Math.sin(a),p[0]*Math.sin(a)+(p[1]+o)*Math.cos(a)];

test('front/back, profiles and diagonals keep hips, knees, ankles and head attached',()=>{
 for(let direction=-Math.PI;direction<=Math.PI+1e-6;direction+=Math.PI/8){
  const view=rig.gameplayView(direction);
  assert.ok(Number.isFinite(view.width)&&Math.abs(view.width)>.60);
  assert.ok(finite(rig.headPoint([31,0],view)));
  for(let phase=0;phase<=Math.PI*2+1e-6;phase+=Math.PI/8){
   for(const side of [-1,1]){
    const leg=rig.leg(side,phase,1,false,{drive:0,turn:0,hairFlow:0},view);
    assert.ok([leg.hip,leg.knee,leg.ankle].every(finite));
    assert.ok(distance(leg.hip,leg.knee)>23&&distance(leg.hip,leg.knee)<24.01);
    assert.ok(distance(leg.knee,leg.ankle)>18&&distance(leg.knee,leg.ankle)<24.01);
   }
  }
 }
});
test('aiming through all orientations keeps hands and shoulders fixed and eliminates elbow popping',()=>{
 for(const heading of [0,Math.PI/4,Math.PI/2,3*Math.PI/4,Math.PI,-Math.PI/2,-Math.PI/4]){
  let pose=null,previous=null,maxJump=0;
  for(let i=0;i<=720;i++){
   const aim=-Math.PI+i*Math.PI/360,roll=Math.cos(aim),offset=12*roll,relative=aim-heading;
   pose=rig.advance(pose,1,1/60,false,{heading});
   const raw=rig.armPair(relative,offset,grips(aim),'standard',rig.gameplayView(heading));
   const stable=rig.stabilizeArmPair(raw,pose,relative,offset,'abyssWeapon');
   for(let j=0;j<2;j++){
    assert.deepEqual(stable[j].hand,raw[j].hand);
    assert.deepEqual(stable[j].shoulder,raw[j].shoulder);
    assert.ok(finite(stable[j].elbow));
    if(previous)maxJump=Math.max(maxJump,distance(body(stable[j].elbow,relative,offset),previous[j]));
   }
   previous=stable.map(p=>body(p.elbow,relative,offset));
  }
  assert.ok(maxJump<5, 'abrupt elbow flip at heading '+heading+': '+maxJump);
 }
});
test('switching tools resets smoothing and preserves exact hand grips',()=>{
 const pose={frameDt:1/60},view=rig.gameplayView(0);
 rig.stabilizeArmPair(rig.armPair(0,12,grips(0),'standard',view),pose,0,12,'abyssWeapon');
 const next=rig.armPair(.6,5,rig.toolPose('abyssPickaxe').grips,'standard',view);
 assert.deepEqual(rig.stabilizeArmPair(next,pose,.6,5,'abyssPickaxe'),next);
 assert.equal(pose.armPoseHeld,'abyssPickaxe');
});