'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Rig=require('../public/abyssal-diver-rig.js');
const source=fs.readFileSync(require.resolve('../public/abyssal-realistic-body.js'),'utf8');
test('the actual renderer paints exactly two oxygen cylinders at every gameplay heading',()=>{
 const sandbox={AbyssalDiverRig:Rig};vm.createContext(sandbox);vm.runInContext(source,sandbox);
 for(let i=0;i<72;i++){
  const heading=i*Math.PI/36,view=Rig.gameplayView(heading);
  let cylinders=0;const state={globalAlpha:1},stack=[];
  const c=new Proxy(state,{get(o,k){if(k==='stroke')return ()=>{if(o.strokeStyle==='#9ab2b9')cylinders++;};if(k==='save')return ()=>stack.push({...o});if(k==='restore')return ()=>Object.assign(o,stack.pop());if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>({addColorStop(){}});return k in o?o[k]:()=>{};},set(o,k,v){o[k]=v;return true;}});
  sandbox.AbyssalRealisticBody.draw(c,0,{heading,view,moving:false},{hairStyle:'shaved'});
  assert.equal(cylinders,2,'heading '+heading);
 }
});
test('orientation transitions settle exactly, without residual interpolation or rest drift',()=>{
 let pose=Rig.advance(null,0,.016,false,{heading:0});
 const target=Math.PI/2;
 for(let i=0;i<60;i++)pose=Rig.advance(pose,0,.016,false,{heading:target});
 assert.equal(pose.viewHeading,target);
 for(let i=0;i<120;i++)pose=Rig.advance(pose,0,.016,false,{heading:target});
 assert.equal(pose.viewHeading,target);
 pose=Rig.advance(pose,1,.016,false,{heading:Math.PI});
 assert.ok(pose.viewHeading>target&&pose.viewHeading<Math.PI);
});


test('gameplay uses front on ascent, rear on descent and side on horizontal travel',()=>{
 for(const heading of [-Math.PI/2,Math.PI/2]){
  for(const side of [-1,1]){
   const view=Rig.gameplayView(heading,side);
   assert.equal(view.profile,0);assert.equal(view.facing,side);
   assert.equal(view.rear,heading>0?1:0);assert.equal(view.front,heading<0?1:0);
   assert.equal(Rig.gameplayView(heading+.001,side).profile,0);
  }
 }
 for(const heading of [0,Math.PI]){const v=Rig.gameplayView(heading);assert.equal(v.profile,1);assert.ok(v.rear<1e-12);assert.ok(v.front<1e-12);}
 const art=fs.readFileSync(require.resolve('../public/diver-art.js'),'utf8');
 assert.match(art,/rig\?\.gameplayView\?\.\(options\.motion\?\.viewHeading\?\?a,options\.motion\?\.swimSide\)/);
});
test('descending pair occupies only the backplate, no side mounts or duplicate cylinders',()=>{
 for(const angle of [Math.PI/2,Math.PI/2+.001,Math.PI/2-.001]){
  const view=Rig.gameplayView(angle);
  const tanks=Rig.tankMounts(view,.8);
  assert.equal(tanks.length,2);
  assert.deepEqual(tanks.map(v=>[v.x0,v.y,v.w,v.len]),[[-16.5,-11.5,8.8,32.5],[-16.5,2.5,8.8,32.5]]);
  assert.ok(tanks.every(v=>v.y>=-12&&v.y+v.w<=12));
 }
});
test('transition smoothly moves same two mounts between front, side and back',()=>{
 let pose=Rig.advance(null,1,.016,false,{heading:0});
 let prev=Rig.tankMounts(Rig.gameplayView(pose.viewHeading));
 for(let i=0;i<80;i++){
  pose=Rig.advance(pose,1,.016,false,{heading:Math.PI/2});
  const view=Rig.gameplayView(pose.viewHeading,pose.swimSide),next=Rig.tankMounts(view);
  assert.equal(next.length,2);
  for(let j=0;j<2;j++)assert.ok(Math.abs(next[j].y-prev[j].y)<9);
  prev=next;
 }
 assert.equal(pose.viewHeading,Math.PI/2);
 assert.equal(Rig.gameplayView(pose.viewHeading).rear,1);
});

test('the human skeleton remains distinct from the mounted breathing cylinders',()=>{
 const profile=Rig.gameplayView(0),rear=Rig.gameplayView(Math.PI/2),front=Rig.gameplayView(-Math.PI/2);
 const human=Rig.humanLandmarks(profile),mounts=Rig.tankMounts(profile);
 assert.deepEqual(human.shoulders.map(p=>p[0]),[13,13]);
 assert.deepEqual(human.pelvis,[-19,0]);
 assert.ok(mounts.every(m=>m.kind==='external-scuba-cylinder'&&m.mount==='backplate'));
 assert.ok(mounts[0].y+mounts[0].w<mounts[1].y,'two cylinders must be separate on the back');
 assert.ok(mounts[1].y+mounts[1].w<Rig.HUMAN_FRAME.torsoDorsalEdge-.5,'nearest tank must not invade the dorsal suit silhouette');
 assert.ok(Rig.tankMounts(rear).every(m=>m.y>=-12&&m.y+m.w<=12),'back-mounted in rear view');
 for(const v of [profile,rear,front]){
  const before=Rig.humanLandmarks(v);
  for(const roll of [-1,-.5,0,.5,1]){
   assert.equal(Rig.tankMounts(v,roll).length,2);
   assert.deepEqual(Rig.humanLandmarks(v),before,'external gear cannot drive shoulder or pelvis geometry');
  }
 }
});
test('removing SCUBA equipment does not erase human torso, arms or legs',()=>{
 const sandbox={AbyssalDiverRig:Rig};vm.createContext(sandbox);vm.runInContext(source,sandbox);
 let cylinders=0,otherStrokes=0;
 const state={globalAlpha:1},stack=[];
 const c=new Proxy(state,{get(o,k){if(k==='stroke')return ()=>{otherStrokes++;if(o.strokeStyle==='#9ab2b9')cylinders++;};if(k==='save')return ()=>stack.push({...o});if(k==='restore')return ()=>Object.assign(o,stack.pop());if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>({addColorStop(){}});return k in o?o[k]:()=>{};},set(o,k,v){o[k]=v;return true;}});
 sandbox.AbyssalRealisticBody.draw(c,0,{heading:0,view:Rig.gameplayView(0),moving:false,showBackpack:false},{hairStyle:'shaved'});
 assert.equal(cylinders,0,'the SCUBA pack must be independently removable from the rendered body');
 assert.ok(otherStrokes>10,'human silhouette must still be drawn without the tanks');
 const rig=Rig.humanLandmarks(Rig.gameplayView(0));
 assert.equal(rig.shoulders.length,2);
});
