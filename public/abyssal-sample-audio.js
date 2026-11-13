/* Sample-based Abyssal mixer. No synthesized fallback or gameplay-critical awaits. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.AbyssalAudio=api.createMixer(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ASSETS=Object.freeze({
  music:{file:'music/musica.mp3',gain:.72,group:'music'},
  damage:{file:'effects/dano.wav',gain:.66,group:'combat',priority:68,max:.85},
  pulse:{file:'effects/pulsos.wav',gain:.82,group:'shot',priority:84,max:1.6},
  dash:{file:'effects/investida.ogg',gain:.76,group:'shot',priority:80,max:1.5},
  cloud:{file:'effects/nuvem_toxica.wav',gain:.70,group:'shot',priority:77,max:1.8},
  bite:{file:'effects/bite.wav',gain:.70,group:'combat',priority:55,max:1.1},
  boss:{file:'effects/boss_entrance.wav',gain:.92,group:'critical',priority:100},
  orb:{file:'effects/collect_orb.wav',gain:.62,group:'reward',priority:64,max:1},
  echo:{file:'effects/eco_da_mare.wav',gain:.78,group:'shot',priority:82,max:1.5},
  kill:{file:'effects/kill.wav',gain:.68,group:'reward',priority:62,max:1.25},
  photon:{file:'effects/lanca_de_fotons.wav',gain:.78,group:'shot',priority:82,max:1.35},
  pierce:{file:'effects/lanca_do_abismo.wav',gain:.78,group:'shot',priority:82,max:1.35},
  nova:{file:'effects/nova_gravitacional.ogg',gain:.86,group:'shot',priority:88,max:2},
  beam:{file:'effects/raio_de_fotons.wav',gain:.57,group:'loop',priority:86},
  repair:{file:'effects/reparar_sub.wav',gain:.67,group:'loop',priority:76},
  destroyed:{file:'effects/submarino_destruido.ogg',gain:.90,group:'critical',priority:98},
  electric:{file:'effects/tempestade_eletrica.wav',gain:.79,group:'shot',priority:82,max:1.25}
 });
 const CUES=Object.freeze({'shot-electric':'electric','shot-photon':'photon','shot-pierce':'pierce','shot-echoShot':'echo','shot-nova':'nova','shot-photonRay':'beam','enemy-death':'kill','boss-defeated':'kill','orb':'orb','bite':'bite','boss-entrance':'boss','submarine-destroyed':'destroyed','submarine-repair':'repair','player-hit':'damage','enemy-hit':'damage','specimen-hit':'damage','ability-nova':'pulse','ability-dash':'dash','ability-poison':'cloud'});
 function abilityCue(id){const key=String(id||'').replace(/^wildlife-/,'').toLowerCase();if(['push','pulse','bio-shock','gulper-chomp','pressure-impact','rupture-pulse','abyssal-pulse','pressure-pulse'].includes(key))return 'pulse';if(['shot','slowshot','pressure-lance','hypothermic-projectile','colossal-shot'].includes(key))return 'echo';if(['cloud','toxic-cloud','monster-toxic-cloud'].includes(key))return 'cloud';if(key==='dash')return 'dash';return null;}
 function cueAsset(id){return CUES[id]||(/^boss-death-/.test(id)?'kill':/^enemy-attack-/.test(id)?'bite':null);}
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // Separate sound identity from loudness. Measure the active part of each
 // decoded sample once, not in the gameplay/audio hot path.
 const WEAPONS=new Set(['electric','photon','pierce','echo','nova','beam']);
 const MIX=Object.freeze({weaponRms:.25,effectRms:.13,peakCeiling:.94,maxBoost:8,weaponPriority:94});
 function measureSample(buffer,maxDuration){
  const frames=Math.min(buffer.length,Math.max(1,Math.floor((maxDuration||buffer.duration)*buffer.sampleRate)));
  const step=Math.max(1,Math.floor(buffer.sampleRate/12000));
  let peak=0,sum=0,count=0;
  for(let ch=0;ch<buffer.numberOfChannels;ch++){
   const pcm=buffer.getChannelData(ch);
   for(let i=0;i<frames;i+=step)peak=Math.max(peak,Math.abs(pcm[i]));
  }
  const gate=Math.max(.0001,peak*.035);
  for(let ch=0;ch<buffer.numberOfChannels;ch++){
   const pcm=buffer.getChannelData(ch);
   for(let i=0;i<frames;i+=step){const v=pcm[i];if(Math.abs(v)>=gate){sum+=v*v;count++;}}
  }
  return {peak,rms:count?Math.sqrt(sum/count):0};
 }
 function normalizedGain(id,buffer){
  if(id==='music')return ASSETS.music.gain;
  const {peak,rms}=measureSample(buffer,ASSETS[id]?.max);
  if(!rms||!peak)return 0;
  const target=WEAPONS.has(id)?MIX.weaponRms:MIX.effectRms;
  return Math.min(target/rms,MIX.peakCeiling/peak,MIX.maxBoost);
 }
 function voiceGain(id,normalization,space){
  // Per-call volume is an artistic trim, not a second independent mix.
  // Preserve distance and stereo while narrowing arbitrary gain differences.
  return normalization*space.attenuation*space.trim;
 }
 // Listener-relative world coordinates. The 2D ocean is mapped to the
 // horizontal acoustic plane: above on screen = front; below = rear.
 // No automatic distance attenuation in the HRTF node (we apply it once).
 function spatialProfile(options={},weapon=false){
  const distance=Math.max(0,Number(options.distance)||0),range=Math.max(100,Number(options.range)||850);
  const far=range*1.5,near=range*.12;
  if(distance>=far)return null;
  const t=clamp((distance-near)/(far-near),0,1);
  const attenuation=weapon?(1-t*t*(3-2*t))/(1+3.8*t*t):1/(1+(distance/(range*.65))**2);
  const requested=clamp(Number(options.volume??1),0,1),trim=requested===0?0:weapon&&distance<=near?1:.8+.2*requested;
  const dx=Number(options.dx),dy=Number(options.dy),directional=Number.isFinite(dx)&&Number.isFinite(dy)&&Math.hypot(dx,dy)>1;
  const length=directional?Math.hypot(dx,dy):1;
  const pan=directional?clamp(dx/length,-.95,.95):clamp(Number(options.pan)||0,-.85,.85);
  // Unit sphere maintains direction independently of the gain curve.
  // A centered/local weapon stays in front, not at the listener origin.
  const direction=directional?{x:dx/length,y:0,z:dy/length}:{x:0,y:0,z:-1};
  const cutoff=weapon?18000*Math.pow(1600/18000,t):18000;
  return {gain:attenuation*trim,attenuation,trim,pan,direction,directional,cutoff};
 }
 function createMixer(env){
  let ctx=null,master=null,sfx=null,musicBus=null,musicVoice=null,muted=false,hidden=Boolean(env.document?.hidden),started=false,warm=false,loopTimer=null,epoch=0,duckUntil=0;
  const buffers=new Map(),normalizations=new Map(),loading=new Map(),failedUntil=new Map(),voices=new Set(),loops=new Map(),recent=new Map(),pending=new Map();
  const metrics={played:0,overlapped:0,stolen:0,deduplicated:0,inaudible:0,notReady:0,errors:0};
  const clock=()=>env.performance?.now?.()??Date.now();
  const read=(key,def)=>{try{const raw=env.localStorage?.getItem(key);return raw===null||raw===undefined?def:clamp(Number(raw)||0,0,100)/100;}catch{return def;}};
  let sfxVolume=read('abyssalSfxVolume',.8),musicVolume=read('abyssalMusicVolume',.45);
  function smooth(param,value,seconds=.035){if(!ctx||!param)return;const now=ctx.currentTime;try{param.cancelScheduledValues(now);param.setTargetAtTime(value,now,seconds);}catch{param.value=value;}}
  function setup(){
   if(ctx)return true;
   const AC=env.AudioContext||env.webkitAudioContext;if(!AC)return false;
   try{
    ctx=new AC({latencyHint:'interactive'});master=ctx.createGain();sfx=ctx.createGain();musicBus=ctx.createGain();
    const limiter=ctx.createDynamicsCompressor();
    limiter.threshold.value=-6;limiter.knee.value=10;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.12;
    master.gain.value=muted||hidden?0:1;sfx.gain.value=sfxVolume;musicBus.gain.value=musicVolume;
    sfx.connect(master);musicBus.connect(master);master.connect(limiter);limiter.connect(ctx.destination);return true;
   }catch{metrics.errors++;return false;}
  }
  function load(id){
   if(buffers.has(id))return Promise.resolve(buffers.get(id));
   if(loading.has(id))return loading.get(id);
   if(!ctx||!ASSETS[id]||(failedUntil.get(id)||0)>clock())return Promise.resolve(null);
   const task=(async()=>{
    try{
     const url=new URL('audio/'+ASSETS[id].file,env.document?.baseURI||env.location?.href||'http://localhost/');
     const res=await env.fetch(url.href,{cache:'force-cache'});if(!res.ok)throw Error('audio HTTP '+res.status);
     const decoded=await ctx.decodeAudioData(await res.arrayBuffer());buffers.set(id,decoded);normalizations.set(id,normalizedGain(id,decoded));return decoded;
    }catch(error){metrics.errors++;failedUntil.set(id,clock()+15000);env.console?.warn?.('[AbyssalAudio]',id,error.message);return null;}
    finally{loading.delete(id);}
   })();
   loading.set(id,task);return task;
  }
  async function prewarm(){
   if(warm)return;warm=true;
   // Short high-frequency samples and the selected music first; the large
   // continuous beam is last. No synchronous decode or wait in the game loop.
   const order=['electric','music','damage','pulse','bite','orb','kill','photon','pierce','echo','dash','cloud','nova','boss','destroyed','repair','beam'];
   for(let i=0;i<order.length;i+=2)await Promise.all(order.slice(i,i+2).map(load));
  }
  function cleanVoice(v){if(v.done)return;v.done=true;voices.delete(v);if(v.key&&loops.get(v.key)===v)loops.delete(v.key);for(const n of [v.source,v.gain,v.pan,v.filter])try{n?.disconnect();}catch{}}
  function stopVoice(v,fade=.045){if(!v||v.done||v.stopping)return;v.stopping=true;const now=ctx.currentTime;try{v.gain.gain.cancelScheduledValues(now);v.gain.gain.setTargetAtTime(0,now,Math.max(.005,fade/3));v.source.stop(now+fade);}catch{cleanVoice(v);}}
  function spatial(options,id){return spatialProfile(options,WEAPONS.has(id));}
  function placePanner(node,direction,instant=false){
   if(!node)return;
   if(node.positionX&&node.positionY&&node.positionZ){
    if(instant){node.positionX.value=direction.x;node.positionY.value=direction.y;node.positionZ.value=direction.z;}
    else{smooth(node.positionX,direction.x);smooth(node.positionY,direction.y);smooth(node.positionZ,direction.z);}
   }else node.setPosition?.(direction.x,direction.y,direction.z);
  }
  function priorityFor(id,options){return (WEAPONS.has(id)?MIX.weaponPriority:ASSETS[id].priority)+(options.local?12:0);}
  function allocate(id,options){
   const cfg=ASSETS[id],priority=priorityFor(id,options),active=[...voices].filter(v=>!v.stopping);
   const group=cfg.group,groupVoices=active.filter(v=>v.group===group);
   const groupCap=group==='shot'?14:group==='loop'?5:group==='critical'?4:group==='reward'?6:6;
   const same=active.filter(v=>v.id===id&&v.owner===String(options.owner||'world'));
   const cap=group==='shot'?(options.local?8:4):group==='reward'?4:group==='combat'?3:group==='critical'?3:5;
   let candidates=same.length>=cap?same:groupVoices.length>=groupCap?groupVoices:active.length>=24?active:null;
   if(candidates){
    candidates=candidates.filter(v=>v.priority<=priority&&!v.protected);
    candidates.sort((a,b)=>a.priority-b.priority||a.started-b.started);
    if(!candidates.length){metrics.inaudible++;return false;}
    stopVoice(candidates[0],.025);metrics.stolen++;
   }
   return true;
  }
  function createVoice(id,buffer,options,loopKey=null){
   if(!ctx||ctx.state!=='running'||muted||hidden||!buffer)return null;
   const cfg=ASSETS[id],space=spatial(options,id);if(!space||space.gain<.006){metrics.inaudible++;return null;}
   if(!allocate(id,options))return null;
   // A large same-tick burst cannot accumulate hundreds of fading sources.
   if(voices.size>=32){const oldest=[...voices].find(v=>v.stopping);if(oldest)cleanVoice(oldest);else{metrics.inaudible++;return null;}}
   const source=ctx.createBufferSource(),gain=ctx.createGain();let pan=null,filter=null,hrtf=false;
   source.buffer=buffer;source.loop=Boolean(loopKey);
   if(loopKey){source.loopStart=0;source.loopEnd=buffer.duration;}
   source.connect(gain);
   let tail=gain;
   if(WEAPONS.has(id)&&typeof ctx.createBiquadFilter==='function'){
    filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=space.cutoff;filter.Q.value=.5;tail.connect(filter);tail=filter;
   }
   // HRTF is binaural stereo, not discrete 7.1. Keep the local weapon centered
   // and limit costly HRTF voices; stereo fallback retains all distance cues.
   if(WEAPONS.has(id)&&typeof ctx.createPanner==='function'&&(space.directional||loopKey)&&[...voices].filter(v=>v.hrtf&&!v.stopping).length<6){
    try{pan=ctx.createPanner();pan.panningModel='HRTF';pan.distanceModel='inverse';pan.refDistance=1;pan.rolloffFactor=0;pan.maxDistance=10000;placePanner(pan,space.direction,true);hrtf=true;}
    catch{try{pan?.disconnect();}catch{}pan=null;hrtf=false;}
   }
   if(!pan&&typeof ctx.createStereoPanner==='function'){pan=ctx.createStereoPanner();pan.pan.value=space.pan;}
   if(pan){tail.connect(pan);tail=pan;}tail.connect(sfx);
   const now=ctx.currentTime,amplitude=voiceGain(id,normalizations.get(id)??normalizedGain(id,buffer),space),voice={source,gain,pan,filter,hrtf,id,group:cfg.group,owner:String(options.owner||'world'),priority:priorityFor(id,options),protected:cfg.group==='critical'||Boolean(loopKey&&options.local),key:loopKey,started:clock(),expires:0,updated:0,done:false,stopping:false};
   source.onended=()=>cleanVoice(voice);gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(amplitude,now+.008);
   voices.add(voice);
   try{if(loopKey){loops.set(loopKey,voice);voice.expires=clock()+Number(options.leaseMs||450);voice.updated=clock();source.start(now+.004);}
   else{
    const duration=Math.min(buffer.duration,cfg.max||buffer.duration);
    const release=Math.min(.12,Math.max(.025,duration*.18));
    gain.gain.setValueAtTime(amplitude,now+Math.max(.009,duration-release));gain.gain.linearRampToValueAtTime(0,now+duration);
    source.start(now+.004,0,duration);if([...voices].some(v=>v!==voice&&v.id===id&&!v.stopping))metrics.overlapped++;
   }
   }catch(error){metrics.errors++;cleanVoice(voice);return null;}
   metrics.played++;
   if(cfg.group==='critical')duck(Math.min(3,buffer.duration));
   return voice;
  }
  function duck(seconds){
   if(!ctx)return;const now=ctx.currentTime;duckUntil=Math.max(duckUntil,now+seconds);
   try{const p=musicBus.gain;p.cancelScheduledValues(now);p.setTargetAtTime(musicVolume*.35,now,.035);p.setTargetAtTime(musicVolume,duckUntil,.18);}catch{}
  }
  function rememberEvent(id,options){
   if(!options.eventId)return true;
   const key=id+':'+String(options.owner||'world')+':'+String(options.eventId),now=clock();
   if(recent.has(key)&&now-recent.get(key)<5000){metrics.deduplicated++;return false;}
   recent.set(key,now);if(recent.size>256)for(const [k,t] of recent){if(now-t>5000||recent.size>256)recent.delete(k);if(recent.size<=192)break;}
   return true;
  }
  function play(id,options={}){
   const asset=ASSETS[id]?id:cueAsset(id);
   if(!asset||muted||hidden||sfxVolume<=0||!ctx||ctx.state!=='running')return false;
   if(!spatial(options,asset))return false;
   if(!rememberEvent(asset,options))return false;
   const b=buffers.get(asset);
   if(b)return Boolean(createVoice(asset,b,options));
   // Do not accumulate a queue of obsolete shots during the initial download.
   // The freshest event for each emitter may still play if decoding finishes promptly.
   const key=asset+':'+String(options.owner||'world'),token={at:clock(),epoch,options};
   pending.set(key,token);metrics.notReady++;
   load(asset).then(buffer=>{if(pending.get(key)!==token)return;pending.delete(key);if(buffer&&token.epoch===epoch&&clock()-token.at<350)createVoice(asset,buffer,options);});
   return false;
  }
  function loop(id,key,options={}){
   if(!ASSETS[id]||muted||hidden||sfxVolume<=0||!ctx||ctx.state!=='running')return false;
   key=id+':'+String(key);const now=clock(),space=spatial(options,id),old=loops.get(key);
   if(!space||space.gain<.006){if(old)stopVoice(old);return false;}
   if(old&&!old.stopping){
    old.expires=now+(Number(options.leaseMs)||450);
    if(now-old.updated>=80){old.updated=now;smooth(old.gain.gain,voiceGain(id,normalizations.get(id)||0,space));if(old.filter)smooth(old.filter.frequency,space.cutoff,.06);if(old.hrtf)placePanner(old.pan,space.direction);else if(old.pan)smooth(old.pan.pan,space.pan);}
    return true;
   }
   const b=buffers.get(id);if(!b){load(id);return false;}
   const voice=createVoice(id,b,options,key);if(!voice)return false;
   if(!loopTimer)loopTimer=env.setInterval(()=>{const t=clock();for(const v of loops.values())if(v.expires<t)stopVoice(v);if(!loops.size){env.clearInterval(loopTimer);loopTimer=null;}},100);
   return true;
  }
  function stopLoop(id,key){const v=loops.get(id+':'+String(key));if(v)stopVoice(v);}
  function stopEffects(){epoch++;pending.clear();for(const v of voices)stopVoice(v);recent.clear();}
  async function startMusic(){
   if(!ctx||ctx.state!=='running'||musicVoice||hidden||muted)return;
   const buffer=await load('music');if(!buffer||musicVoice||hidden||muted||ctx.state!=='running')return;
   const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=ASSETS.music.gain;source.connect(gain);gain.connect(musicBus);musicVoice={source,gain};source.onended=()=>{if(musicVoice?.source===source)musicVoice=null;try{source.disconnect();gain.disconnect();}catch{}};source.start();
  }
  async function unlock(){
   if(!setup())return false;try{if(ctx.state!=='running')await ctx.resume();}catch{return false;}
   if(ctx.state!=='running')return false;started=true;prewarm();startMusic();return true;
  }
  function setVolume(channel,value){value=clamp(Number(value)||0,0,1);if(channel==='abyssalMusicVolume'){musicVolume=value;if(ctx&&ctx.currentTime<duckUntil)duck(duckUntil-ctx.currentTime);else smooth(musicBus?.gain,value);}else if(channel==='abyssalSfxVolume'){sfxVolume=value;smooth(sfx?.gain,value);if(!value)stopEffects();}}
  function setMuted(value){muted=Boolean(value);smooth(master?.gain,muted||hidden?0:1);if(muted)stopEffects();else if(started)startMusic();}
  function setHidden(value){hidden=Boolean(value);smooth(master?.gain,hidden||muted?0:1);if(hidden)stopEffects();else if(started){if(ctx?.state==='suspended')ctx.resume().catch(()=>{});startMusic();}}
  function inspect(){return {...metrics,active:voices.size,loops:loops.size,decoded:buffers.size,decodedBytes:[...buffers.values()].reduce((n,b)=>n+b.length*b.numberOfChannels*4,0),loading:loading.size,musicPlaying:Boolean(musicVoice),sfxVolume,musicVolume,state:ctx?.state||'locked'};}
  env.addEventListener?.('pointerdown',unlock,{capture:true,passive:true});env.addEventListener?.('keydown',unlock,{capture:true});env.addEventListener?.('touchstart',unlock,{capture:true,passive:true});
  env.addEventListener?.('abyssal-volume-change',e=>setVolume(e.detail?.channel,e.detail?.value));
  env.document?.addEventListener?.('visibilitychange',()=>setHidden(env.document.hidden));
  env.addEventListener?.('pagehide',()=>setHidden(true));env.addEventListener?.('pageshow',()=>setHidden(Boolean(env.document?.hidden)));
  return {unlock,play,loop,stopLoop,stopEffects,setMuted,setVolume,startMusic,inspect,abilityCue};
 }
 return {ASSETS,CUES,MIX,cueAsset,abilityCue,measureSample,normalizedGain,spatialProfile,createMixer};
});
