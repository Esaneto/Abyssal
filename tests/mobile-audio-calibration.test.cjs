'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const A=require('../public/abyssal-sample-audio.js');
function mixer(userAgent,saved={}){
 const changes={};
 const env={
  navigator:{userAgent},
  localStorage:{getItem:key=>Object.hasOwn(saved,key)?String(saved[key]):null},
  document:{hidden:false,addEventListener(){}},
  addEventListener:(name,fn)=>{changes[name]=fn;}
 };
 return {audio:A.createMixer(env),changes};
}
test('first-launch music is 50% and effects are 15%, including Android',()=>{
 for(const ua of ['Windows NT 10.0','Mozilla/5.0 (Linux; Android 16)']){
  const {audio}=mixer(ua),state=audio.inspect();
  assert.equal(state.musicVolume,.5);
  assert.equal(state.sfxVolume,.15);
  assert.equal(state.mobile,/Android/.test(ua));
  assert.equal(state.deviceSfxHeadroom,state.mobile?A.MIX.mobileHeadroom:1);
 }
 const game=fs.readFileSync('public/game.js','utf8'),html=fs.readFileSync('public/index.html','utf8');
 assert.match(game,/abyssalSfxVolume',15/);
 assert.match(game,/abyssalMusicVolume',50/);
 for(const [id,value] of [['diveSfxVolume',15],['diveMusicVolume',50]])
  assert.match(html,new RegExp('id="'+id+'"[^>]*value="'+value+'"'));
});
test('stored player choices override defaults and volume changes preserve exact percentages',()=>{
 const {audio}=mixer('Android',{abyssalMusicVolume:24,abyssalSfxVolume:76});
 assert.equal(audio.inspect().musicVolume,.24);
 assert.equal(audio.inspect().sfxVolume,.76);
 audio.setVolume('abyssalMusicVolume',.9);
 audio.setVolume('abyssalSfxVolume',.32);
 assert.equal(audio.inspect().musicVolume,.9);
 assert.equal(audio.inspect().sfxVolume,.32);
});
test('cue-level trim has a real proportional effect even for nearby/local weapons',()=>{
 for(const weapon of [false,true]){
  for(const distance of [0,60,650]){
   const low=A.spatialProfile({distance,range:850,volume:.2},weapon);
   const high=A.spatialProfile({distance,range:850,volume:.8},weapon);
   assert.ok(Math.abs(low.trim-.2)<1e-10);
   assert.ok(Math.abs(high.trim-.8)<1e-10);
   assert.ok(Math.abs(low.gain/high.gain-.25)<1e-10,'original event trim must not be bypassed');
  }
 }
 assert.equal(A.spatialProfile({volume:0},true).gain,0);
});
test('music waveform and player-controlled soundtrack gain remain independent from effects mix',()=>{
 assert.equal(A.ASSETS.music.gain,.72);
 assert.ok(A.MIX.effectRms<.13);
 assert.ok(A.MIX.mobileHeadroom>0&&A.MIX.mobileHeadroom<=1);
 for(const [id,asset] of Object.entries(A.ASSETS)){
  if(id==='music')continue;
  assert.equal(asset.gain,undefined,id+' should not retain an unused competing trim');
 }
});
