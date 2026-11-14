const test=require('node:test'),assert=require('node:assert/strict');
const Audio=require('../public/abyssal-sample-audio.js');
test('death cue produces original fading PCM without an external asset',()=>{
 const ctx={sampleRate:22050,createBuffer(ch,n,sr){const data=new Float32Array(n);return {length:n,numberOfChannels:ch,sampleRate:sr,duration:n/sr,getChannelData:()=>data};}};
 const b=Audio.buildDeathCry(ctx),d=b.getChannelData(0),rms=(from,to)=>Math.sqrt(d.slice(from,to).reduce((s,v)=>s+v*v,0)/(to-from));
 assert.equal(Audio.cueAsset('player-death'),'playerDeath');assert.ok(b.duration>1.8);
 assert.ok(rms(1200,6000)>rms(d.length-5000,d.length)*4);assert.ok(d.every(Number.isFinite));assert.ok(Math.abs(d[d.length-1])<.001);
});
