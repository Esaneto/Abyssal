'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const A=require('../public/world-audio.js'),Hazards=require('../public/abyssal-rift-hardcore.js');
function fakeAudio(){
 const nodes=[];
 const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({connect(){},disconnect(){},frequency:param(),gain:param(),pan:param(),Q:param(),start(){},stop(){},onended:null});
 let compressors=0,buffers=0;
 const ctx={state:'running',currentTime:0,sampleRate:44100,destination:node(),
  createOscillator(){const n=node();nodes.push(n);return n;},
  createGain:node,createBiquadFilter:node,createStereoPanner:node,createBufferSource:node,
  createDynamicsCompressor(){compressors++;const n=node();n.threshold=param();n.knee=param();n.ratio=param();n.attack=param();n.release=param();return n;},
  createBuffer(ch,len){buffers++;return{getChannelData(){return new Float32Array(len);}}},
 };
 return{ctx,nodes,get compressors(){return compressors},get buffers(){return buffers}};
}
test('each abyssal boss has a distinguishable texture, secondary resonator, noise and spectral profile',()=>{
 const kinds=['boss','angler','maw','leviathan','whiteSharkBoss','kraken','devourer','riftSmile'];
 const profiles=kinds.map(kind=>A.PATTERNS['boss-'+kind]);
 for(const cfg of profiles){assert.ok(cfg.noise>0);assert.ok(cfg.layer>0);assert.ok(cfg.priority>=90);assert.ok(cfg.duration>=1);assert.ok(cfg.filter>0);}
 assert.equal(new Set(profiles.map(c=>[c.texture,c.wave,c.frequency,c.filter,c.layerRatio].join('|'))).size,8);
});
test('nine traps expose warning, impact, sustained danger and release identities',()=>{
 for(const kind of Object.keys(Hazards.TYPES)){
  for(const phase of ['warning','active','sustain','end']){
   const cfg=A.PATTERNS['hazard-'+kind+'-'+phase];
   assert.ok(cfg,kind+' missing '+phase);
   assert.ok(cfg.duration>.20,kind+' '+phase+' is inaudible');
  }
  assert.ok(A.PATTERNS['hazard-'+kind+'-warning'].priority>A.PATTERNS['hazard-'+kind+'-sustain'].priority);
 }
 const src=fs.readFileSync('public/game.js','utf8');
 assert.match(src,/playWorldSound\('hazard-'\+h\.type\+'-sustain'/);
 assert.match(src,/playWorldSound\('hazard-'\+h\.type\+'-end'/);
 assert.match(src,/phase\.phase==='warning'/);
 assert.match(src,/lowPowerRendering\?1390:920/);
});
test('warning preempts expendable sounds and pool never exceeds mobile cap',()=>{
 const a=fakeAudio();
 const families=['fish','shark','ray','eel','octopus','squid'];
 for(const family of families){a.ctx.currentTime+=1.2;assert.equal(A.play(a.ctx,'swim-'+family,{lowPower:true}),true);}
 assert.equal(A.inspect(a.ctx).active,6);
 a.ctx.currentTime+=.1;
 assert.equal(A.play(a.ctx,'hazard-tentacle-warning',{lowPower:true}),true,'danger warning must not be lost under swimming');
 const stats=A.inspect(a.ctx);
 assert.equal(stats.active,6);
 assert.equal(stats.preempted,1);
 assert.equal(a.compressors,1,'one shared dynamics compressor per context');
 assert.equal(a.buffers,1,'one recycled noise source buffer');
 for(const n of a.nodes.filter(x=>typeof x.onended==='function'))n.onended();
 assert.equal(A.inspect(a.ctx).active,0,'voices must clean up deterministically');
});
test('all acoustic synthesis stays local and respects distance, muted or suspended contexts',()=>{
 const a=fakeAudio();a.ctx.state='suspended';assert.equal(A.play(a.ctx,'boss-riftSmile'),false);
 a.ctx.state='running';
 assert.equal(A.play(a.ctx,'boss-riftSmile',{volume:0}),false);
 assert.equal(A.play(a.ctx,'boss-riftSmile',{distance:3000,range:600}),false);
 assert.equal(a.nodes.length,0);
 assert.equal(A.play(a.ctx,'boss-riftSmile'),true);
 assert.equal(a.buffers,1);
 assert.equal(A.play(a.ctx,'boss-riftSmile'),false);
 const src=fs.readFileSync('public/world-audio.js','utf8');
 assert.doesNotMatch(src,/\b(fetch|XMLHttpRequest|WebSocket|socket\.emit)\s*\(/);
 assert.match(src,/createDynamicsCompressor/);
 assert.match(src,/noiseBuffer\(ctx,s\)/);
});
test('audio wiring includes skill, UI, progression, hazard and mobile caps',()=>{
 const game=fs.readFileSync('public/game.js','utf8');
 for(const event of ['level-up','checkpoint','ui-upgrade','ui-equip','ui-error',
  'ability-dash','ability-poison','ability-nova','shot-ricochet','player-hit'])
  assert.ok(game.includes("'"+event+"'"),'missing call '+event);
 const shell=fs.readFileSync('public/offline-sw.js','utf8');
 const html=fs.readFileSync('public/index.html','utf8');
 assert.match(shell,/2026-11-07-cinematic-screams-v21/);
 assert.match(html,/world-audio\.js\?v=2026\.11\.7\.23/);
});

test('sound laboratory offers standalone listening without loading extra files in the game',()=>{
 const lab=fs.readFileSync('public/audio-lab.html','utf8');
 const shell=fs.readFileSync('public/offline-sw.js','utf8');
 assert.match(lab,/ABYSSAL · LABORATÓRIO SONORO/);
 assert.match(lab,/AbyssalWorldAudio/);
 assert.match(lab,/new \(window\.AudioContext\|\|window\.webkitAudioContext\)\(\)/);
 assert.match(lab,/ctx\.resume\(\)/);
 assert.match(lab,/source\.play\(ctx,id/);
 assert.match(lab,/hazard-'\+type\+'-sustain/);
 assert.doesNotMatch(shell,/'audio-lab\.html'/,'audio lab must not increase the game offline shell download');
});
