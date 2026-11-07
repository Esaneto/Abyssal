'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const World=require('../public/world-audio.js');
const Hazards=require('../public/abyssal-rift-hardcore.js');
function context(){
 const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>({frequency:param(),gain:param(),pan:param(),type:'sine',connect(){return this},disconnect(){},start(){},stop(){},onended:null});
 let buffers=0;
 return {state:'running',currentTime:0,sampleRate:44100,destination:node(),get bufferCount(){return buffers;},
  createOscillator:node,createGain:node,createBiquadFilter:node,createStereoPanner:node,
  createBufferSource:node,createBuffer(channels,length){buffers++;return{getChannelData(){return new Float32Array(length)}}}
 };
}
test('nine traps, eight bosses, all shot categories and twelve swimming families have unique local sounds',()=>{
 for(const type of Object.keys(Hazards.TYPES)){
  assert.ok(World.PATTERNS['hazard-'+type+'-warning'],type+' warning');
  assert.ok(World.PATTERNS['hazard-'+type+'-active'],type+' active');
 }
 for(const id of ['boss','angler','maw','leviathan','whiteSharkBoss','kraken','devourer','riftSmile']){
  assert.ok(World.PATTERNS['boss-'+id],id+' cry');
  assert.ok(World.PATTERNS['boss-attack-'+id],id+' attack');
 }
 for(const kind of ['electric','photon','pierce','spread','echoShot','nova','ricochet','default'])assert.ok(World.PATTERNS['shot-'+kind],kind);
 for(const family of ['fish','shark','ray','eel','octopus','squid','jelly','crustacean','mollusc','reptile','benthic','signature'])assert.ok(World.PATTERNS['swim-'+family],family);
 for(const id of ['orb','enemy-hit','enemy-death','player-hit','shield-hit','wall-hit','ui-click','ui-purchase','ui-upgrade','ui-roulette','portal','checkpoint','boss-defeated'])assert.ok(World.PATTERNS[id],id);
});
test('one noise buffer per AudioContext, no playback before gesture, cooldowns and voice cap',()=>{
 const c=context();
 c.state='suspended';assert.equal(World.play(c,'boss-kraken'),false);
 c.state='running';assert.equal(World.play(c,'boss-kraken'),true);
 assert.equal(c.bufferCount,1,'one tiny noise buffer');
 assert.equal(World.play(c,'boss-kraken'),false,'cooldown rejects repeated cries');
 c.currentTime=1.5;assert.equal(World.play(c,'boss-kraken'),true);
 assert.equal(c.bufferCount,1,'noise buffer reused');
 assert.equal(World.inspect(c).played,2);
 const names=Object.keys(World.PATTERNS);
 let started=0;
 for(let i=0;i<names.length;i++){
  c.currentTime+=.26;
  if(World.play(c,names[i],{lowPower:true}))started++;
 }
 assert.ok(started<=6,'mobile polyphony must cap at 6 voices');
 assert.ok(World.inspect(c).active<=6,'active mobile voice count cap');
 assert.ok(World.inspect(c).suppressed>0);
 assert.equal(World.play(c,'missing-sound'),false);
});
test('distant sound is dropped before any audio node is created',()=>{
 const c=context();
 assert.equal(World.play(c,'shot-electric',{distance:5000,range:400}),false);
 assert.equal(World.inspect(c).played,0);
 assert.equal(c.bufferCount,0);
});
test('source applies only local Web Audio and never fetches media or emits sound packets',()=>{
 const src=fs.readFileSync('public/world-audio.js','utf8');
 assert.doesNotMatch(src,/\b(fetch|XMLHttpRequest|WebSocket|socket\.emit|sendSkinAbility)\s*\(/);
 const game=fs.readFileSync('public/game.js','utf8');
 assert.match(game,/updateRiftHazardAudio\(\)/);
 assert.match(game,/playWorldSound\('shot-'\+activeShot/);
 assert.match(game,/playWorldSound\('boss-attack-'\+bossKind/);
 assert.match(game,/playWorldSound\('swim-'\+equippedMotionFamily\(\)/);
 const sw=fs.readFileSync('public/offline-sw.js','utf8');
 assert.match(sw,/'world-audio\.js'/);assert.match(sw,/'skin-motion\.js'/);
});
