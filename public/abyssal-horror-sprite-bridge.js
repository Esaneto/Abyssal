/* Optional marine Dark Fantasy sprite atlases for Solo/Online and equipped Ecos.
 * No atlas installed: safe fallback to the existing renderer and existing AI.
 * Load species lazily; do not decode all 26 huge images on Android startup.
 */
(function(root){
 'use strict';
 const previous=root.AbyssalAnimatedSprites;if(!previous)return;
 const IDS=["drifter","stinger","brute","lurker","whiteShark","boss","angler","maw","leviathan","whiteSharkBoss","kraken","devourer","riftSmile"];
 // Never substitute one equipped Eco species for another (e.g. Reef Shark for White Shark).
 const aliases=Object.freeze({});
 const spans=Object.freeze({whiteShark:3.5,whiteSharkBoss:3.6,leviathan:4.0,kraken:4.4,boss:3.7,devourer:4.2,riftSmile:3.5,maw:3.7});
 const canonical=id=>aliases[String(id||'')]||String(id||'');
 const loaded=new Map(),failed=new Set(),loading=new Map();
 const available=new Set(),valid=new Set(IDS);
 let active=false,lastSweep=0;
 const now=()=>typeof root.performance?.now==='function'?root.performance.now():Date.now();
 function loadImage(url){
  return new Promise(resolve=>{
   if(typeof root.Image!=='function'){resolve(null);return;}
   const img=new root.Image();img.decoding='async';
   img.onload=()=>resolve(img.naturalWidth===1680&&img.naturalHeight===1280?img:null);
   img.onerror=()=>resolve(null);img.src=url;
  });
 }
 function loadSpecies(id){
  if(!active||!available.has(id)||loaded.has(id)||failed.has(id)||loading.has(id))return;
  const task=Promise.all(['swim','attack'].map(mode=>loadImage('abyssal-horror/'+id+'/'+mode+'.webp')))
   .then(([swim,attack])=>{if(swim&&attack)loaded.set(id,{swim,attack,lastUsed:now()});else failed.add(id);})
   .catch(()=>failed.add(id)).finally(()=>loading.delete(id));
  loading.set(id,task);
 }
 async function preloadHorror(){
  if(typeof root.fetch!=='function')return;
  try{
   const res=await root.fetch('abyssal-horror/manifest.json',{cache:'no-store'});
   if(!res.ok)return;
   const m=await res.json();
   if(m?.enabled!==true||m?.columns!==4||m?.rows!==4||m?.frameWidth!==420||m?.frameHeight!==320||!Array.isArray(m.creatures))return;
   for(const id of m.creatures)if(valid.has(id))available.add(id);
   active=available.size>0;
  }catch(_){/* Missing/unavailable atlas: preserve legacy art. */}
 }
 function has(id){
  const k=canonical(id);
  return (active&&available.has(k)&&!failed.has(k))||Boolean(previous.has(id));
 }
 function isBiting(state,clock){return previous.isBiting?.(state,clock)===true;}
 // Prefer the most recent *active* attack event. An expired bite must not
 // override a fresh tentacle or electricity visual cue.
 function attackProgress(state,t,attack,clock){
  if(!attack)return -1;
  if(!state)return previous.biteProgress?.(state,t,true,clock)??-1;
  const events=[];
  for(const item of [state.hostileBite,state.biteAnimation]){
   const started=Number(item?.startedAt),duration=Math.max(1,Number(item?.duration)||380);
   if(item&&Number.isFinite(started)&&started>=0&&clock>=started&&clock<started+duration)
    events.push({started,duration});
  }
  const until=Number(state.visualBiteUntil),visualStart=Number(state.visualBiteStartedAt);
  if(Number.isFinite(until)&&until>clock){
   const started=Number.isFinite(visualStart)&&visualStart>0?visualStart:until-380;
   if(clock>=started)events.push({started,duration:Math.max(1,until-started)});
  }
  if(!events.length)return previous.biteProgress?.(state,t,true,clock)??-1;
  events.sort((a,b)=>b.started-a.started);
  const event=events[0];
  return Math.min(.999999,Math.max(0,(clock-event.started)/event.duration));
 }
 function drawAtOrigin(c,id,r,t,attack,hit=0,state=null){
  const k=canonical(id);
  if(active&&available.has(k))loadSpecies(k);
  const art=loaded.get(k);
  if(!art)return previous.drawAtOrigin(c,id,r,t,attack,hit,state);
  if(!c||!(Number(r)>0))return false;
  const clock=now(),p=attackProgress(state,t,Boolean(attack),clock);
  const biting=Boolean(attack)&&Number.isFinite(p)&&p>=0;
  const swimPhase=(Math.max(0,Number(t)||0)/83.333333)%15;
  const attackPhase=biting?Math.min(15,Math.max(0,p*15)):0;
  const smoothstep=v=>{const x=Math.min(1,Math.max(0,v));return x*x*(3-2*x);};
  // A 72 ms crossfade at each edge of a 480 ms contact attack prevents
  // a visible teleport between two different illustrated poses.
  const attackWeight=biting?smoothstep(p/.15)*smoothstep((1-p)/.15):0;
  const w=(spans[k]||3.25)*r,h=w*320/420;
  const eel=k==='lurker'||k==='maw';
  const draw=(sheet,frame,opacity)=>{
   if(opacity<=.003)return;
   c.globalAlpha=opacity;
   const sx=(frame%4)*420,sy=Math.floor(frame/4)*320;
   if(!eel){c.drawImage(sheet,sx,sy,420,320,-w/2,-h/2,w,h);return;}
   // Anatomical head-to-tail flexion. The head stays anchored while the
   // rear half undulates; this is not a rigid curled sprite translating forward.
   const steps=12,phase=clock*.0046;
   for(let i=0;i<steps;i++){
    const q=i/steps,tail=Math.pow(1-q,1.6),sourceW=420/steps;
    const offset=Math.sin(phase-q*5.9)*tail*r*.19;
    c.drawImage(sheet,sx+i*sourceW,sy,sourceW+.18,320,
      -w/2+q*w,-h/2+offset,w/steps+.3,h);
   }
  };
  const paint=(sheet,phase,weight,loop)=>{
   if(weight<=.003)return;
   const first=Math.floor(phase);
   const second=loop?(first+1)%15:Math.min(15,first+1);
   const f=phase-first;
   draw(sheet,first,weight*(1-f));
   if(f>.003)draw(sheet,second,weight*f);
  };
  art.lastUsed=clock;
  if(clock-lastSweep>10000){
   lastSweep=clock;
   for(const [name,value] of loaded)if(clock-value.lastUsed>45000)loaded.delete(name);
  }
  c.save();c.imageSmoothingEnabled=true;
  if('imageSmoothingQuality' in c)c.imageSmoothingQuality='high';
  if(Number(hit)>0){c.shadowColor='#ffffff';c.shadowBlur=Math.min(14,r*.3);}
  paint(art.swim,swimPhase,1-attackWeight,true);
  paint(art.attack,attackPhase,attackWeight,false);
  c.restore();return true;
 }
 function status(){return {...(previous.status?.()||{}),horrorEnabled:active,horrorAvailable:[...available],horrorReady:[...loaded.keys()],horrorFailed:[...failed]};}
 root.AbyssalAnimatedSprites=Object.freeze({...previous,has,isBiting,drawAtOrigin,preloadHorror,status});
 preloadHorror();
})(typeof globalThis!=='undefined'?globalThis:this);
