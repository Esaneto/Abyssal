'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Audio=require('../public/world-audio.js'),Hazards=require('../public/abyssal-rift-hardcore.js'),AI=require('../public/enemy-ai.js');
function fakeContext(){
 const nodes=[],node=()=>({connect(){},disconnect(){},onended:null,
  frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},
  gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},value:0},
  start(){},stop(){},pan:{value:0},Q:{value:0}});
 const ctx={state:'running',currentTime:1,sampleRate:22050,destination:{},
  createOscillator(){const n=node();nodes.push(n);return n;},
  createGain:node,createBiquadFilter:node,createStereoPanner:node,
  createBuffer(_channels,length){return{getChannelData(){return new Float32Array(length)}}},
  createBufferSource:node};
 return{ctx,nodes};
}
test('all nine trap families have independent warning and impact sound',()=>{
 for(const kind of Object.keys(Hazards.TYPES)){
  assert.ok(Audio.PATTERNS['hazard-'+kind+'-warning'],kind+' warning absent');
  assert.ok(Audio.PATTERNS['hazard-'+kind+'-active'],kind+' activation absent');
 }
});
test('all eight boss types have dedicated roar and attack cues',()=>{
 for(const kind of AI.BOSS_KINDS){
  assert.ok(Audio.PATTERNS['boss-'+kind],kind+' roar absent');
  assert.ok(Audio.PATTERNS['boss-attack-'+kind],kind+' attack absent');
 }
});
test('every shot, swim, UI and contact class produces local sounds',()=>{
 for(const kind of ['electric','photon','pierce','spread','echoShot','nova','ricochet','default'])
  assert.ok(Audio.PATTERNS['shot-'+kind],'missing shot '+kind);
 for(const family of ['fish','shark','ray','eel','octopus','squid','jelly','crustacean','mollusc','reptile','benthic','signature'])
  assert.ok(Audio.PATTERNS['swim-'+family],'missing movement '+family);
 for(const id of ['orb','level-up','checkpoint','portal','player-hit','enemy-hit','enemy-death',
   'wall-hit','shield-hit','ability-beam','ability-poison','ability-nova','ability-dash',
   'ui-click','ui-open','ui-close','ui-error','ui-equip','ui-purchase','ui-upgrade','ui-roulette',
   'enemy-attack-brute','enemy-attack-drifter','enemy-attack-lurker','enemy-attack-stinger'])
  assert.ok(Audio.PATTERNS[id],id+' is inaudible');
});
test('suspended or missing AudioContext cannot create voices or download media',()=>{
 const {ctx,nodes}=fakeContext();ctx.state='suspended';
 assert.equal(Audio.play(ctx,'shot-electric'),false);
 assert.equal(Audio.play(null,'shot-electric'),false);
 assert.equal(Audio.play({},'shot-electric'),false);
 assert.equal(Audio.play(ctx,'nonexistent-effect'),false);
 assert.equal(nodes.length,0);
});
test('audio synthesizer limits active voices and does not regenerate noise on every trigger',()=>{
 const {ctx,nodes}=fakeContext();
 for(let i=0;i<30;i++){ctx.currentTime=1+i*.25;Audio.play(ctx,'hazard-rockfall-active');}
 const d=Audio.inspect(ctx);
 assert.equal(d.active,10,'voice cap exceeded');
 assert.equal(d.played,10);
 assert.equal(d.generatedNoiseBuffers,1,'noise buffer was repeatedly allocated');
 assert.ok(d.suppressed>=20);
 const activeNodes=nodes.filter(n=>typeof n.onended==='function');
 assert.ok(activeNodes.length>=10);
 activeNodes[0].onended();
 assert.equal(Audio.inspect(ctx).active,9,'voice never released');
 ctx.currentTime+=3;
 assert.equal(Audio.play(ctx,'boss-riftSmile'),true,'voice should be available after release');
});
test('low-power mode limits voices to six and spatial attenuation avoids remote sounds',()=>{
 const {ctx}=fakeContext();
 for(let i=0;i<12;i++){ctx.currentTime=1+i*.3;Audio.play(ctx,'shot-default',{lowPower:true});}
 assert.equal(Audio.inspect(ctx).active,6);
 const before=Audio.inspect(ctx).played;
 assert.equal(Audio.play(ctx,'boss-kraken',{distance:2000,range:500}),false);
 assert.equal(Audio.inspect(ctx).played,before);
});
test('audio and skin animation modules are shipped in offline shell, without socket protocol changes',()=>{
 const html=fs.readFileSync('public/index.html','utf8');
 const sw=fs.readFileSync('public/offline-sw.js','utf8');
 const game=fs.readFileSync('public/game.js','utf8');
 assert.match(html,/src="world-audio\.js\?v=/);
 assert.match(html,/src="skin-motion\.js\?v=/);
 assert.match(sw,/'world-audio\.js'/);
 assert.match(sw,/'skin-motion\.js'/);
 assert.match(game,/AbyssalWorldAudioDiagnostics/);
 assert.match(game,/updateRiftHazardAudio/);
 assert.match(game,/playWorldSound\('shot-'/);
 assert.doesNotMatch(game,/send[A-Za-z]+\([^\n]*audio[Cc]ue/);
});

test('muting the master slider silences even the legacy cues',()=>{
 const game=fs.readFileSync('public/game.js','utf8');
 assert.match(game,/slider\.value = Math\.round\(clamp\(masterSoundVolume,0,1\) \* 100\)/);
 assert.match(game,/if\(!soundOn\|\|masterSoundVolume<=0\|\|document\.hidden\)return/);
 assert.doesNotMatch(game,/vol \* 2\.8 \* \(masterSoundVolume \|\| 0\.8\)/);
});
