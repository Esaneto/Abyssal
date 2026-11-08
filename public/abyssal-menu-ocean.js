/* Abyssal submarine-departure menu.
   Three destinations: ONLINE / MERGULHAR / FOSSAS.
   Existing play, online and Fossas handlers remain the source of truth.
   This script only supplies animation/navigation and does not start game modes.
*/
(function(){
 'use strict';
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const mix=(a,b,t)=>a+(b-a)*t;
 const easeIn=t=>t*t*t;
 const easeOut=t=>1-Math.pow(1-t,3);
 const TARGETS=[
  {id:'onlineBtn',x:.18,y:.65,color:'#65e1dc',label:'MERGULHAR ONLINE',kind:'current'},
  {id:'playBtn',x:.50,y:.65,color:'#84d9ff',label:'MERGULHAR',kind:'current'},
  {id:'riftPortalBtn',x:.82,y:.85,color:'#a83246',label:'FOSSAS ABISSAIS',kind:'fissure'}
 ];
 function boot(){
  const menu=document.getElementById('menuScreen');
  const stage=document.getElementById('menuOceanStage');
  const layer=document.getElementById('menuOceanPortalLayer');
  const diver=document.getElementById('menuOceanDiver');
  const diverCanvas=document.getElementById('menuOceanDiverCanvas');
  const sceneryCanvas=document.getElementById('menuOceanScenery');
  const submarineCanvas=document.getElementById('menuOceanSubmarine');
  const mobilePad=document.getElementById('menuOceanMobilePad');
  const enterButton=document.getElementById('menuOceanEnterBtn');
  if(!menu||!stage||!layer||!diver||!diverCanvas||!sceneryCanvas)return;
  if(menu.dataset.submarineMenuReady==='1')return;
  menu.dataset.submarineMenuReady='1';
  menu.classList.add('submarine-menu');
  const ctx=diverCanvas.getContext('2d');
  if(!ctx)return;
  const seabedCanvas=document.createElement('canvas');
  seabedCanvas.className='abyss-ocean-seabed';
  seabedCanvas.setAttribute('aria-hidden','true');
  layer.insertBefore(seabedCanvas,layer.querySelector('button')||null);
  const currentsCanvas=document.createElement('canvas');
  currentsCanvas.className='abyss-ocean-routes';
  currentsCanvas.setAttribute('aria-hidden','true');
  stage.insertBefore(currentsCanvas,diver);
  const currentsCtx=currentsCanvas.getContext('2d');
  const bubblesCanvas=document.createElement('canvas');
  bubblesCanvas.className='abyss-ocean-bubbles';
  bubblesCanvas.setAttribute('aria-hidden','true');
  stage.insertBefore(bubblesCanvas,diver);
  const bubblesCtx=bubblesCanvas.getContext('2d');
  const specimenCanvas=document.getElementById('menuOceanSpecimen');
  if(specimenCanvas){specimenCanvas.hidden=true;specimenCanvas.style.display='none';}
  if(enterButton)enterButton.hidden=true;
  const targets=TARGETS.map(t=>({...t,button:document.getElementById(t.id),px:0,py:0})).filter(t=>t.button);
  if(targets.length!==3)return;
  const held=new Set(),bubbles=[];
  const keyNames={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
  let w=0,h=0,originX=0,originY=0,px=0,py=0,heading=Math.PI/2,vx=0,vy=0;
  let mode='eject',motionClock=0,ejectClock=0,last=performance.now(),lastBubbleAt=0;
  let targetPoint=null,activeEntry=null,arrivalFrom=null,entryElapsed=0;
  let visibilityBefore=false,initialized=false,stickId=null,stickX=0,stickY=0;
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  const appPlaying=()=>document.body.classList.contains('game-active');
  const isShown=()=>!menu.hidden&&menu.isConnected&&!appPlaying()&&stage.getClientRects().length>0;
  function overlaysOpen(){
   const selectors='.modal-screen,.modal-overlay,#abyssDescentPanel,.abyss-cinematic-dialog';
   for(const panel of document.querySelectorAll(selectors)){
    if(panel===menu||panel.hidden||!panel.isConnected)continue;
    if(panel.getClientRects().length&&getComputedStyle(panel).display!=='none'&&getComputedStyle(panel).visibility!=='hidden')return true;
   }
   return false;
  }
  function interactive(){return isShown()&&!document.hidden&&!overlaysOpen()&&mode!=='entering'&&mode!=='modal';}
  function prepareCanvas(canvas,c,width,height){
   if(!canvas||!c||width<=0||height<=0)return;
   const dpr=Math.min(1.5,Math.max(1,window.devicePixelRatio||1));
   canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
   canvas.style.width=width+'px';canvas.style.height=height+'px';
   c.setTransform(dpr,0,0,dpr,0,0);
  }
  function hatchY(){return Math.min(72,Math.max(52,h*.14));}
  function bubble(x,y,violent=false){
   if(bubbles.length>135)bubbles.splice(0,bubbles.length-135);
   const a=Math.random()*Math.PI*2,speed=(violent?64:16)*(.35+Math.random());
   const max=(violent?.48:.30)+Math.random()*(violent?1:.48);
   bubbles.push({x,y,vx:Math.cos(a)*speed+vx*.09,vy:Math.sin(a)*speed*.48-(violent?55:18),r:(violent?1.2:0.7)+Math.random()*(violent?2.7:1.1),life:max,max});
  }
  function burst(x,y,count=36){
   for(let i=0;i<count;i++)bubble(x+(Math.random()-.5)*34,y+(Math.random()-.5)*22,true);
  }
  function resetAtHatch(animate=true){
   if(!w||!h)return;
   originX=w*.5;originY=Math.min(h*.31,145);
   px=originX;py=animate?hatchY():originY;
   vx=0;vy=0;heading=Math.PI/2;
   mode=animate?'eject':'idle';ejectClock=0;
   motionClock=0;entryElapsed=0;activeEntry=null;arrivalFrom=null;targetPoint=null;
   stickId=null;stickX=0;stickY=0;
   const thumb=mobilePad?.querySelector('.ocean-joystick-thumb');
   if(thumb)thumb.style.transform='translate(0,0)';
   diver.style.setProperty('--abyss-exit-scale','1');
   diver.style.opacity='1';
   menu.dataset.activeEntry='';
   bubbles.length=0;
   burst(originX,hatchY(),animate?64:21);
  }
  function layout(){
   const rect=stage.getBoundingClientRect();
   if(rect.width<130||rect.height<120)return;
   const oldW=w,oldH=h,oldX=px,oldY=py;
   w=rect.width;h=rect.height;
   originX=w*.5;originY=Math.min(h*.31,145);
   if(!initialized){initialized=true;px=originX;py=hatchY();}
   else if(mode!=='entering'){px=clamp(oldX/Math.max(1,oldW)*w,28,w-28);py=clamp(oldY/Math.max(1,oldH)*h,25,h-27);}
   layer.style.setProperty('width',w+'px','important');
   layer.style.setProperty('height',h+'px','important');
   layer.style.setProperty('transform','none','important');
   for(const dest of targets){
    dest.px=w*dest.x;dest.py=h*dest.y;
    dest.button.dataset.portalTone=dest.kind==='fissure'?'blood':dest.id==='onlineBtn'?'teal':'cyan';
    dest.button.classList.add(dest.kind==='fissure'?'abyss-fissure-entry':'abyss-current-entry');
    dest.button.classList.remove('abyss-rift-gate');
    dest.button.style.setProperty('--portal-x',dest.px+'px');
    dest.button.style.setProperty('--portal-y',dest.py+'px');
   }
   window.AbyssalMenuScenery?.draw?.(sceneryCanvas,w,h);
   window.AbyssalMenuScene?.drawSeabed?.(seabedCanvas,w,h);
   window.AbyssalMenuScene?.drawSubmarine?.(submarineCanvas,w,h);
   prepareCanvas(currentsCanvas,currentsCtx,w,h);
   prepareCanvas(bubblesCanvas,bubblesCtx,w,h);
  }
  function createJoystick(){
   if(!mobilePad)return;
   mobilePad.replaceChildren();
   mobilePad.hidden=false;mobilePad.classList.add('ocean-joystick');
   const thumb=document.createElement('span');
   thumb.className='ocean-joystick-thumb';mobilePad.appendChild(thumb);
   const steer=e=>{
    const r=mobilePad.getBoundingClientRect(),cx=r.left+r.width*.5,cy=r.top+r.height*.5;
    const dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy)||1,extent=Math.min(42,r.width*.34);
    const magnitude=Math.min(1,d/extent);
    stickX=dx/d*magnitude;stickY=dy/d*magnitude;
    thumb.style.transform='translate('+Math.round(stickX*extent)+'px,'+Math.round(stickY*extent)+'px)';
    targetPoint=null;
   };
   mobilePad.addEventListener('pointerdown',e=>{
    if(stickId!==null||!interactive())return;
    e.preventDefault();e.stopPropagation();stickId=e.pointerId;
    try{mobilePad.setPointerCapture(e.pointerId);}catch(_){}
    steer(e);
   });
   mobilePad.addEventListener('pointermove',e=>{if(e.pointerId===stickId){e.preventDefault();steer(e);}});
   const release=e=>{
    if(e.pointerId!==stickId)return;
    stickId=null;stickX=0;stickY=0;thumb.style.transform='translate(0,0)';
   };
   for(const type of ['pointerup','pointercancel','lostpointercapture'])mobilePad.addEventListener(type,release);
   window.addEventListener('blur',()=>{stickId=null;stickX=0;stickY=0;held.clear();thumb.style.transform='translate(0,0)';});
  }
  function startEntry(dest){
   if(!interactive()||mode==='entering')return;
   mode='entering';activeEntry=dest;entryElapsed=0;
   arrivalFrom={x:px,y:py};
   targetPoint=null;stickX=0;stickY=0;
   menu.dataset.activeEntry=dest.id;
   burst(px,py,18);
  }
  for(const dest of targets){
   dest.button.addEventListener('click',event=>{
    // The existing destination handler runs only after the cinematic arrives.
    if(dest.button.dataset.abyssArrival==='1')return;
    event.preventDefault();event.stopImmediatePropagation();
    startEntry(dest);
   },true);
  }
  function executeEntry(){
   const dest=activeEntry;if(!dest)return;
   activeEntry=null;mode='modal';menu.dataset.activeEntry=dest.id;
   if(dest.id==='riftPortalBtn'){
    diver.style.setProperty('--abyss-exit-scale','.10');diver.style.opacity='0';
   }else{
    diver.style.setProperty('--abyss-exit-scale','.70');
    diver.style.opacity='.25';
   }
   dest.button.dataset.abyssArrival='1';
   try{dest.button.click();}finally{delete dest.button.dataset.abyssArrival;}
   if(dest.id==='playBtn')mode='game';
  }
  function cancelReturn(){
   // Cancelled room browser, login or Fossas choices: return under the hatch.
   if(appPlaying()||menu.hidden)return;
   requestAnimationFrame(()=>{if(isShown())resetAtHatch(false);});
  }
  window.addEventListener('abyssal-modal-closed',event=>{if(event.detail?.screenId==='roomsScreen')cancelReturn();});
  window.addEventListener('abyssal-menu-portal-cancelled',cancelReturn);
  document.getElementById('loginCancelBtn')?.addEventListener('click',cancelReturn);
  document.addEventListener('keydown',event=>{
   if(!interactive()||event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
   const key=String(event.key||'').toLowerCase();
   if(keyNames[key]){held.add(keyNames[key]);event.preventDefault();}
   if((key==='enter'||key==='f')&&!event.repeat){
    const nearby=targets.find(t=>Math.hypot(px-t.px,py-t.py)<Math.max(50,t.button.offsetWidth*.55));
    if(nearby){event.preventDefault();startEntry(nearby);}
   }
  });
  document.addEventListener('keyup',event=>{const k=keyNames[String(event.key||'').toLowerCase()];if(k)held.delete(k);});
  let pointerId=null;
  stage.addEventListener('pointerdown',event=>{
   if(!interactive()||event.button!==0||event.target.closest?.('button,a,input,select,#menuOceanMobilePad'))return;
   const r=stage.getBoundingClientRect();targetPoint={x:event.clientX-r.left,y:event.clientY-r.top};
   pointerId=event.pointerId;
   try{stage.setPointerCapture(event.pointerId);}catch(_){}
  });
  stage.addEventListener('pointermove',event=>{
   if(pointerId!==event.pointerId||!interactive())return;
   const r=stage.getBoundingClientRect();targetPoint={x:event.clientX-r.left,y:event.clientY-r.top};
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,event=>{
   if(event.pointerId===pointerId)pointerId=null;
  });
  function drawCurrents(now){
   if(!currentsCtx||!w||!h)return;
   currentsCtx.clearRect(0,0,w,h);
   const t=now*.001;
   for(const dest of targets){
    const x=dest.px,y=dest.py;
    currentsCtx.save();
    if(dest.kind==='fissure'){
     // A restrained red seam is part of the floor, not a floating third portal.
     const glow=currentsCtx.createRadialGradient(x,y,4,x,y,Math.min(110,w*.21));
     glow.addColorStop(0,'rgba(168,15,43,.23)');glow.addColorStop(1,'rgba(168,15,43,0)');
     currentsCtx.fillStyle=glow;currentsCtx.beginPath();currentsCtx.arc(x,y,Math.min(108,w*.2),0,Math.PI*2);currentsCtx.fill();
    }else{
     const color=dest.color,side=dest.id==='onlineBtn'?-1:1;
     // Two wide ribbons visibly drag water toward their respective destinations.
     for(let line=0;line<5;line++){
      const off=(line-2)*11,startX=x+side*(-78+off*.75),startY=y-125;
      currentsCtx.beginPath();currentsCtx.moveTo(startX,startY);
      currentsCtx.bezierCurveTo(startX-side*28,y-78,x-side*(50+off),y-28,x+off*.65,y+13);
      currentsCtx.strokeStyle=color;
      currentsCtx.globalAlpha=.07+(.05*Math.sin(t*1.4+line));
      currentsCtx.lineWidth=12+line%2*4;currentsCtx.stroke();
      currentsCtx.lineWidth=1.25;currentsCtx.globalAlpha=.32;
      currentsCtx.setLineDash([11,14]);currentsCtx.lineDashOffset=-now*.045;
      currentsCtx.stroke();currentsCtx.setLineDash([]);
     }
     for(let j=0;j<3;j++){
      const radius=36+j*13,phase=t*(.55+j*.18);
      currentsCtx.strokeStyle=color;currentsCtx.globalAlpha=.22/(j+1);
      currentsCtx.lineWidth=2.4;
      currentsCtx.beginPath();currentsCtx.ellipse(x,y,radius,radius*.61,-.20,phase,phase+Math.PI*1.35);currentsCtx.stroke();
     }
    }
    currentsCtx.restore();
   }
  }
  function drawBubbles(dt){
   if(!bubblesCtx||!w)return;
   bubblesCtx.clearRect(0,0,w,h);
   for(let i=bubbles.length-1;i>=0;i--){
    const p=bubbles[i];p.life-=dt;
    p.x+=p.vx*dt;p.y+=p.vy*dt;
    p.vx*=1-dt*.30;p.vy-=8*dt;
    if(p.life<=0){bubbles.splice(i,1);continue;}
    bubblesCtx.globalAlpha=Math.min(1,p.life/.25)*.75;
    bubblesCtx.strokeStyle='#b7ecf4';bubblesCtx.lineWidth=.85;
    bubblesCtx.beginPath();bubblesCtx.arc(p.x,p.y,p.r,0,Math.PI*2);bubblesCtx.stroke();
    bubblesCtx.globalAlpha=Math.min(1,p.life/.25)*.22;
    bubblesCtx.fillStyle='#d5f8ff';bubblesCtx.beginPath();bubblesCtx.arc(p.x-p.r*.3,p.y-p.r*.3,p.r*.32,0,Math.PI*2);bubblesCtx.fill();
   }
   bubblesCtx.globalAlpha=1;
  }
  function move(dt,now){
   if(mode==='eject'){
    ejectClock+=dt;
    const p=clamp(ejectClock/(reduceMotion?.52:1.08),0,1);
    py=mix(hatchY(),originY,easeOut(p));px=originX+Math.sin(p*5)*3;
    heading=Math.PI/2;
    if(p<.84&&now-lastBubbleAt>25){burst(px,py,3);lastBubbleAt=now;}
    if(p>=1){mode='idle';py=originY;}
   }else if(mode==='entering'&&activeEntry){
    const dest=activeEntry,duration=reduceMotion?.35:dest.kind==='fissure'?1.05:.88;
    entryElapsed+=dt;
    const t=clamp(entryElapsed/duration,0,1),e=easeIn(t);
    px=mix(arrivalFrom.x,dest.px,e);
    py=mix(arrivalFrom.y,dest.py+(dest.kind==='fissure'?31:0),e);
    const angle=Math.atan2(dest.py-arrivalFrom.y,dest.px-arrivalFrom.x);
    heading=mix(heading,angle,clamp(dt*8,0,1));
    const fade=dest.kind==='fissure'?1-e*.98:1-e*.42;
    diver.style.opacity=String(fade);
    diver.style.setProperty('--abyss-exit-scale',String(Math.max(.07,1-e*(dest.kind==='fissure'?.91:.33))));
    if(now-lastBubbleAt>38){for(let n=0;n<3;n++)bubble(px,py,true);lastBubbleAt=now;}
    if(t>=1)executeEntry();
   }else if(mode==='idle'){
    let dx=(held.has('right')?1:0)-(held.has('left')?1:0);
    let dy=(held.has('down')?1:0)-(held.has('up')?1:0);
    if(Math.hypot(stickX,stickY)>.06){dx=stickX;dy=stickY;targetPoint=null;}
    if(dx||dy)targetPoint=null;
    else if(targetPoint){
     const gapX=targetPoint.x-px,gapY=targetPoint.y-py,dist=Math.hypot(gapX,gapY);
     if(dist>8){dx=gapX/dist;dy=gapY/dist;}else targetPoint=null;
    }
    const unit=Math.hypot(dx,dy)||1,speed=Math.min(235,Math.max(125,w*.20));
    vx=mix(vx,dx/unit*speed,1-Math.exp(-dt*7));
    vy=mix(vy,dy/unit*speed,1-Math.exp(-dt*7));
    px=clamp(px+vx*dt,26,w-26);
    py=clamp(py+vy*dt,35,h-26);
    if(Math.hypot(vx,vy)>8){
     const a=Math.atan2(vy,vx),diff=Math.atan2(Math.sin(a-heading),Math.cos(a-heading));
     heading+=diff*(1-Math.exp(-dt*9));
     if(now-lastBubbleAt>82){bubble(px-Math.cos(heading)*12,py-Math.sin(heading)*12);lastBubbleAt=now;}
    }
   }
   diver.style.setProperty('--diver-x',px+'px');
   diver.style.setProperty('--diver-y',py+'px');
   diver.classList.toggle('swimming',mode==='eject'||mode==='entering'||Math.hypot(vx,vy)>8);
  }
  function frame(now){
   const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
   const visible=isShown();
   if(visible&&!visibilityBefore){
    layout();resetAtHatch(true);
   }
   visibilityBefore=visible;
   if(visible){
    if(Math.abs(stage.clientWidth-w)>2||Math.abs(stage.clientHeight-h)>2)layout();
    if((mode==='eject'||mode==='idle'||mode==='entering')&&!overlaysOpen())move(dt,now);
    if(!reduceMotion)drawCurrents(now);
    else if(motionClock++%8===0)drawCurrents(0);
    drawBubbles(dt);
    ctx.clearRect(0,0,diverCanvas.width,diverCanvas.height);
    window.AbyssalDiverArt?.draw?.(ctx,90,65,13,heading,heading,now,{
     gender:window.AbyssalDiverGender||'male',
     moving:mode==='eject'||mode==='entering'||Math.hypot(vx,vy)>8
    });
   }
   requestAnimationFrame(frame);
  }
  createJoystick();layout();resetAtHatch(true);
  window.AbyssalMenuSubmarine={reset:()=>resetAtHatch(false),status:()=>({mode,activeEntry:activeEntry?.id||menu.dataset.activeEntry||null})};
  requestAnimationFrame(frame);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
