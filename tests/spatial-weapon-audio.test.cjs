'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../public/abyssal-sample-audio.js');
test('near shots retain normalized volume; distant shots fade continuously',()=>{
 const range=850,at=distance=>A.spatialProfile({distance,range,volume:1},true);
 assert.equal(at(0).gain,1);assert.equal(at(100).gain,1);
 let previous=1;
 for(let d=0;d<1275;d+=10){const v=at(d);assert.ok(v.gain<=previous+1e-9);previous=v.gain;}
 assert.ok(at(1274).gain<.001);assert.equal(at(1275),null);
 assert.ok(at(850).cutoff<at(100).cutoff);
});
test('screen relative directions and equal-distance gain',()=>{
 const at=(dx,dy)=>A.spatialProfile({dx,dy,distance:Math.hypot(dx,dy),range:850},true);
 assert.deepEqual(at(100,0).direction,{x:1,y:0,z:0});
 assert.equal(at(-100,0).pan,-.95);
 assert.equal(at(0,-100).direction.z,-1);
 assert.equal(at(0,100).direction.z,1);
 assert.equal(at(200,0).gain,at(0,-200).gain);
 assert.equal(A.spatialProfile({distance:0},true).direction.z,-1);
});
