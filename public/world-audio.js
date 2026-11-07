/* Abyssal acoustic identities: locally synthesized, spatialized and prioritized.
 * Shared Web AudioContext; no media downloads, networking, timers or asset bundles.
 * Low power: one tone + one cached noise buffer, at most six active effects.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.AbyssalWorldAudio=api;
})(globalThis,function(){
 'use strict';
 const P=Object.create(null);
 const add=(id,options)=>{P[id]=Object.freeze({
  frequency:options.f??440,duration:options.d??.16,wave:options.w??'sine',
  end:options.end??.65,gain:options.g??.04,group:options.group??'event',
  cooldown:options.cd??175,filter:options.filter??1600,noise:options.noise??0,
  texture:options.texture??'soft',filterType:options.filterType??'lowpass',
  layer:options.layer??0,layerRatio:options.layerRatio??2.04,
  attack:options.attack??.012,priority:options.priority??45,
  // Vocal formants and four-part pitch contours create horror cries rather
  // than one descending electronic beep; entirely scheduled in Web Audio.
  voice:options.voice??null,contour:options.contour??null,
  formant:options.formant??0,fire:options.fire??0,crackle:options.crackle??0
 });};
 // Quiet interface hierarchy: clicks are brief; purchases have an ascending,
 // recognizable two-tone response; errors always descend.
 const ui={
  'ui-click':[630,.047,.88,'dry'], 'ui-open':[385,.15,1.54,'shimmer'],
  'ui-close':[490,.11,.55,'dry'], 'ui-error':[250,.22,.54,'thud'],
  'ui-equip':[580,.25,1.52,'chime'], 'ui-purchase':[640,.41,1.72,'chime'],
  'ui-upgrade':[470,.27,1.38,'chime'], 'ui-roulette':[440,.14,1.35,'chime']
 };
 for(const [id,[f,d,end,texture]] of Object.entries(ui))
  add(id,{f,d,end,texture,group:'ui',w:'triangle',g:id==='ui-purchase'?.05:.027,
   filter:2300,cd:105,priority:50,group:id==='ui-click'?'ui-tap':'ui',layer:texture==='chime'?.19:0,layerRatio:1.50});
 add('orb',{f:730,d:.115,end:1.37,texture:'bubble',w:'sine',g:.013,group:'pickup',cd:110,priority:12,filter:2400});
 add('level-up',{f:490,d:.49,end:1.72,texture:'chime',g:.058,layer:.32,layerRatio:1.50,priority:80,cd:700});
 add('checkpoint',{f:290,d:.55,end:1.42,texture:'hollow',g:.059,noise:.12,priority:82,cd:620});
 add('portal',{f:105,d:.79,end:2.30,texture:'suction',w:'triangle',g:.063,noise:.23,layer:.18,filter:880,priority:90,cd:700});
 add('player-hit',{f:180,d:.23,end:.39,texture:'thud',w:'triangle',g:.081,noise:.35,filter:1100,priority:100,cd:175});
 add('enemy-hit',{f:350,d:.067,end:.5,texture:'dry',w:'triangle',g:.027,noise:.22,priority:32,cd:85});
 add('enemy-death',{f:235,d:.19,end:.32,texture:'thud',w:'triangle',g:.04,noise:.2,priority:38,cd:145});
 add('wall-hit',{f:260,d:.095,end:.46,texture:'crack',w:'triangle',g:.034,noise:.43,filter:1500,priority:37,cd:120});
 add('shield-hit',{f:520,d:.25,end:1.55,texture:'ring',g:.049,layer:.21,layerRatio:1.79,priority:92,cd:270});
 add('ability-nova',{f:108,d:.73,end:.22,texture:'blast',w:'sawtooth',g:.080,noise:.81,filter:1250,layer:.19,priority:84,cd:650});
 add('ability-beam',{f:910,d:.13,end:.72,texture:'hiss',w:'sine',g:.032,noise:.16,filter:2500,priority:48,cd:110});
 add('ability-suction',{f:130,d:.88,end:2.9,texture:'suction',w:'triangle',g:.063,noise:.53,filter:900,priority:88,cd:820});
 add('ability-dash',{f:340,d:.23,end:2.20,texture:'whoosh',w:'triangle',g:.046,noise:.47,priority:65,cd:290});
 add('ability-poison',{f:205,d:.44,end:.55,texture:'bubble',w:'sine',g:.043,noise:.34,filter:980,priority:55,cd:500});
 // Attacks communicate projectile material, energy and collision separately.
 const SHOTS={
  electric:[920,.092,.29,'crackle','square',.48,3150],
  photon:[1120,.17,.46,'ring','sine',.15,3100],
  pierce:[360,.16,2.00,'crack','sawtooth',.23,1900],
  spread:[620,.11,.50,'dry','triangle',.42,2050],
  echoShot:[410,.20,1.75,'shimmer','sine',.25,1700],
  nova:[168,.44,.17,'blast','sawtooth',.85,1300],
  ricochet:[810,.14,1.53,'chime','triangle',.16,2750],
  default:[570,.090,.62,'dry','triangle',.14,1700]
 };
 for(const [id,[f,d,end,texture,w,noise,filter]] of Object.entries(SHOTS))
  add('shot-'+id,{f,d,end,texture,w,noise,filter,group:'shot',g:.034,priority:52,cd:80,layer:id==='photon'?.16:0});
 // Locomotion is barely audible: a short, filtered water displacement rather
 // than a repeating electronic beep. Medusae and molluscs remain near silent.
 const SWIMMING={
  fish:[210,.016,.21],shark:[145,.021,.35],ray:[240,.012,.12],
  eel:[178,.015,.34],octopus:[130,.018,.28],squid:[225,.015,.29],
  jelly:[310,.005,.13],crustacean:[245,.014,.19],mollusc:[110,.005,.09],
  reptile:[135,.020,.26],benthic:[118,.008,.17],signature:[198,.013,.20]
 };
 for(const [family,[f,g,noise]] of Object.entries(SWIMMING))
  add('swim-'+family,{f,d:.22,end:.82,texture:'whoosh',w:'sine',noise,
   g,group:'swim',filter:650,priority:5,cd:1050,attack:.035});
 for(const [kind,[f,texture]] of Object.entries({
  drifter:[490,'crackle'],stinger:[850,'crack'],brute:[155,'thud'],lurker:[225,'suction']}))
  add('enemy-attack-'+kind,{f,d:.23,end:.40,texture,w:'triangle',
   g:.052,noise:.30,filter:1350,group:'enemy-attack',priority:70,cd:310});
 // Different physical material for each cave trap. Each trap has four phases:
 // warning, impact, subdued sustained texture, and safe-to-move release.
 const TRAPS=Object.freeze({
  tentacle:{f:155,w:'triangle',texture:'stretch',filter:700,noise:.62,layer:.19,layerRatio:1.44},
  rockfall:{f:118,w:'triangle',texture:'rattle',filter:1550,noise:.80,layer:.16,layerRatio:3.25},
  spikes:{f:740,w:'square',texture:'crack',filter:1850,noise:.45,layer:0},
  electric:{f:1350,w:'square',texture:'crackle',filter:3100,noise:.47,layer:.12,layerRatio:1.60},
  fumarole:{f:210,w:'sine',texture:'steam',filter:1800,noise:.94,layer:.09,layerRatio:2.50},
  volcano:{f:118,w:'sawtooth',texture:'inferno',filter:1250,noise:.91,layer:.18,layerRatio:2.12},
  vortex:{f:145,w:'triangle',texture:'suction',filter:900,noise:.65,layer:.20,layerRatio:1.39},
  pressure:{f:76,w:'triangle',texture:'thud',filter:650,noise:.43,layer:.18,layerRatio:2.60},
  lure:{f:690,w:'sine',texture:'chime',filter:2250,noise:.18,layer:.29,layerRatio:1.47}
 });
 // Fictitious horror vocals: shrieks, bellows, wails and demonic roars.
 // No copyrighted samples, downloads or creature recordings are needed.
 // These frequencies keep the scream audible on small mobile speakers.
 const ATTACKS=Object.freeze({
  boss:{f:195,end:.45,texture:'rattle',voice:'shriek',w:'sawtooth',contour:[.68,1.3,3.05,.41],formant:1900,noise:.48,filter:2750,layerRatio:2.20}, // toxic high-pitch shriek
  angler:{f:240,end:.33,texture:'crack',voice:'shriek',w:'sawtooth',contour:[.54,1.38,2.75,.40],formant:2200,noise:.28,filter:2700,layerRatio:2.30}, // screaming jaws
  maw:{f:108,end:.30,texture:'throat',voice:'growl',w:'sawtooth',contour:[.75,1.45,2.05,.31],formant:840,noise:.57,filter:1400,layerRatio:1.60}, // guttural bellow
  leviathan:{f:114,end:.68,texture:'sing',voice:'wail',w:'triangle',contour:[.78,1.55,2.4,.55],formant:1350,noise:.22,filter:1550,layerRatio:1.82}, // abyssal lament
  whiteSharkBoss:{f:157,end:.28,texture:'whoosh',voice:'roar',w:'sawtooth',contour:[.8,1.4,2.6,.26],formant:1400,noise:.78,filter:2200,layerRatio:1.93}, // savage snarl
  kraken:{f:148,end:.43,texture:'stretch',voice:'banshee',w:'sawtooth',contour:[.56,1.62,3.04,.39],formant:1760,noise:.67,filter:2500,layerRatio:2.21}, // tentacled screech
  devourer:{f:99,end:.25,texture:'suction',voice:'void',w:'sawtooth',contour:[.66,1.8,2.55,.23],formant:1180,noise:.69,filter:1750,layerRatio:2.16}, // demonic suction howl
  riftSmile:{f:232,end:.21,texture:'throat',voice:'nightmare',w:'sawtooth',contour:[.42,1.25,3.75,.22],formant:2450,noise:.66,filter:3100,layerRatio:2.57} // final nightmare scream
 });
 const BOSS=Object.freeze(Object.fromEntries(Object.entries(ATTACKS).map(([k,v])=>[k,[v.f,v.end,v.filter]])));
 for(const [kind,cfg] of Object.entries(TRAPS)){
  const pyro=kind==='volcano',steam=kind==='fumarole';
  add('hazard-'+kind+'-warning',{...cfg,f:cfg.f*1.24,d:pyro?.62:.46,end:1.26,g:.050,noise:cfg.noise*.42,
   fire:pyro?.30:steam?.18:0,crackle:pyro?.20:0,
   group:'hazard-warning',cd:490,priority:95,attack:.018});
  add('hazard-'+kind+'-active',{...cfg,d:pyro?1.20:steam?.92:.61,end:pyro?.23:kind==='vortex'?1.67:.46,g:pyro?.094:.067,
   texture:pyro?'inferno':steam?'steam':cfg.texture,fire:pyro?.93:steam?.55:0,crackle:pyro?.9:0,group:'hazard-active',
   cd:230,priority:88,attack:.007});
  add('hazard-'+kind+'-sustain',{...cfg,d:pyro?1.1:.85,end:kind==='vortex'?1.35:.84,g:pyro?.037:.025,
   noise:cfg.noise*.57,texture:pyro?'inferno':steam?'steam':cfg.texture,fire:pyro?.67:steam?.35:0,
   crackle:pyro?.60:0,
   group:'hazard-sustain',cd:550,priority:28,attack:.065,layer:0});
  add('hazard-'+kind+'-end',{...cfg,f:cfg.f*.84,d:.26,end:1.45,g:.025,noise:cfg.noise*.25,
   fire:pyro?.25:0,crackle:pyro?.30:0,
   group:'hazard-release',cd:200,priority:41,layer:0});
 }
 // Spawn: a terrifying full vocal. During combat: short violent barks,
 // snaps and rumbles. Death: a distinct falling cry.
 for(const [kind,cfg] of Object.entries(ATTACKS)){
  const terrible=['riftSmile','kraken','angler','devourer'].includes(kind);
  add('boss-'+kind,{...cfg,d:kind==='leviathan'?1.95:kind==='riftSmile'?1.78:1.50,
   g:.106,layer:.30,group:'boss',cd:1600,priority:98,attack:.037});
  add('boss-attack-'+kind,{...cfg,f:cfg.f*1.34,d:kind==='riftSmile'?.60:.39,
   end:cfg.end*.68,texture:kind==='whiteSharkBoss'?'crack':cfg.texture,
   voice:terrible?'snarl':null,contour:terrible?[.82,1.3,1.85,.39]:null,
   g:.069,layer:.18,group:'boss-attack',cd:520,priority:90,attack:.009});
  add('boss-death-'+kind,{...cfg,f:cfg.f*.82,d:kind==='riftSmile'?1.90:1.18,
   contour:[1.4,1.85,.91,.19],voice:cfg.voice,g:.083,noise:cfg.noise*.84,
   layer:.22,group:'boss-death',cd:1100,priority:91,attack:.015});
 }
 add('boss-defeated',{f:190,d:1.02,end:.29,texture:'throat',w:'triangle',
  noise:.30,layer:.25,layerRatio:1.43,g:.091,priority:88,group:'boss',cd:1100});
 // A single cinematic pressure boom accents a boss arrival, then falls silent.
 add('boss-omen',{f:125,d:.70,end:.19,texture:'blast',w:'triangle',g:.064,
  noise:.52,filter:1150,layer:.19,priority:96,group:'cinematic',cd:1700,attack:.012});
 const PATTERNS=Object.freeze(P),contexts=new WeakMap();
 function state(ctx){let s=contexts.get(ctx);
  if(!s){s={active:0,played:0,suppressed:0,preempted:0,last:Object.create(null),
   noise:null,generatedNoiseBuffers:0,voices:new Set(),bus:null};contexts.set(ctx,s);}
  return s;
 }
 function noiseBuffer(ctx,s){
  if(s.noise)return s.noise;
  if(typeof ctx.createBuffer!=='function')return null;
  // 0.84 s of deterministic noise avoids an obvious repeating 280 ms hiss.
  // One cached ~150 KB buffer per AudioContext, not per effect.
  const length=Math.min(40000,Math.round((ctx.sampleRate||44100)*.84));
  const buf=ctx.createBuffer(1,length,ctx.sampleRate||44100),data=buf.getChannelData(0);
  let seed=0x6d2b79f5;
  for(let i=0;i<length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
   data[i]=((seed>>>0)/2147483648-1)*.70;}
  s.noise=buf;s.generatedNoiseBuffers++;return buf;
 }
 function bus(ctx,s){
  if(s.bus)return s.bus;
  if(typeof ctx.createDynamicsCompressor==='function'){
   const compressor=ctx.createDynamicsCompressor();
   compressor.threshold.value=-16;compressor.knee.value=12;compressor.ratio.value=4.5;
   compressor.attack.value=.006;compressor.release.value=.16;compressor.connect(ctx.destination);
   s.bus=compressor;
  }else s.bus=ctx.destination;
  return s.bus;
 }
 function inspect(ctx){const s=ctx&&contexts.get(ctx);return s?{
  active:s.active,played:s.played,suppressed:s.suppressed,preempted:s.preempted,
  generatedNoiseBuffers:s.generatedNoiseBuffers
 }:{active:0,played:0,suppressed:0,preempted:0,generatedNoiseBuffers:0};}
 function play(ctx,id,opts={}){
  const cfg=PATTERNS[id];
  if(!cfg||!ctx||ctx.state!=='running'||typeof ctx.createOscillator!=='function')return false;
  const s=state(ctx),now=Number(ctx.currentTime)||0,lowPower=Boolean(opts.lowPower);
  const distance=Math.max(0,Number(opts.distance)||0),range=Math.max(140,Number(opts.range)||850);
  if(distance>range*1.6){s.suppressed++;return false;}
  const attenuation=1/(1+Math.pow(distance/(range*.48),2)),
   volume=Math.max(0,Math.min(1,Number(opts.volume??1))),
   gain=Math.min(.15,cfg.gain*volume*attenuation);
  if(gain<.00035)return false;
  const last=s.last[id]??-Infinity,previous=s.last['group:'+cfg.group]??-Infinity;
  const interval=cfg.group==='shot'?65:cfg.group==='damage'?68:cfg.group==='ui'?55:80;
  if((now-last)*1000<cfg.cooldown||(now-previous)*1000<interval){s.suppressed++;return false;}
  const limit=lowPower?6:10;
  if(s.voices.size>=limit){
   let weakest=null;for(const voice of s.voices)
    if(!weakest||voice.priority<weakest.priority)weakest=voice;
   if(!weakest||cfg.priority<=weakest.priority){s.suppressed++;return false;}
   weakest.stop();s.preempted++;
  }
  const when=now+.005,duration=cfg.duration,created=[],sources=[],connections=[];
  let voice;
  function connect(source,target){source.connect(target);connections.push(source);}
  function oscillator(frequency,wave,end,amplitude,layer=false){
   const osc=ctx.createOscillator(),env=ctx.createGain();
   const filter=typeof ctx.createBiquadFilter==='function'?ctx.createBiquadFilter():null;
   const voice=Boolean(cfg.voice),f=Math.max(30,frequency),contour=cfg.contour;
   osc.type=voice?(cfg.voice==='wail'?'triangle':'sawtooth'):wave;
   if(voice&&Array.isArray(contour)&&contour.length===4){
    // Inhale, painful ascent, screaming peak and descending collapse.
    const pitch=v=>Math.max(28,Math.min(7500,f*v));
    osc.frequency.setValueAtTime(pitch(contour[0]),when);
    osc.frequency.exponentialRampToValueAtTime(pitch(contour[1]),when+duration*.24);
    osc.frequency.exponentialRampToValueAtTime(pitch(contour[2]),when+duration*.58);
    osc.frequency.exponentialRampToValueAtTime(pitch(contour[2]*.83),when+duration*.75);
    osc.frequency.exponentialRampToValueAtTime(pitch(contour[3]),when+duration);
   }else{
    osc.frequency.setValueAtTime(f,when);
    const middle=(cfg.texture==='bubble'||cfg.texture==='suction'||cfg.texture==='sing')?
     Math.max(30,f*(end>1?1.28:.87)):Math.max(30,f*.81);
    osc.frequency.exponentialRampToValueAtTime(middle,when+duration*.52);
    osc.frequency.exponentialRampToValueAtTime(Math.max(25,f*end),when+duration);
   }
   env.gain.setValueAtTime(.0001,when);
   const attack=layer?.02:Math.max(.004,Math.min(cfg.attack,duration*.24));
   if(voice){
    env.gain.linearRampToValueAtTime(amplitude*.47,when+Math.max(.018,attack));
    env.gain.linearRampToValueAtTime(amplitude,when+duration*.36);
    env.gain.setValueAtTime(Math.max(.0001,amplitude*.61),when+duration*.52);
    env.gain.linearRampToValueAtTime(amplitude*.92,when+duration*.68);
   }else if(cfg.fire>0||cfg.texture==='blast'){
    env.gain.linearRampToValueAtTime(amplitude,when+Math.min(.028,duration*.06));
    for(let j=1;j<=5;j++)env.gain.setValueAtTime(
     Math.max(.0001,amplitude*(.34+.32*(1+Math.sin(j*3.7)))),when+duration*(.09+j*.125));
   }else{
    env.gain.linearRampToValueAtTime(amplitude,when+attack);
    if(['crackle','rattle','stretch'].includes(cfg.texture)){
     const n=cfg.texture==='rattle'?5:3;
     for(let j=1;j<n;j++){
      const x=when+attack+(duration-attack)*(j/n);
      env.gain.setValueAtTime(Math.max(.0001,amplitude*(j%2?.35:.88)),x);
     }
    }
   }
   env.gain.exponentialRampToValueAtTime(.0001,when+duration);
   if(filter){
    filter.type=voice?(cfg.voice==='growl'||cfg.voice==='roar'?'lowpass':'bandpass'):cfg.filterType;
    if(voice&&cfg.formant>0){
     const center=cfg.formant*(layer?1.23:1);
     filter.frequency.setValueAtTime(Math.max(180,center*.60),when);
     filter.frequency.exponentialRampToValueAtTime(Math.max(220,center*1.48),when+duration*.51);
     filter.frequency.exponentialRampToValueAtTime(Math.max(180,center*.77),when+duration);
     if(filter.Q)filter.Q.value=cfg.voice==='nightmare'||cfg.voice==='shriek'?1.25:.79;
    }else{filter.frequency.value=cfg.filter;if(filter.Q)filter.Q.value=.73;}
    connect(osc,filter);connect(filter,env);created.push(filter);
   }else connect(osc,env);
   connect(env,output);created.push(env);
   sources.push(osc);osc.start(when);osc.stop(when+duration+.01);
   return osc;
  }
  let output;
  try{
   output=ctx.createGain();output.gain.value=.76;
   let panNode=null;
   if(!lowPower&&Number.isFinite(opts.pan)&&typeof ctx.createStereoPanner==='function'){
    panNode=ctx.createStereoPanner();panNode.pan.value=Math.max(-.8,Math.min(.8,opts.pan));
    connect(output,panNode);connect(panNode,bus(ctx,s));created.push(panNode);
   }else connect(output,bus(ctx,s));
   created.push(output);
   const primary=oscillator(cfg.frequency*(Number(opts.pitch)||1),cfg.wave,cfg.end,gain);
   if(!lowPower&&cfg.layer>0){
    oscillator(cfg.frequency*cfg.layerRatio, cfg.texture==='chime'?'sine':'triangle',
     cfg.end>1?.84:cfg.end*.79,gain*cfg.layer,true);
   }
   if(cfg.noise>0&&typeof ctx.createBufferSource==='function'){
    const b=noiseBuffer(ctx,s);
    if(b){
     const src=ctx.createBufferSource(),ng=ctx.createGain();
     src.buffer=b;src.loop=true;
     const amplitude=gain*cfg.noise*(cfg.fire>0?.80:.65);
     ng.gain.setValueAtTime(.0001,when);
     ng.gain.linearRampToValueAtTime(amplitude,when+(cfg.fire>0||cfg.texture==='blast'?.015:Math.max(.012,cfg.attack)));
     if(cfg.fire>0){
      // Flame/steam noise rises and flickers with scheduled gain automation.
      for(let j=1;j<=7;j++){
       const flicker=Math.sin(j*8.17+cfg.frequency*.013)*.25+.75;
       ng.gain.setValueAtTime(Math.max(.0001,amplitude*flicker),when+duration*(j/9));
      }
     }else if(cfg.texture==='blast'){
      ng.gain.setValueAtTime(amplitude*.95,when+duration*.13);
      ng.gain.exponentialRampToValueAtTime(Math.max(.0001,amplitude*.22),when+duration*.55);
     }
     ng.gain.exponentialRampToValueAtTime(.0001,when+duration);
     if(typeof ctx.createBiquadFilter==='function'){
      const nf=ctx.createBiquadFilter();
      nf.type=cfg.fire>0?'lowpass':'bandpass';
      nf.frequency.value=Math.max(140,cfg.filter*(cfg.texture==='steam'?1.25:cfg.fire>0?.91:.80));
      if(nf.Q)nf.Q.value=cfg.texture==='steam'?.42:cfg.fire>0?.65:.8;
      connect(src,nf);connect(nf,ng);created.push(nf);
     }else connect(src,ng);
     connect(ng,output);created.push(ng);
     if(cfg.crackle>0&&!lowPower&&typeof ctx.createBiquadFilter==='function'){
      // A second frequency band on the SAME cached noise source pops like embers.
      const high=ctx.createBiquadFilter(),pop=ctx.createGain();
      high.type='highpass';high.frequency.value=1400+cfg.crackle*950;
      pop.gain.setValueAtTime(.0001,when);
      for(let i=0;i<7;i++){
       const t=when+duration*(.09+i*.115);
       const loud=gain*cfg.crackle*(.15+.5*(.5+.5*Math.sin(i*7.9+cfg.frequency)));
       pop.gain.setValueAtTime(.0001,t);
       pop.gain.linearRampToValueAtTime(Math.max(.0001,loud),t+.008);
       pop.gain.exponentialRampToValueAtTime(.0001,t+.042);
      }
      pop.gain.setValueAtTime(.0001,when+duration);
      connect(src,high);connect(high,pop);connect(pop,output);
      created.push(high,pop);
     }
     sources.push(src);src.start(when);src.stop(when+duration+.015);
    }
   }
   let done=false;
   const finish=()=>{if(done)return;done=true;s.voices.delete(voice);s.active=s.voices.size;
    for(const n of new Set([...connections,...created,...sources]))try{n.disconnect();}catch(_){}};
   voice={priority:cfg.priority,stop:()=>{
    if(done)return;for(const n of sources)try{n.stop(when+Math.min(duration,.025));}catch(_){}
    finish();
   }};
   primary.onended=finish;
   s.voices.add(voice);s.active=s.voices.size;s.played++;
   s.last[id]=now;s.last['group:'+cfg.group]=now;
   return true;
  }catch(_){
   for(const n of sources)try{n.stop(when+.01);}catch(_){}
   for(const n of new Set([...connections,...created,...sources]))try{n.disconnect();}catch(_){}
   s.suppressed++;return false;
  }
 }
 return {PATTERNS,TRAPS,BOSS,play,inspect};
});
