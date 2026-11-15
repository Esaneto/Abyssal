'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Rig=require('../public/abyssal-diver-rig.js');
const source=fs.readFileSync(require.resolve('../public/abyssal-realistic-body.js'),'utf8');
test('the actual renderer paints exactly two oxygen cylinders at every gameplay heading',()=>{
 const sandbox={AbyssalDiverRig:Rig};vm.createContext(sandbox);vm.runInContext(source,sandbox);
 for(let i=0;i<72;i++){
  const heading=i*Math.PI/36,view=Rig.gameplayView(heading);
  let cylinders=0;const state={globalAlpha:1},stack=[];
  const c=new Proxy(state,{get(o,k){if(k==='stroke')return ()=>{if(o.strokeStyle==='#0a1821')cylinders++;};if(k==='save')return ()=>stack.push({...o});if(k==='restore')return ()=>Object.assign(o,stack.pop());if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>({addColorStop(){}});return k in o?o[k]:()=>{};},set(o,k,v){o[k]=v;return true;}});
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

test('swimming remains a single side profile while descending, ascending and changing sides',()=>{
 let pose=Rig.advance(null,1,.016,false,{heading:Math.PI});
 for(const heading of [Math.PI/2,-Math.PI/2,Math.PI/2]){
  pose=Rig.advance(pose,1,.016,false,{heading});
  const view=Rig.swimView(heading,pose.swimSide);
  assert.equal(view.profile,1);assert.equal(view.rear,0);assert.equal(view.front,0);
  assert.equal(view.facing,-1);
 }
 pose=Rig.advance(pose,1,.016,false,{heading:0});
 assert.equal(pose.swimSide,1);
 assert.equal(Rig.swimView(Math.PI/2,pose.swimSide).facing,1);
 const art=fs.readFileSync(require.resolve('../public/diver-art.js'),'utf8');
 assert.match(art,/rig\?\.swimView\?\.\(a,options\.motion\?\.swimSide\)/);
});
test('all gameplay profile poses draw one physical pair without a separate rear layer',()=>{
 const sandbox={AbyssalDiverRig:Rig};vm.createContext(sandbox);vm.runInContext(source,sandbox);
 for(let i=0;i<72;i++){
  const heading=i*Math.PI/36,view=Rig.swimView(heading,1);
  let cylinders=0;const state={globalAlpha:1},stack=[];
  const c=new Proxy(state,{get(o,k){if(k==='stroke')return ()=>{if(o.strokeStyle==='#0a1821')cylinders++;};if(k==='save')return ()=>stack.push({...o});if(k==='restore')return ()=>Object.assign(o,stack.pop());if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>({addColorStop(){}});return k in o?o[k]:()=>{};},set(o,k,v){o[k]=v;return true;}});
  sandbox.AbyssalRealisticBody.draw(c,0,{heading,view,moving:true},{hairStyle:'shaved'});
  assert.equal(cylinders,2,'heading '+heading);
  assert.equal(view.rear,0);
 }
});
