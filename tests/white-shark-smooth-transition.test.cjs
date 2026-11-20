'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const atlas=require('../public/abyssal-animated-sprites.js');
const code=fs.readFileSync(path.join(__dirname,'../public/abyssal-animated-sprites.js'),'utf8');
test('white shark swim positions connect without a reset jump',()=>{
 const length=22*95;
 assert.equal(atlas.whiteSharkSwimPosition(0),0);
 assert.equal(atlas.whiteSharkSwimPosition(length),0);
 assert.equal(atlas.whiteSharkSwimPosition(11*95),11);
 assert.ok(atlas.whiteSharkSwimPosition(length-1)<.02);
 assert.ok(atlas.whiteSharkSwimPosition(length+1)<.02);
});
test('white shark interpolated frame weights preserve full opacity while fading attack',()=>{
 for(const p of [-1,0,.03,.07,.14,.44,.75,.9,.999]){
  const frames=atlas.whiteSharkFrameWeights(1600,p);
  assert.ok(frames.length>=1&&frames.length<=4);
  assert.ok(Math.abs(frames.reduce((sum,f)=>sum+f.opacity,0)-1)<1e-9);
 }
 assert.ok(atlas.whiteSharkFrameWeights(100,-1).every(f=>f.mode==='swim'));
 assert.ok(atlas.whiteSharkFrameWeights(100,.07).some(f=>f.mode==='attack'));
 assert.ok(atlas.whiteSharkFrameWeights(100,.07).some(f=>f.mode==='swim'));
 assert.ok(atlas.whiteSharkFrameWeights(100,.99).some(f=>f.mode==='swim'));
});
test('white shark renders one solid composite on world canvas, never flickering double pass',()=>{
 const mixed=[],worldDraw=[];
 const buffer={save(){},restore(){},clearRect(){mixed.push('clear');},
  drawImage(){mixed.push('draw:'+this.globalCompositeOperation+':'+this.globalAlpha);}};
 const scan={clearRect(){},drawImage(){},getImageData(){throw Error('mock cannot scan pixels')}};
 const world={save(){},restore(){},drawImage(...args){worldDraw.push(args)}};
 class MockImage{
  constructor(){this.naturalWidth=672;this.naturalHeight=504;}
  set src(value){this.path=value;this.onload?.();}
 }
 const root={Image:MockImage,performance:{now:()=>1100},
  document:{createElement(){return {width:0,height:0,
   getContext(_type,options){return options?.alpha?buffer:scan;}};}}};
 vm.runInNewContext(code,{globalThis:root});
 const api=root.AbyssalAnimatedSprites;
 assert.equal(api.status().whiteSharkReady,true);
 assert.equal(api.status().whiteSharkSmoothBlend,true);
 assert.equal(api.drawAtOrigin(world,'whiteShark',24,1030,false),true);
 assert.equal(worldDraw.length,1);
 assert.ok(mixed.includes('clear'));
 assert.ok(mixed.some(x=>x.startsWith('draw:lighter:')));
});
