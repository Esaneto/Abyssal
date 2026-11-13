'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../public/abyssal-sample-audio.js');
function sample(amplitude){const pcm=Float32Array.from({length:12000},(_,i)=>amplitude*Math.sin(i*.3));return {length:pcm.length,duration:1,sampleRate:12000,numberOfChannels:1,getChannelData:()=>pcm};}
test('quiet and loud samples normalize to the same active RMS',()=>{for(const id of ['electric','photon','pierce','echo','nova','beam','damage','pulse','dash','cloud','bite','boss','orb','kill','repair','destroyed']){const x=sample(.2),y=sample(.7);assert.ok(Math.abs(A.normalizedGain(id,x)*A.measureSample(x).rms-A.normalizedGain(id,y)*A.measureSample(y).rms)<.001,id);}});
test('weapons are louder than effects with bounded peak and boost',()=>{const x=sample(.4);assert.ok(A.normalizedGain('electric',x)>A.normalizedGain('damage',x)*1.8);assert.ok(A.normalizedGain('beam',x)>A.normalizedGain('repair',x));assert.ok(A.normalizedGain('electric',sample(.00001))<=A.MIX.maxBoost);assert.equal(A.normalizedGain('damage',sample(0)),0);});
