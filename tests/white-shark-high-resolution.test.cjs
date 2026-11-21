'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const api=require('../public/abyssal-animated-sprites.js');
test('full resolution frames are 320px, face remains fixed in swimming phase and mouth/tail phases fit 88-frame atlas',()=>{
 const swim=fs.readFileSync(path.join(__dirname,'../public/abyssal-white-shark-swim.webp'));
 const bite=fs.readFileSync(path.join(__dirname,'../public/abyssal-white-shark-attack.webp'));
 const dims=x=>[1+x[24]+(x[25]<<8)+(x[26]<<16),1+x[27]+(x[28]<<8)+(x[29]<<16)];
 assert.deepEqual(dims(swim),[1280,1008]);
 assert.deepEqual(dims(bite),[2560,1848]);
 assert.equal((1280/320)*(1008/168),24);
 assert.equal((2560/320)*(1848/168),88);
 assert.ok((swim.length+bite.length)<1600000,'network transfers remain under 1.6MB for both');
 for(let progress=0;progress<=1;progress+=.025){
  const frames=api.whiteSharkFrameWeights(600,Math.min(progress,.999999));
  assert.equal(frames.length,1);
  assert.equal(frames[0].mode,'attack');
  assert.ok(frames[0].index>=0&&frames[0].index<88);
 }
 for(let t=0;t<5000;t+=37){
  const idle=api.whiteSharkFrameWeights(t,-1)[0];
  assert.ok(idle.index>=0&&idle.index<22);
  const active=api.whiteSharkFrameWeights(t,.5)[0];
  assert.equal(active.index,Math.floor(.5*22)*4+Math.floor((t/45%22)*4/22));
 }
});
