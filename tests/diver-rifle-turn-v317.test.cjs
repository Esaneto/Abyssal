'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const rig=require('../public/abyssal-diver-rig.js');
const art=require('../public/diver-art.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('a 180-degree reversal turns the entire visible torso smoothly, not the rifle behind it',()=>{
 const heading=0,aim=Math.PI;
 let pose=rig.advance(null,0,1/60,false,{heading,aim:heading,held:'abyssWeapon'});
 let last=pose.aimBodyHeading,steps=0;
 for(let i=0;i<50;i++){
  pose=rig.advance(pose,0,1/60,false,{heading,aim,held:'abyssWeapon'});
  const moved=Math.abs(rig.angleDelta(pose.aimBodyHeading,last));
  assert.ok(moved<=10.5/60+1e-8,'instant upper-body snap');
  assert.ok(Math.abs(rig.angleDelta(rig.riflePoseAim(pose.aimBodyHeading,aim),pose.aimBodyHeading))<=.86+1e-8,'rifle passes through back');
  if(rig.rifleReady(pose.aimBodyHeading,aim,.20))break;
  steps++;last=pose.aimBodyHeading;
 }
 assert.ok(steps>=12&&steps<=25,'the actor must visibly turn before firing');
 assert.ok(rig.rifleReady(pose.aimBodyHeading,aim,.20));
 assert.equal(pose.heading,heading,'locomotion heading must remain intact');
});
test('aim transition uses shortest angle across +180/-180 with no sudden reverse',()=>{
 const start=179*Math.PI/180,end=-179*Math.PI/180;
 const next=rig.turnRifleBody(start,0,end,1/60,true);
 assert.ok(Math.abs(rig.angleDelta(next,start))<.05,'long-way spin');
 assert.ok(Math.abs(rig.angleDelta(next,end))<.05);
 assert.equal(rig.turnRifleBody(start,0,end,0,true),start,'zero-delta frame must not teleport');
});
test('aim offset never exceeds shoulder mobility during any 8-direction rifle pose',()=>{
 for(let i=0;i<8;i++)for(let j=0;j<360;j++){
  const move=i*Math.PI/4,aim=j*Math.PI/180;
  let pose=rig.advance(null,1,1/60,false,{heading:move,aim:move,held:'abyssWeapon'});
  for(let tick=0;tick<30;tick++){
   pose=rig.advance(pose,1,1/60,false,{heading:move,aim,held:'abyssWeapon'});
   const visible=rig.riflePoseAim(pose.aimBodyHeading,aim);
   const delta=Math.abs(rig.angleDelta(visible,pose.aimBodyHeading));
   assert.ok(delta<=.86000001,'backward rifle orientation');
   assert.ok(Number.isFinite(pose.viewHeading));
  }
 }
});
test('propulsor and empty-hand poses stay tied to swim heading, with reversible transition',()=>{
 let pose=rig.advance(null,1,1/60,false,{heading:0,aim:Math.PI,held:'abyssWeapon'});
 for(let i=0;i<25;i++)pose=rig.advance(pose,1,1/60,false,{heading:0,aim:Math.PI,held:'abyssWeapon'});
 assert.ok(Math.abs(rig.angleDelta(pose.aimBodyHeading,Math.PI))<.1);
 let previous=pose.aimBodyHeading;
 for(let i=0;i<30;i++){
  pose=rig.advance(pose,1,1/60,true,{heading:0,aim:Math.PI,held:'abyssPropulsor'});
  assert.ok(Math.abs(rig.angleDelta(pose.aimBodyHeading,previous))<=13/60+1e-8);
  previous=pose.aimBodyHeading;
 }
 assert.ok(Math.abs(rig.angleDelta(pose.aimBodyHeading,0))<.1);
});
test('rifle trigger, support hand, muzzle and gameplay shot geometry remain canonical',()=>{
 assert.deepEqual(rig.rifleGrips.map(p=>[...p]),[[40,4.5],[27,8]]);
 assert.equal(art.BARREL_TIP_X,69);assert.equal(art.GUN_OFFSET_Y,12);
 const game=read('public/game.js'),artCode=read('public/diver-art.js');
 assert.match(game,/rigleHeld|rifleHeld/);
 assert.match(game,/manualFireQueuedUntil=performance\.now\(\)\+550/);
 assert.match(game,/!window\.AbyssalDiverRig\?\.rifleReady\?\.\(player\.swimPose\.aimBodyHeading,a,\.20\)/);
 assert.match(game,/const gunTip=DIVER_ART\?\.muzzle\?\.\(player\.x,player\.y,player\.r,a\)/);
 assert.match(artCode,/riflePoseAim\?\.\(a,requestedAim\)/);
 assert.match(game,/held:peer\.propulsorEquipped\?'abyssPropulsor':'abyssWeapon'/);
});

test('during an aim turn both elbows remain anatomical and the two arms never visibly cross',()=>{
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 for(let direction=0;direction<8;direction++){
  const heading=direction*Math.PI/4;
  for(let aimIndex=0;aimIndex<16;aimIndex++){
   const aim=aimIndex*Math.PI/8;
   let motion=rig.advance(null,1,1/60,false,{heading,aim:heading,held:'abyssWeapon'});
   for(let frame=0;frame<20;frame++){
    motion=rig.advance(motion,1,1/60,false,{heading,aim,held:'abyssWeapon'});
    const body=motion.aimBodyHeading,visualAim=rig.riflePoseAim(body,aim),roll=Math.cos(visualAim);
    const offset=12*roll,relative=rig.angleDelta(visualAim,body);
    const grips=rig.rifleGrips.map(([x,y])=>[x,y*roll]);
    const view=rig.gameplayView(motion.viewHeading);
    const raw=rig.armPair(relative,offset,grips,'standard',view,motion,'abyssWeapon');
    const arms=rig.stabilizeArmPair(raw,motion,relative,offset,'abyssWeapon');
    for(let i=0;i<2;i++){
     assert.deepEqual(arms[i].hand,grips[i]);
     assert.ok(Math.abs(distance(arms[i].shoulder,arms[i].elbow)/(.53*arms[i].projectedTotal)-1)<.09,'upper arm mismatch');
     assert.ok(Math.abs(distance(arms[i].elbow,arms[i].hand)/(.47*arms[i].projectedTotal)-1)<.09,'forearm mismatch');
    }
    assert.ok(rig.visibleCrossings(...arms,relative,offset,view)<=1,'impossible double crossover during body turn');
   }
  }
 }
});
