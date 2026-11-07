'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const A=require('../public/world-audio.js');
const BOSSES=['boss','angler','maw','leviathan','whiteSharkBoss','kraken','devourer','riftSmile'];
function audioFixture(){
 const oscillators=[],filters=[],sources=[],buffers=[],compressors=[];
 function param(){const events=[];return{value:0,events,setValueAtTime(v,t){events.push({kind:'set',v,t})},
  linearRampToValueAtTime(v,t){events.push({kind:'linear',v,t})},
  exponentialRampToValueAtTime(v,t){events.push({kind:'exponential',v,t})}};}
 function node(type){return{type,frequency:param(),gain:param(),Q:param(),pan:param(),
  connect(){},disconnect(){},start(){},stop(){},onended:null};}
 const ctx={state:'running',currentTime:1.25,sampleRate:44100,destination:node('destination'),
  createOscillator(){const o=node('sine');oscillators.push(o);return o;},
  createGain(){return node('gain')},
  createBiquadFilter(){const o=node('lowpass');filters.push(o);return o;},
  createStereoPanner(){return node('pan');},
  createBufferSource(){const o=node('source');sources.push(o);return o;},
  createDynamicsCompressor(){const o=node('compressor');
   for(const k of ['threshold','knee','ratio','attack','release'])o[k]=param();
   compressors.push(o);return o;},
  createBuffer(channels,length){buffers.push({channels,length});return{getChannelData(){return new Float32Array(length)}}}
 };
 return{ctx,oscillators,filters,sources,buffers,compressors};
}
test('eight boss screams use different formants, four-point pitches, timbres and scary vocal identities',()=>{
 const waves=BOSSES.map(id=>A.PATTERNS['boss-'+id]);
 assert.equal(waves.length,8);
 for(const [i,cfg] of waves.entries()){
  assert.ok(cfg.voice,BOSSES[i]+' has no vocal identity');
  assert.ok(cfg.formant>=750,BOSSES[i]+' lacks an audible upper-register formant');
  assert.equal(cfg.contour.length,4);
  assert.ok(cfg.contour[2]>cfg.contour[0]*1.65,BOSSES[i]+' does not scream upwards');
  assert.ok(cfg.contour[3]<cfg.contour[2]*.6,BOSSES[i]+' does not collapse');
  assert.ok(cfg.duration>=1.3);
  assert.ok(cfg.noise>0&&cfg.layer>0);
  assert.ok(A.PATTERNS['boss-attack-'+BOSSES[i]]);
  assert.ok(A.PATTERNS['boss-death-'+BOSSES[i]],BOSSES[i]+' has no final scream');
 }
 assert.equal(new Set(waves.map(v=>v.voice+'|'+v.formant+'|'+v.contour.join(':'))).size,8);
});
test('monster screams really schedule rising pitches and throat formants, not just a metadata label',()=>{
 const a=audioFixture(),b=audioFixture();
 assert.equal(A.play(a.ctx,'boss-riftSmile'),true);
 assert.equal(a.oscillators.length,2,'desktop shriek uses two harmonics');
 const voice=a.oscillators[0].frequency.events;
 assert.ok(voice.length>=5,JSON.stringify(voice));
 const peaks=voice.map(x=>x.v);
 assert.ok(Math.max(...peaks)>Math.min(...peaks)*3.5,'nightmare voice lacks scary rise/fall');
 assert.ok(a.filters.some(x=>x.type==='bandpass'&&x.frequency.events.length>=3),'throat resonance is not automated');
 assert.equal(A.play(b.ctx,'boss-kraken',{lowPower:true}),true);
 assert.equal(b.oscillators.length,1,'mobile scream must use one oscillator');
 assert.equal(b.sources.length,1,'mobile uses one cached noise source');
 assert.equal(b.buffers.length,1);
 for(const x of a.oscillators.filter(o=>typeof o.onended==='function'))x.onended();
 assert.equal(A.inspect(a.ctx).active,0);
});
test('volcanic fire has layered crackle on desktop and one reusable noise on mobile',()=>{
 for(const phase of ['warning','active','sustain','end'])assert.ok(A.PATTERNS['hazard-volcano-'+phase].fire>0);
 assert.ok(A.PATTERNS['hazard-volcano-active'].crackle>0.8);
 assert.equal(A.PATTERNS['hazard-volcano-active'].texture,'inferno');
 assert.equal(A.PATTERNS['hazard-fumarole-active'].texture,'steam');
 const a=audioFixture(),low=audioFixture();
 assert.equal(A.play(a.ctx,'hazard-volcano-active'),true);
 assert.equal(A.play(low.ctx,'hazard-volcano-active',{lowPower:true}),true);
 assert.equal(a.buffers.length,1);assert.equal(low.buffers.length,1);
 assert.ok(a.buffers[0].length<=40000,'huge noise buffer allocation');
 assert.ok(a.filters.some(f=>f.type==='highpass'),'fire has no popping embers');
 assert.ok(!low.filters.some(f=>f.type==='highpass'),'mobile must avoid extra ember filter');
 assert.equal(low.sources.length,1);
 a.ctx.currentTime+=3;
 assert.equal(A.play(a.ctx,'hazard-fumarole-active'),true);
 assert.equal(a.buffers.length,1,'flame must reuse the original noise buffer');
});
test('boss encounters and deaths actually play distinct screams on both solo and online',()=>{
 const game=fs.readFileSync('public/game.js','utf8');
 assert.match(game,/playWorldSound\('boss-omen'/);
 assert.match(game,/playWorldSound\('boss-'\+kind/);
 assert.match(game,/playWorldSound\(killedBoss\?'boss-death-'\+e\.kind/);
 assert.match(game,/playWorldSound\(bosses\?'boss-death-'\+e\.kind/);
 assert.match(game,/playWorldSound\(bossCount\?'boss-death-'\+bossSoundKind/);
 assert.match(game,/renderBossAbilityVisual\(\{abilityId:d\.abilityId,kind:d\.kind/);
 for(const id of ['ink-trail','gulper-chomp','pressure-lance'])
  assert.ok(game.includes("renderBossAbilityVisual({abilityId:'"+id+"',kind:e.kind"));
 assert.match(game,/playWorldSound\('boss-attack-kraken',e/);
});
test('horror laboratory supports auditions and no multiplayer audio traffic is added',()=>{
 const lab=fs.readFileSync('public/audio-lab.html','utf8');
 const src=fs.readFileSync('public/world-audio.js','utf8');
 const sw=fs.readFileSync('public/offline-sw.js','utf8');
 for(const id of ['boss-riftSmile','boss-death-riftSmile','boss-kraken','boss-death-kraken',
  'hazard-volcano-active','hazard-volcano-sustain','hazard-fumarole-active','shot-nova'])
  assert.ok(lab.includes("'"+id+"'"),id+' missing from audio lab');
 assert.match(lab,/world-audio\.js\?v=2026\.11\.7\.23/);
 assert.match(sw,/2026-11-07-online-response-v22/);
 assert.doesNotMatch(src,/\b(fetch|XMLHttpRequest|WebSocket|socket\.emit)\s*\(/);
 assert.ok(A.PATTERNS['boss-omen']);
});
