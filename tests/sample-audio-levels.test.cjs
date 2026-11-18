'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../public/abyssal-sample-audio.js');
function sample(amplitude){
 const pcm=Float32Array.from({length:12000},(_,i)=>amplitude*Math.sin(i*.3));
 return {length:pcm.length,duration:1,sampleRate:12000,numberOfChannels:1,getChannelData:()=>pcm};
}
test('quiet and loud effects normalize to the same active window loudness',()=>{
 for(const id of ['electric','photon','pierce','echo','nova','beam','damage','pulse','dash','cloud','bite','boss','orb','kill','repair','destroyed']){
  const x=sample(.2),y=sample(.7);
  const lx=A.normalizedGain(id,x)*A.measureSample(x).loudness;
  const ly=A.normalizedGain(id,y)*A.measureSample(y).loudness;
  assert.ok(Math.abs(lx-ly)<.001,id+': '+lx+' vs '+ly);
 }
});
test('shots and effects now use a shared conservative reference without clipped peaks',()=>{
 const reference=sample(.4),shot=A.normalizedGain('electric',reference),effect=A.normalizedGain('damage',reference);
 assert.ok(Math.abs(shot-effect)<.002,'weapons must not have a 2x loudness bonus');
 for(const id of ['electric','damage','boss','beam','orb']){
  for(const amplitude of [.001,.1,.3,1]){
   const pcm=sample(amplitude),normal=A.normalizedGain(id,pcm),m=A.measureSample(pcm);
   assert.ok(normal<=A.MIX.maxBoost,id+' must not magnify weak recording noise');
   assert.ok(normal*m.peak<=A.MIX.peakCeiling+1e-6,id+' must retain transient headroom');
  }
 }
 assert.equal(A.normalizedGain('damage',sample(0)),0);
 assert.equal(A.normalizedGain('music',reference),A.ASSETS.music.gain,'music recording must be untouched');
});
test('isolated initial transient does not dictate the perceived sample loudness',()=>{
 const pcm=new Float32Array(24000);
 for(let i=0;i<pcm.length;i++)pcm[i]=.06*Math.sin(i*.09);
 pcm[2]=.98;
 const buffer={length:pcm.length,duration:2,sampleRate:12000,numberOfChannels:1,getChannelData:()=>pcm};
 const m=A.measureSample(buffer);
 assert.ok(m.peak>.9&&m.loudness>.03&&m.loudness<.07,'measure sustained content, not one click');
 assert.ok(A.normalizedGain('damage',buffer)*m.peak<=A.MIX.peakCeiling+1e-6);
});
