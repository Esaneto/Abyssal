'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const A=require('../public/abyssal-sample-audio.js');
function sample(delay){const sr=12000,pcm=Float32Array.from({length:sr},(_,i)=>i<delay*sr?0:.3*Math.sin(i*.3));return {length:pcm.length,sampleRate:sr,numberOfChannels:1,duration:1,getChannelData:()=>pcm};}
test('weapon onset skips leading silence while preserving pre-roll',()=>{assert.equal(A.weaponOnset(sample(0)),0);const offset=A.weaponOnset(sample(.12));assert.ok(offset>.10&&offset<.12);assert.ok(A.weaponOnset(sample(.30))>.28);assert.equal(A.weaponOnset(sample(1)),0);});
test('local shots trigger sound before network serialization in the same fire call',()=>{const g=fs.readFileSync('public/game.js','utf8'),fire=g.slice(g.indexOf('function fire(){'),g.indexOf('function emitPrismaticNovaShards'));assert.equal((fire.match(/playWorldSound\('shot-'\+activeShot/g)||[]).length,1);assert.ok(fire.indexOf("playWorldSound('shot-'+activeShot")<fire.indexOf('projectiles.push'));});
test('weapon sources start immediately and never replay a late download',()=>{const s=fs.readFileSync('public/abyssal-sample-audio.js','utf8');assert.match(s,/source\.start\(now,offset,duration\)/);assert.match(s,/WEAPONS\.has\(asset\)\?24:350/);});
