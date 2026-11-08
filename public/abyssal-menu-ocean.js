(function(){
 'use strict';
 // Virtual ocean: stations exist in world coordinates. The camera follows ONE
 // diver; a portal requires physical travel and cannot be opened remotely.
 const LOCATIONS={
  rankingsBtn:{x:.13,y:.22,tone:'ice',label:'RANKING'},
  playBtn:{x:.40,y:.18,tone:'cyan',label:'MERGULHO SOLO'},
  onlineBtn:{x:.69,y:.19,tone:'teal',label:'MERGULHO ONLINE'},
  wheelBtn:{x:.88,y:.23,tone:'rose',label:'ROLETA'},
  resonanceBtn:{x:.14,y:.63,tone:'blue',label:'RESSONÂNCIA'},
  riftPortalBtn:{x:.88,y:.69,tone:'rift',label:'FOSSAS'},
  profileBtn:{x:.39,y:.88,tone:'violet',label:'PERFIL'},
  shopBtn:{x:.68,y:.87,tone:'gold',label:'ESPÉCIMES'}
 };
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const lerp=(a,b,t)=>a+(b-a)*t;
 const canMove=()=>!document.hidden;
 function boot(){
  const menu=document.getElementById('menuScreen'),stage=document.getElementById('menuOceanStage');
  if(!menu||!stage||menu.dataset.oceanV3Ready)return;
  menu.dataset.oceanV3Ready='true';
  const layer=document.getElementById('menuOceanPortalLayer'),diver=document.getElementById('menuOceanDiver');
  const canvas=document.getElementById('menuOceanDiverCanvas'),ctx=canvas?.getContext('2d');
  const hint=document.getElementById('menuOceanHint'),enter=document.getElementById('menuOceanEnterBtn');
  const specimenCanvas=document.getElementById('menuOceanSpecimen');
  // Companion previews are shown in profile, not a second character over the menu.
  if(specimenCanvas){specimenCanvas.hidden=true;specimenCanvas.style.display='none';}
  if(!layer||!diver||!ctx)return;
  let worldW=0,worldH=0,px=0,py=0,camX=0,camY=0,vx=0,vy=0,heading=0;
  let destination=null,nearest=null,activeDestination=null,wasNear=null,last=performance.now(),initialized=false;
  let controlsActive=false;
  const held=new Set(),stations=[];
  const keys={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
  const muted=(node)=>node?.hidden||!node?.isConnected;
  const isInteractive=()=>{
   if(muted(menu)||!canMove())return false;
   for(const panel of document.querySelectorAll('.modal-screen,.modal-overlay,#roomsScreen,#loginScreen,#shopScreen')){
    if(panel===menu||panel.hidden||!panel.isConnected)continue;
    if(panel.getClientRects().length&&getComputedStyle(panel).visibility!=='hidden'&&getComputedStyle(panel).display!=='none')return false;
   }
   return true;
  };
  for(const [id,station] of Object.entries(LOCATIONS)){
   const button=document.getElementById(id);if(!button)continue;
   button.dataset.portalTone=station.tone;
   button.classList.add('abyss-rift-gate');
   const rim=document.createElement('span');rim.className='abyss-rift-fractures';rim.setAttribute('aria-hidden','true');
   button.prepend(rim);
   const entry={id,button,...station,wx:0,wy:0};
   stations.push(entry);
   // Capture before old delegated handlers. Click instructs navigation, not teleportation.
   button.addEventListener('click',event=>{
    if(entry.button.dataset.portalArriving==='1')return;
    if(!isInteractive())return;
    event.preventDefault();event.stopImmediatePropagation();
    destination={x:entry.wx,y:entry.wy};activeDestination=entry;
    hint.textContent='NADANDO ATÉ '+entry.label+' · F PARA ENTRAR AO CHEGAR';
   },true);
  }
  function resizeWorld(){
   const r=stage.getBoundingClientRect(),oldW=worldW,oldH=worldH;
   worldW=Math.max(1150,Math.round(r.width*2.15));
   worldH=Math.max(920,Math.round(r.height*2.10));
   if(!initialized){px=worldW*.52;py=worldH*.51;initialized=true;}
   else{px=px/Math.max(1,oldW)*worldW;py=py/Math.max(1,oldH)*worldH;}
   layer.style.setProperty('width',worldW+'px','important');layer.style.setProperty('height',worldH+'px','important');
   for(const s of stations){s.wx=s.x*worldW;s.wy=s.y*worldH;s.button.style.setProperty('--portal-x',s.wx+'px');s.button.style.setProperty('--portal-y',s.wy+'px');}
   destination=null;activeDestination=null;px=clamp(px,48,worldW-48);py=clamp(py,48,worldH-48);
   camX=clamp(px-r.width*.5,0,Math.max(0,worldW-r.width));
   camY=clamp(py-r.height*.5,0,Math.max(0,worldH-r.height));
  }
  resizeWorld();window.addEventListener('resize',resizeWorld);
  function enterPortal(s){
   if(!s||!isInteractive()||s.button.disabled||s.button.hidden)return;
   const distance=Math.hypot(s.wx-px,s.wy-py);
   if(distance>Math.max(50,Math.min(s.button.offsetWidth*.32,67)))return;
   // Native downstream event handlers run only once the physical portal was reached.
   s.button.dataset.portalArriving='1';
   try{s.button.click();}finally{delete s.button.dataset.portalArriving;}
   destination=null;activeDestination=null;
  }
  function pickNear(){
   let best=null,bestDistance=Infinity;
   for(const s of stations){
    const distance=Math.hypot(px-s.wx,py-s.wy);
    s.button.classList.remove('portal-near');
    if(distance<bestDistance){best=s;bestDistance=distance;}
   }
   const radius=best?Math.max(50,Math.min(best.button.offsetWidth*.36,70)):50;
   nearest=bestDistance<radius?best:null;
   if(nearest){nearest.button.classList.add('portal-near');hint.textContent='PORTAL '+nearest.label+' · F / ENTER PARA ENTRAR';}
   else if(activeDestination){hint.textContent='RUMO A '+activeDestination.label+' · '+Math.ceil(Math.hypot(px-activeDestination.wx,py-activeDestination.wy))+'m';}
   else if(best){hint.textContent='NADO LIVRE · PORTAL '+best.label+' A '+Math.ceil(bestDistance)+'m · WASD / SETAS';}
   else hint.textContent='WASD / SETAS PARA NADAR · F PARA ENTRAR';
   if(enter){enter.disabled=!nearest;enter.textContent=nearest?'ENTRAR · '+nearest.label:'APROXIME-SE DE UM PORTAL';}
   // The outer glow marks proximity, but entry happens at the inner rift.
   // Keep checking until the swimmer actually crosses the entry radius.
   if(nearest&&activeDestination===nearest&&bestDistance<=Math.max(50,Math.min(nearest.button.offsetWidth*.32,67)))enterPortal(nearest);
   wasNear=nearest;
  }
  const key=(event)=>String(event?.key||'').toLowerCase();
  window.addEventListener('keydown',event=>{
   if(!isInteractive()||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName||''))return;
   const k=key(event);
   if(keys[k]){held.add(keys[k]);destination=null;activeDestination=null;event.preventDefault();}
   else if((k==='f'||k==='enter')&&!event.repeat){event.preventDefault();enterPortal(nearest);}
  });
  window.addEventListener('keyup',event=>{const k=keys[key(event)];if(k)held.delete(k);});
  window.addEventListener('blur',()=>{held.clear();destination=null;});
  stage.addEventListener('pointerdown',event=>{
   if(!isInteractive()||event.target.closest('button,a,input,select'))return;
   const r=stage.getBoundingClientRect();
   destination={x:clamp(event.clientX-r.left+camX,20,worldW-20),y:clamp(event.clientY-r.top+camY,20,worldH-20)};
   activeDestination=null;
  });
  for(const button of document.querySelectorAll('#menuOceanMobilePad [data-ocean-move]')){
   const direction=button.dataset.oceanMove;
   button.addEventListener('pointerdown',e=>{e.preventDefault();held.add(direction);destination=null;activeDestination=null;try{button.setPointerCapture(e.pointerId)}catch{}});
   const stop=()=>held.delete(direction);
   button.addEventListener('pointerup',stop);button.addEventListener('pointercancel',stop);button.addEventListener('lostpointercapture',stop);
  }
  enter?.addEventListener('click',()=>enterPortal(nearest));
  function animate(now){
   const dt=Math.min(.055,Math.max(0,(now-last)/1000));last=now;
   const enabled=isInteractive();
   if(enabled){
    let mx=(held.has('right')?1:0)-(held.has('left')?1:0);
    let my=(held.has('down')?1:0)-(held.has('up')?1:0);
    if(mx||my){destination=null;activeDestination=null;}
    else if(destination){
     const dx=destination.x-px,dy=destination.y-py,d=Math.hypot(dx,dy);
     if(d>8){mx=dx/d;my=dy/d;}else{destination=null;mx=0;my=0;}
    }
    const unit=Math.hypot(mx,my)||1;
    const speed=Math.max(190,Math.min(255,worldW*.12));
    const response=1-Math.exp(-dt*9);
    vx=lerp(vx,mx/unit*speed,response);vy=lerp(vy,my/unit*speed,response);
    px=clamp(px+vx*dt,35,worldW-35);py=clamp(py+vy*dt,35,worldH-35);
    if(Math.hypot(vx,vy)>5){const a=Math.atan2(vy,vx),diff=Math.atan2(Math.sin(a-heading),Math.cos(a-heading));heading+=diff*(1-Math.exp(-dt*8));}
    camX=lerp(camX,clamp(px-stage.clientWidth*.5,0,Math.max(0,worldW-stage.clientWidth)),1-Math.exp(-dt*7));
    camY=lerp(camY,clamp(py-stage.clientHeight*.5,0,Math.max(0,worldH-stage.clientHeight)),1-Math.exp(-dt*7));
    layer.style.setProperty('transform','translate3d('+(-camX).toFixed(2)+'px,'+(-camY).toFixed(2)+'px,0)','important');
    diver.style.setProperty('--diver-x',(px-camX)+'px');diver.style.setProperty('--diver-y',(py-camY)+'px');
    diver.classList.toggle('swimming',Math.hypot(vx,vy)>6);
    pickNear();
   }else{vx=0;vy=0;held.clear();}
   ctx.clearRect(0,0,canvas.width,canvas.height);
   window.AbyssalDiverArt?.draw?.(ctx,90,65,13,heading,heading,now,{gender:window.AbyssalDiverGender||'male',moving:enabled&&Math.hypot(vx,vy)>7});
   requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();