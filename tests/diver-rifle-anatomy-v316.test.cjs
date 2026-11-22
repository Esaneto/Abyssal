'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const rig=require('../public/abyssal-diver-rig.js');
const hitbox=require('../public/diver-hitbox.js');
const art=require('../public/diver-art.js');
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const bodyElbow=(p,angle,offset)=>{
 const ca=Math.cos(angle),sa=Math.sin(angle);
 return [p.elbow[0]*ca-(p.elbow[1]+offset)*sa,p.elbow[0]*sa+(p.elbow[1]+offset)*ca];
};
test('the firing hand is in the trigger guard; the other hand supports the rifle fore-end',()=>{
 assert.deepEqual([...rig.rifleContacts.trigger],[27,8]);
 assert.deepEqual([...rig.rifleContacts.support],[40,4.5]);
 assert.deepEqual(rig.rifleGrips.map(p=>[...p]),[[40,4.5],[27,8]]);
 assert.ok(dist(rig.rifleContacts.support,rig.rifleContacts.trigger)>12);
 assert.equal(art.BARREL_TIP_X,69);
});
test('eight body directions and 360-degree aim preserve both independent grips and shoulders',()=>{
 for(let direction=0;direction<8;direction++){
  const heading=direction*Math.PI/4;
  let motion=null,previous=null;
  for(let degree=0;degree<=360;degree+=.5){
   const aim=(degree-180)*Math.PI/180,roll=Math.cos(aim),offset=art.GUN_OFFSET_Y*roll,relativeAim=aim-heading;
   const grips=rig.rifleGrips.map(([x,y])=>[x,y*roll]),view=rig.gameplayView(heading);
   motion=rig.advance(motion,1,1/60,false,{heading});
   const raw=rig.armPair(relativeAim,offset,grips,'standard',view,motion,'abyssWeapon');
   const posed=rig.stabilizeArmPair(raw,motion,relativeAim,offset,'abyssWeapon');
   for(let side=0;side<2;side++){
    const arm=posed[side];
    assert.deepEqual(arm.hand,grips[side],'weapon hand detached at '+heading+'/'+degree);
    assert.deepEqual(arm.shoulder,raw[side].shoulder,'shoulder drifted');
    assert.ok([arm.elbow[0],arm.elbow[1]].every(Number.isFinite));
    const upper=dist(arm.shoulder,arm.elbow),forearm=dist(arm.elbow,arm.hand);
    assert.ok(upper>9&&forearm>9,'collapsed arm limb');
    assert.ok(upper<45&&forearm<41,'unreasonably long arm');
    if(previous)assert.ok(dist(bodyElbow(arm,relativeAim,offset),previous[side])<4.3,'elbow snap at '+heading+'/'+degree);
   }
   previous=posed.map(p=>bodyElbow(p,relativeAim,offset));
  }
 }
});
test('hitboxes use the same two wrist contacts and gradual rifle roll as the drawn character',()=>{
 for(let direction=0;direction<8;direction++){
  const heading=direction*Math.PI/4;
  for(let aimIndex=0;aimIndex<16;aimIndex++){
   const aim=aimIndex*Math.PI/8,roll=Math.cos(aim),offset=art.GUN_OFFSET_Y*roll;
   const player={x:200,y:150,r:14,bodyAngle:heading,weaponAngle:aim,swimming:true};
   const zones=hitbox.zones(player),scale=player.r*hitbox.DRAW_SCALE/14;
   for(const [i,name] of ['left-forearm','right-forearm'].entries()){
    const z=zones.find(z=>z.name===name),[x,y]=rig.rifleGrips[i];
    assert.ok(z,'missing '+name);
    const px=player.x+((x*Math.cos(aim))-((y*roll+offset)*Math.sin(aim)))*scale;
    const py=player.y+((x*Math.sin(aim))+((y*roll+offset)*Math.cos(aim)))*scale;
    assert.ok(Math.hypot(z.bx-px,z.by-py)<1e-6,'hitbox wrist mismatch at '+heading+'/'+aim);
   }
  }
 }
});
test('arms, legs and head are finite in idle and swimming poses for both projections',()=>{
 for(const heading of [-Math.PI,-Math.PI/2,0,Math.PI/2]){
  for(const view of [rig.gameplayView(heading),rig.viewFor(.65,heading)]){
   for(let phase=0;phase<=Math.PI*2;phase+=Math.PI/8){
    for(const side of [-1,1]){
     const leg=rig.leg(side,phase,1,false,{drive:0,turn:0,hairFlow:0},view);
     assert.ok([leg.hip,leg.knee,leg.ankle].every(p=>p.every(Number.isFinite)));
     const idle=rig.idleArm(side,phase,0,null,view);
     assert.ok([idle.shoulder,idle.elbow,idle.hand].every(p=>p.every(Number.isFinite)));
     assert.ok(dist(leg.hip,leg.knee)>20);
    }
   }
  }
 }
});
