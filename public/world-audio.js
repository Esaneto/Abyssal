/* Lightweight positional effects. All sounds are synthesized locally:
 * zero audio downloads, zero per-sound WebSocket traffic, no background timers.
 * A shared AudioContext is supplied by game.js after a user gesture. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.AbyssalWorldAudio=api;
})(globalThis,function(){
 'use strict';
 const P={};
 function sound(id,frequency,duration,wave='sine',end=.48,gain=.055,group='world',cooldown=170,filter=1500,noise=0){
  P[id]=Object.freeze({frequency,duration,wave,end,gain,group,cooldown,filter,noise});
 }
 // UI and events: independent of network messages and music volume.
 sound('ui-click',520,.055,'triangle',.86,.020,'ui',72,2000);
 sound('ui-open',365,.16,'sine',1.63,.039,'ui',140,1200);
 sound('ui-close',490,.09,'triangle',.52,.025,'ui',100,1800);
 sound('ui-error',185,.16,'triangle',.74,.052,'ui',230,600);
 sound('ui-equip',620,.20,'triangle',1.38,.040,'ui',140,1800);
 sound('ui-purchase',760,.33,'triangle',1.66,.054,'ui',250,2400);
 sound('ui-upgrade',510,.22,'sine',1.45,.044,'ui',260,1600);
 sound('ui-roulette',440,.14,'sine',1.33,.033,'ui',140,1900);
 sound('orb',780,.10,'sine',1.30,.017,'pickup',95,2000);
 sound('level-up',520,.35,'triangle',1.85,.056,'event',500,2100);
 sound('checkpoint',300,.50,'sine',.52,.049,'event',650,1000);
 sound('portal',132,.66,'sine',2.10,.063,'event',670,760,.08);
 sound('player-hit',120,.19,'triangle',.43,.075,'damage',175,780,.17);
 sound('enemy-hit',340,.06,'triangle',.52,.025,'damage',82,1750);
 sound('enemy-death',170,.16,'triangle',.39,.036,'damage',135,950,.12);
 sound('wall-hit',245,.08,'triangle',.48,.032,'damage',120,1100,.15);
 sound('shield-hit',430,.16,'sine',1.72,.046,'damage',300,1950);
 sound('ability-nova',96,.55,'sawtooth',.41,.070,'ability',700,1050,.18);
 sound('ability-beam',770,.11,'sine',.53,.028,'beam',110,1750);
 sound('ability-suction',110,.67,'sawtooth',2.6,.058,'ability',850,700,.37);
 sound('ability-dash',280,.19,'triangle',2.15,.048,'ability',260,1300,.25);
 sound('ability-poison',195,.33,'sine',.56,.041,'ability',520,870,.32);
 sound('shot-electric',720,.070,'square',.28,.030,'shot',80,2150);
 sound('shot-photon',1040,.12,'sine',.36,.037,'shot',110,2850);
 sound('shot-pierce',385,.14,'sawtooth',1.95,.035,'shot',115,1700);
 sound('shot-spread',580,.11,'triangle',.47,.030,'shot',100,1700);
 sound('shot-echoShot',375,.13,'sine',1.75,.038,'shot',120,1450);
 sound('shot-nova',205,.25,'sawtooth',.36,.047,'shot',250,1200);
 sound('shot-ricochet',845,.10,'triangle',1.55,.030,'shot',115,2300);
 sound('shot-default',500,.075,'triangle',.68,.025,'shot',90,1650);
 // Low-volume locomotion cues follow the equipped anatomical family.
 // Each channel is rate-limited; rapid movement creates no audio spam.
 const SWIMMING={
  fish:[330,'triangle'],shark:[190,'sine'],ray:[410,'sine'],
  eel:[275,'triangle'],octopus:[135,'sine'],squid:[355,'triangle'],
  jelly:[595,'sine'],crustacean:[260,'square'],mollusc:[190,'sine'],
  reptile:[175,'triangle'],benthic:[240,'sine'],signature:[350,'sine']
 };
 for(const [family,[pitch,wave]] of Object.entries(SWIMMING)){
  sound('swim-'+family,pitch,.14,wave,1.12,.014,'swim',900,1150,.06);
 }
 // Contact attacks remain unique without attaching expensive per-mob loops.
 for(const [kind,frequency] of Object.entries({drifter:475,stinger:800,brute:145,lurker:205})){
  sound('enemy-attack-'+kind,frequency,.21,kind==='stinger'?'square':'triangle',.48,.045,'enemy-attack',300,1000,.13);
 }
 const TRAPS={
  tentacle:[105,55,'sawtooth',.54,.65],rockfall:[120,78,'triangle',.44,.80],
  spikes:[650,195,'square',.42,.18],electric:[950,335,'square',.31,.08],
  fumarole:[185,82,'sawtooth',.67,.64],volcano:[220,69,'sawtooth',.49,.66],
  vortex:[146,76,'sine',1.76,.53],pressure:[99,49,'sawtooth',.57,.55],
  lure:[620,260,'sine',.65,.23]
 };
 for(const [kind,params] of Object.entries(TRAPS)){
  const [warning,active,wave,decay,noise]=params;
  sound('hazard-'+kind+'-warning',warning,.31,wave,1.29,.043,'hazard-warning',650,1200,noise*.26);
  sound('hazard-'+kind+'-active',active,.46,wave,decay,.071,'hazard-active',470,920,noise);
 }
 const BOSS={
  boss:[62,.48,610],angler:[90,1.64,750],maw:[39,.40,410],
  leviathan:[54,.77,550],whiteSharkBoss:[70,.49,900],
  kraken:[34,.42,410],devourer:[45,.32,440],riftSmile:[36,.50,500]
 };
 for(const [kind,[freq,end,filter]] of Object.entries(BOSS)){
  sound('boss-'+kind,freq,1.28,'sawtooth',end,.110,'boss',1450,filter,.48);
  sound('boss-attack-'+kind,freq*1.65,.34,'triangle',.34,.064,'boss-attack',380,filter*1.5,.15);
 }
 sound('boss-defeated',170,.86,'sine',.29,.094,'boss',1100,1180,.14);
 const PATTERNS=Object.freeze(P);
 const contexts=new WeakMap();
 function state(ctx){
  let s=contexts.get(ctx);
  if(!s){s={active:0,played:0,suppressed:0,last:Object.create(null),noise:null,generatedNoiseBuffers:0};contexts.set(ctx,s);}
  return s;
 }
 function noiseBuffer(ctx,s){
  if(s.noise)return s.noise;
  if(typeof ctx.createBuffer!=='function')return null;
  const sampleRate=ctx.sampleRate||44100,length=Math.min(14000,Math.round(sampleRate*.28));
  const buf=ctx.createBuffer(1,length,sampleRate),data=buf.getChannelData(0);
  let value=0x6d2b79f5;
  for(let i=0;i<length;i++){value^=value<<13;value^=value>>>17;value^=value<<5;data[i]=((value>>>0)/2147483648-1)*.70;}
  s.noise=buf;s.generatedNoiseBuffers++;return buf;
 }
 function inspect(ctx){const s=ctx&&contexts.get(ctx);return s?{active:s.active,played:s.played,suppressed:s.suppressed,generatedNoiseBuffers:s.generatedNoiseBuffers}:{active:0,played:0,suppressed:0,generatedNoiseBuffers:0};}
 function play(ctx,id,opts={}){
  const cfg=PATTERNS[id];
  if(!cfg||!ctx||ctx.state!=='running'||typeof ctx.createOscillator!=='function')return false;
  const s=state(ctx),now=Number(ctx.currentTime)||0;
  const maxVoices=opts.lowPower?6:10;
  if(s.active>=maxVoices){s.suppressed++;return false;}
  const last=s.last[id]??-Infinity,previousGroup=s.last['group:'+cfg.group]??-Infinity;
  if((now-last)*1000<cfg.cooldown||(now-previousGroup)*1000<(cfg.group==='shot'?65:cfg.group==='damage'?68:cfg.group==='ui'?58:cfg.group==='hazard-warning'?100:cfg.group==='hazard-active'?100:85)){
   s.suppressed++;return false;
  }
  const distance=Math.max(0,Number(opts.distance)||0),range=Math.max(140,Number(opts.range)||850);
  if(distance>range*1.6){s.suppressed++;return false;}
  const atten=1/(1+Math.pow(distance/(range*.48),2)),volume=Math.max(0,Math.min(1,Number(opts.volume??1)));
  const gain=Math.min(.17,cfg.gain*volume*atten);
  if(gain<.0004)return false;
  let oscillator=null,noise=null,output=null,panner=null,filter=null;
  try{
   oscillator=ctx.createOscillator();
   const envelope=ctx.createGain(),when=now+.005,duration=cfg.duration;
   oscillator.type=cfg.wave;
   oscillator.frequency.setValueAtTime(Math.max(30,cfg.frequency*(Number(opts.pitch)||1)),when);
   oscillator.frequency.exponentialRampToValueAtTime(Math.max(25,cfg.frequency*cfg.end*(Number(opts.pitch)||1)),when+duration);
   envelope.gain.setValueAtTime(.0001,when);
   envelope.gain.linearRampToValueAtTime(gain,when+Math.min(.028,duration*.18));
   envelope.gain.exponentialRampToValueAtTime(.0001,when+duration);
   output=ctx.createGain();output.gain.value=1;
   if(typeof ctx.createBiquadFilter==='function'){
    filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=cfg.filter;
    oscillator.connect(filter);filter.connect(envelope);
   }else oscillator.connect(envelope);
   envelope.connect(output);
   // Stereo placement is optional and skipped for reduced-power rendering.
   if(!opts.lowPower&&Number.isFinite(opts.pan)&&typeof ctx.createStereoPanner==='function'){
    panner=ctx.createStereoPanner();panner.pan.value=Math.max(-.85,Math.min(.85,opts.pan));
    output.connect(panner);panner.connect(ctx.destination);
   }else output.connect(ctx.destination);
   if(cfg.noise>0&&typeof ctx.createBufferSource==='function'){
    const buffer=noiseBuffer(ctx,s);
    if(buffer){
     noise=ctx.createBufferSource();noise.buffer=buffer;
     const ng=ctx.createGain();ng.gain.setValueAtTime(.0001,when);
     ng.gain.linearRampToValueAtTime(gain*cfg.noise*.72,when+.024);
     ng.gain.exponentialRampToValueAtTime(.0001,when+Math.min(duration,.275));
     noise.connect(ng);ng.connect(output);noise.start(when);noise.stop(when+Math.min(duration,.275));
    }
   }
   s.active++;s.played++;s.last[id]=now;s.last['group:'+cfg.group]=now;
   oscillator.onended=()=>{
    s.active=Math.max(0,s.active-1);
    try{oscillator.disconnect();filter?.disconnect();envelope.disconnect();noise?.disconnect();output.disconnect();panner?.disconnect();}catch(_){}
   };
   oscillator.start(when);oscillator.stop(when+duration+.01);
   return true;
  }catch(_){try{oscillator?.stop();noise?.stop();}catch(_){}s.suppressed++;return false;}
 }
 return {PATTERNS,TRAPS,BOSS,play,inspect};
});