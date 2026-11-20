/* Abyssal 2.5D marine sprite renderer.
 * A high-resolution five-species atlas is preferred when installed.
 * The bundled legacy atlas stays as a safe offline fallback for shark and octopus Ecos.
 * Rendering never changes physics, attack damage, pathfinding or collision.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalAnimatedSprites=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const SPECIES=Object.freeze({
  reefshark:{moveRow:0,attackRow:1,count:9,cell:64,span:3.1,art:0},
  hammerhead:{moveRow:2,attackRow:3,count:9,cell:64,span:2.7,art:4},
  tigershark:{moveRow:4,attackRow:5,count:9,cell:64,span:3.2,art:1},
  abysscroc:{moveRow:0,attackRow:1,count:9,cell:64,span:3.3,art:2,palette:'red'},
  greenland:{moveRow:0,attackRow:1,count:9,cell:64,span:3.2,art:3,palette:'green'},
  aberration:{moveRow:6,attackRow:6,count:4,cell:128,span:10.5,octopus:true},
  whiteShark:{moveRow:0,attackRow:1,count:9,cell:64,span:3.1,art:0},
  whiteSharkBoss:{moveRow:0,attackRow:1,count:9,cell:64,span:3.1,art:0,palette:'boss'},
  boss:{moveRow:6,attackRow:6,count:4,cell:128,span:10.5,octopus:true}
 });
 const sourceName='abyssal-eco-sprites.png?v=2026.11.20.1';
 const hdSourceName='abyssal-sharks-2.5d.webp?v=2026.11.20.2';
 const whiteSharkSwimName='abyssal-white-shark-swim.webp?v=2026.11.20.5';
 const whiteSharkAttackName='abyssal-white-shark-attack.webp?v=2026.11.20.5';
 let whiteSharkSwim=null,whiteSharkAttack=null,whiteSharkReady=false;
 // White-shark swim/attack atlases are not anatomically registered. Align the
 // nose and upper head at load time rather than allowing the whole fish to jump.
 const WHITE_SHARK_CELL=168,WHITE_SHARK_CYCLE=22,WHITE_SHARK_FRAME_MS=95;
 const DEFAULT_ANCHOR=Object.freeze({dx:0,dy:0,scale:1});
 let whiteSharkBuffer=null,whiteSharkBufferCtx=null,whiteSharkAnchors=null;
 function inspectWhiteShark(image){
  if(typeof root.document?.createElement!=='function')return null;
  const canvas=root.document.createElement('canvas');
  canvas.width=WHITE_SHARK_CELL;canvas.height=WHITE_SHARK_CELL;
  const c=canvas.getContext('2d',{willReadFrequently:true});
  if(!c||typeof c.getImageData!=='function')return null;
  const result=[];
  try{
   for(let frame=0;frame<12;frame++){
    c.clearRect(0,0,168,168);
    c.drawImage(image,(frame%4)*168,Math.floor(frame/4)*168,168,168,0,0,168,168);
    const pixels=c.getImageData(0,0,168,168).data;
    let left=168,right=-1,top=168,bottom=-1;
    for(let y=0;y<168;y+=2)for(let x=0;x<168;x+=2){
     if(pixels[(y*168+x)*4+3]<96)continue;
     if(x<left)left=x;if(x>right)right=x;if(y<top)top=y;if(y>bottom)bottom=y;
    }
    if(right<=left||bottom<=top){result.push(null);continue;}
    let headSum=0,headWeight=0;
    for(let y=top;y<Math.min(100,bottom+1);y+=2)
     for(let x=Math.round(left+(right-left)*.65);x<=right;x+=2){
      const a=pixels[(y*168+x)*4+3];if(a<96)continue;
      headSum+=y*a;headWeight+=a;
     }
    result.push({right,headY:headWeight?headSum/headWeight:top+(bottom-top)*.34,width:right-left});
   }
  }catch(_){return null;}
  return result;
 }
 function prepareWhiteShark(){
  whiteSharkAnchors=null;whiteSharkBuffer=null;whiteSharkBufferCtx=null;
  if(!whiteSharkReady||typeof root.document?.createElement!=='function')return;
  try{
   const swim=inspectWhiteShark(whiteSharkSwim),attack=inspectWhiteShark(whiteSharkAttack),reference=swim?.[0];
   if(reference&&swim&&attack){
    const align=(set,swimming)=>set.map(item=>{
     if(!item)return DEFAULT_ANCHOR;
     const scale=swimming?clamp(reference.width/Math.max(1,item.width),.94,1.06):1;
     return {dx:clamp(reference.right-item.right*scale,-12,12),
      dy:clamp(reference.headY-item.headY*scale,-10,10),scale};
    });
    whiteSharkAnchors={swim:align(swim,true),attack:align(attack,false)};
   }
   const canvas=root.document.createElement('canvas');canvas.width=168;canvas.height=168;
   const c=canvas.getContext('2d',{alpha:true});
   if(c&&typeof c.clearRect==='function'&&typeof c.drawImage==='function'){
    whiteSharkBuffer=canvas;whiteSharkBufferCtx=c;
   }
  }catch(_){whiteSharkAnchors=null;whiteSharkBuffer=null;whiteSharkBufferCtx=null;}
 }
 // Reversing the swim cycle makes the last pose connect exactly to the first.
 function whiteSharkSwimPosition(t){
  const p=(Math.max(0,Number(t)||0)/WHITE_SHARK_FRAME_MS)%WHITE_SHARK_CYCLE;
  return p<=11?p:WHITE_SHARK_CYCLE-p;
 }
 // Fade between swim and bite with a constant total alpha, including recovery.
 function whiteSharkFrameWeights(t,progress){
  const frames=[];
  function put(mode,p,weight){
   if(weight<=.00001)return;
   const i=Math.floor(p),fraction=p-i,j=Math.min(11,i+1);
   if(weight*(1-fraction)>.00001)frames.push({mode,index:i,opacity:weight*(1-fraction)});
   if(i!==j&&weight*fraction>.00001)frames.push({mode,index:j,opacity:weight*fraction});
  }
  const active=Number.isFinite(progress)&&progress>=0;
  const attackAmount=active?clamp(Math.min(progress/.14,(1-progress)/.18),0,1):0;
  put('swim',whiteSharkSwimPosition(t),1-attackAmount);
  if(attackAmount>0)put('attack',clamp(progress,0,1)*11,attackAmount);
  return frames;
 }

 const palettes=Object.create(null);
 let source=null,ready=false,hdSource=null,hdReady=false,hdCell=0;
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 function recolorShark(mode){
  if(!source||typeof root.document==='undefined')return null;
  const canvas=root.document.createElement('canvas');canvas.width=576;canvas.height=128;
  const c=canvas.getContext('2d',{willReadFrequently:true});if(!c)return null;
  c.drawImage(source,0,0,576,128,0,0,576,128);
  const pixels=c.getImageData(0,0,576,128),p=pixels.data;
  for(let i=0;i<p.length;i+=4){
   if(p[i+3]===0)continue;
   const r=p[i],g=p[i+1],b=p[i+2],light=.2126*r+.7152*g+.0722*b;
   if(light>175&&Math.max(r,g,b)-Math.min(r,g,b)<68){
    if(mode==='red'){p[i]=Math.min(255,light*1.02+10);p[i+1]=light*.83;p[i+2]=light*.80;}
    else if(mode==='green'){p[i]=light*.75;p[i+1]=Math.min(255,light*1.04+8);p[i+2]=light*.84;}
    else {p[i]=light*.70;p[i+1]=light*.91;p[i+2]=Math.min(255,light*1.04+15);}
   }else if(mode==='red'){
    p[i]=Math.min(255,light*.95+49);p[i+1]=Math.min(255,light*.43+10);p[i+2]=Math.min(255,light*.44+15);
   }else if(mode==='green'){
    p[i]=Math.min(255,light*.37+12);p[i+1]=Math.min(255,light*.91+30);p[i+2]=Math.min(255,light*.50+17);
   }else{
    p[i]=Math.min(255,light*.49+6);p[i+1]=Math.min(255,light*.77+26);p[i+2]=Math.min(255,light*.92+34);
   }
  }
  c.putImageData(pixels,0,0);return canvas;
 }
 function preload(){
  if(!whiteSharkSwim&&typeof root.Image==='function'){
   let loaded=0;
   const onload=()=>{if(++loaded===2){whiteSharkReady=whiteSharkSwim.naturalWidth===672&&whiteSharkSwim.naturalHeight===504&&whiteSharkAttack.naturalWidth===672&&whiteSharkAttack.naturalHeight===504;if(whiteSharkReady)prepareWhiteShark();}};
   whiteSharkSwim=new root.Image();whiteSharkAttack=new root.Image();
   for(const [img,url] of [[whiteSharkSwim,whiteSharkSwimName],[whiteSharkAttack,whiteSharkAttackName]]){
    img.decoding='async';img.onload=onload;img.onerror=()=>{whiteSharkReady=false;};img.src=url;
   }
  }
  if(!source&&typeof root.Image==='function'){
   const image=new root.Image();source=image;image.decoding='async';
   image.onload=()=>{ready=image.naturalWidth===576&&image.naturalHeight===512;
    if(ready)for(const mode of ['red','green','boss'])palettes[mode]=recolorShark(mode);
   };
   image.onerror=()=>{ready=false;};image.src=sourceName;
  }
  if(!hdSource&&typeof root.Image==='function'){
   const image=new root.Image();hdSource=image;image.decoding='async';
   image.onload=()=>{
    // Atlas consists of five 3x3 sheets stacked vertically.
    const size=image.naturalWidth;
    hdReady=size>=288&&size%3===0&&image.naturalHeight===size*5;
    if(hdReady)hdCell=size/3;
   };
   image.onerror=()=>{hdReady=false;};image.src=hdSourceName;
  }
 }
 function has(id){return Boolean(SPECIES[String(id||'')]);}
 // A bite is a short, event-triggered pose, never an AI alert/chase animation.
 function isBiting(state,clock){
  if(!state)return false;
  if(state.whiteSharkBiteWindup&&clock>=state.whiteSharkBiteWindup.startedAt)return true;
  if(state.whiteSharkBiteCancel&&clock<state.whiteSharkBiteCancel.startedAt+state.whiteSharkBiteCancel.duration)return true;
  for(const event of [state.hostileBite,state.biteAnimation]){
   if(!event)continue;
   const start=Number(event.startedAt),duration=Math.max(1,Number(event.duration)||380);
   if(Number.isFinite(start)&&clock>=start&&clock<start+duration)return true;
  }
  const start=Number(state.visualBiteStartedAt),until=Number(state.visualBiteUntil);
  return Number.isFinite(until)&&until>clock&&(!Number.isFinite(start)||clock>=start);
 }
 // The entity's swim-phase offset is separate from the real attack clock.
 function biteProgress(state,t,attack,clock=t){
  if(!attack)return -1;
  const warming=state?.whiteSharkBiteWindup;
  if(warming&&clock>=warming.startedAt)return clamp((clock-warming.startedAt)/Math.max(1,warming.duration),0,1)*.44;
  const cancelled=state?.whiteSharkBiteCancel;
  if(cancelled&&clock<cancelled.startedAt+cancelled.duration)return clamp((Number(cancelled.progress)||0)*(1-(clock-cancelled.startedAt)/Math.max(1,cancelled.duration)),0,.44);
  if(cancelled)return -1; // A cancelled bite returns to the closed-mouth swim instead of looping open.
  const started=Number(state?.hostileBite?.startedAt??state?.biteAnimation?.startedAt??state?.visualBiteStartedAt);
  const duration=Math.max(1,Number(state?.hostileBite?.duration??state?.biteAnimation?.duration)||380);
  if(Number.isFinite(started)&&started>=0){
   const elapsed=clock-started;
   const phaseStart=Number(state?.hostileBite?.phaseStart)||0;
   return elapsed>=0&&elapsed<duration?clamp(phaseStart+(1-phaseStart)*elapsed/duration,0,.999999):-1;
  }
  const until=Number(state?.visualBiteUntil);
  if(Number.isFinite(until)&&until>0)return clock<until?clamp(1-(until-clock)/380,0,.999999):-1;
  return clamp((t%380)/380,0,.999999);
 }
 function selectFrame(id,t,attack,state,hd=false,clock=t){
  const cfg=SPECIES[id];
  const p=biteProgress(state,t,attack,clock);
  if(cfg?.octopus)return p>=0?Math.min(3,Math.floor(p*4)):Math.floor(Math.max(0,t)/175)%4;
  if(hd){
   if(p>=0)return [3,4,5,6,7,8][Math.min(5,Math.floor(p*6))];
   return [0,1,2,1,0][Math.floor(Math.max(0,t)/165)%5];
  }
  return Math.floor(Math.max(0,t)/(p>=0?54:110))%9;
 }
 function drawAtOrigin(c,id,r,t,attack,hit=0,state=null){
  const cfg=SPECIES[String(id||'')];
  if(!cfg||!c||!(Number(r)>0))return false;
  const useWhiteShark=String(id)==='whiteShark'&&whiteSharkReady;
  const useHd=!useWhiteShark&&hdReady&&cfg.art!==undefined;
  if(!ready&&!useHd&&!useWhiteShark)return false;
  const time=Number(t)||0,phase=time*(cfg.octopus?.0037:.0059);
  const eventClock=typeof root.performance?.now==='function'?root.performance.now():time;
  const progress=biteProgress(state,time,attack,eventClock);
  const frame=useWhiteShark?0:selectFrame(String(id),time,attack,state,useHd,eventClock);
  const side=cfg.span*r;
  if(useWhiteShark){
   const frames=whiteSharkFrameWeights(time,progress);
   c.save();c.imageSmoothingEnabled=true;
   if('imageSmoothingQuality' in c)c.imageSmoothingQuality='high';
   if(Number(hit)>0){c.shadowColor='#ffffff';c.shadowBlur=Math.min(14,r*.35);}
   if(whiteSharkBufferCtx&&whiteSharkBuffer){
    const mix=whiteSharkBufferCtx;
    mix.save();mix.clearRect(0,0,168,168);
    // Premultiplied additive blending on a CLEAR alpha surface. Never run
    // 'lighter' on the ocean/world canvas or it would brighten the backdrop.
    mix.globalCompositeOperation='lighter';
    for(const pose of frames){
     const image=pose.mode==='attack'?whiteSharkAttack:whiteSharkSwim;
     const anchor=whiteSharkAnchors?.[pose.mode]?.[pose.index]||DEFAULT_ANCHOR;
     mix.globalAlpha=pose.opacity;
     mix.drawImage(image,(pose.index%4)*168,Math.floor(pose.index/4)*168,168,168,
      anchor.dx,anchor.dy,168*anchor.scale,168*anchor.scale);
    }
    mix.restore();
    c.drawImage(whiteSharkBuffer,-side/2,-side/2,side,side);
   }else{
    // Canvas-restricted contexts display a single opaque frame, not two
    // semitransparent copies that produce blinking at midpoint.
    let chosen=frames[0];for(const f of frames)if(!chosen||f.opacity>chosen.opacity)chosen=f;
    if(chosen){
     const image=chosen.mode==='attack'?whiteSharkAttack:whiteSharkSwim;
     const anchor=whiteSharkAnchors?.[chosen.mode]?.[chosen.index]||DEFAULT_ANCHOR;
     c.drawImage(image,(chosen.index%4)*168,Math.floor(chosen.index/4)*168,168,168,
      -side/2+anchor.dx/168*side,-side/2+anchor.dy/168*side,side*anchor.scale,side*anchor.scale);
    }
   }
   c.restore();return true;
  }
  const sheet=useHd?hdSource:(cfg.palette?palettes[cfg.palette]:source);
  if(!sheet)return false;
  let srcX,srcY,cell;
  if(useHd){cell=hdCell;srcX=(frame%3)*cell;srcY=(cfg.art*3+Math.floor(frame/3))*cell;}
  else{cell=cfg.cell;srcX=frame*cell;srcY=(cfg.palette?(biteProgress(state,time,attack,eventClock)>=0?64:0):cfg.octopus?384:(biteProgress(state,time,attack,eventClock)>=0?cfg.attackRow:cfg.moveRow)*64);}
  c.save();c.imageSmoothingEnabled=true;
  if('imageSmoothingQuality' in c)c.imageSmoothingQuality='high';
  if(Number(hit)>0){c.shadowColor='#ffffff';c.shadowBlur=Math.min(14,r*.35);}
  // 2.5D: small parallax tilt, compression and articulated tail/arms.
  const lean=Math.sin(phase)*.017,breath=Math.sin(phase*.72)*.012;
  c.transform(1+breath,lean*.34,-lean*.35,1-breath*.48,0,0);
  const x=-side*.5,y=-side*.5;
  const image=()=>c.drawImage(sheet,srcX,srcY,cell,cell,x,y,side,side);
  if(cfg.octopus){
   // Mantle and independently swinging tentacles.
   c.save();c.beginPath();c.rect(x,y,side,side*.55);c.clip();image();c.restore();
   c.save();c.beginPath();c.rect(x,y+side*.55,side,side*.45);c.clip();
   c.translate(0,side*.06);c.rotate(Math.sin(phase*1.18)*.042);
   c.translate(0,-side*.06);image();c.restore();
  }else{
   // Tail pivots slightly behind the torso; the creature keeps facing +X.
   const pivot=-side*.235;
   c.save();c.beginPath();c.rect(pivot-side*.015,y,side*.76,side);c.clip();image();c.restore();
   c.save();c.beginPath();c.rect(x,y,side*.28,side);c.clip();
   c.translate(pivot,0);c.rotate(Math.sin(phase*1.34)*.047);c.translate(-pivot,0);
   image();c.restore();
  }
  c.restore();return true;
 }
 function status(){return {ready:ready||hdReady||whiteSharkReady,legacyReady:ready,hdReady,whiteSharkReady,atlas:hdReady?hdSourceName:sourceName,species:Object.keys(SPECIES),octopusBlue:true,whiteSharkSmoothBlend:Boolean(whiteSharkBufferCtx),whiteSharkAligned:Boolean(whiteSharkAnchors)};}
 preload();
 return Object.freeze({SPECIES,has,drawAtOrigin,preload,status,selectFrame,biteProgress,isBiting,whiteSharkSwimPosition,whiteSharkFrameWeights});
});