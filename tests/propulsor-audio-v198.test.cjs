const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {buildPropulsorBed,ASSETS}=require('../public/abyssal-sample-audio.js');
test('turbine uses original dash and produces a finite stereo seamless bed',()=>{
 const sr=8000,make=(ch,n,sr)=>{const data=Array.from({length:ch},()=>new Float32Array(n));return {sampleRate:sr,length:n,numberOfChannels:ch,duration:n/sr,getChannelData:i=>data[i]}};
 const source=make(2,sr*1.5,sr);for(let ch=0;ch<2;ch++){const a=source.getChannelData(ch);for(let i=0;i<a.length;i++)a[i]=.3*Math.sin(i*.08);}
 const bed=buildPropulsorBed({createBuffer:make},source);assert.equal(ASSETS.propulsor.file,ASSETS.dash.file);assert.equal(bed.numberOfChannels,2);assert.ok(bed.duration>3);
 for(let ch=0;ch<2;ch++){const a=bed.getChannelData(ch);assert.ok(a.every(v=>Number.isFinite(v)&&Math.abs(v)<=.901));assert.ok(a.some(v=>Math.abs(v)>.02));assert.ok(Math.abs(a[0]-a[a.length-1])<.15);}
});
test('propulsor loops are leased and stop when motion ceases',()=>{const game=fs.readFileSync(require.resolve('../public/game.js'),'utf8');assert.match(game,/player\.propulsorEquipped&&player\.propulsorMoving&&Number\(player\.propulsorEnergy\)>0/);assert.match(game,/stopLoop\('propulsor',key\)/);assert.match(game,/syncPropulsorAudio\(t,active\)/);assert.match(game,/peer\.propulsorMoving/);});
