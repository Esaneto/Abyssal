(function(){
 'use strict';
 // Virtual ocean: stations exist in world coordinates. The camera follows ONE
 // diver; a portal requires physical travel and cannot be opened remotely.
 const LOCATIONS={
  playBtn:{x:.22,y:.48,tone:'cyan',label:'MERGULHAR SOLO'},
  onlineBtn:{x:.78,y:.48,tone:'teal',label:'MERGULHAR ONLINE'},
  riftPortalBtn:{x:.52,y:.88,tone:'rift',label:'FOSSAS ABISSAIS'}
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
  const enter=document.getElementById('menuOceanEnterBtn');
  const specimenCanvas=document.getElementById('menuOceanSpecimen');
  const sceneryCanvas=document.getElementById('menuOceanScenery');
  const submarineCanvas=document.getElementById('menuOceanSubmarine'),subCtx=submarineCanvas?.getContext('2d');
  const routesCanvas=document.createElement('canvas');
  routesCanvas.className='abyss-ocean-routes';
  routesCanvas.setAttribute('aria-hidden','true');
  stage.insertBefore(routesCanvas,diver);
  const routesCtx=routesCanvas.getContext('2d');
  const bubblesCanvas=document.createElement('canvas');
  bubblesCanvas.className='abyss-ocean-bubbles';
  bubblesCanvas.setAttribute('aria-hidden','true');
  stage.insertBefore(bubblesCanvas,diver);
  const bubblesCtx=bubblesCanvas.getContext('2d');
  // Companion previews are shown in profile, not a second character over the menu.
  if(specimenCanvas){specimenCanvas.hidden=true;specimenCanvas.style.display='none';}
  if(!layer||!diver||!ctx)return;
  let worldW=0,worldH=0,stageW=0,stageH=0,px=0,py=0,camX=0,camY=0,vx=0,vy=0,heading=0;
  let followingPointer=null,bubbleElapsed=0,spawnBubbleTime=0,arrival=null,arrivalAt=0,returnOnClose=false,menuWasActive=false;
  const motionBubbles=[];
  let destination=null,nearest=null,activeDestination=null,wasNear=null,last=performance.now(),initialized=false;
  let controlsActive=false;
  const held=new Set(),stations=[];
  const keys={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
  const muted=(node)=>node?.hidden||!node?.isConnected;
  const isInteractive=()=>{
   if(muted(menu)||!canMove())return false;
   for(const panel of document.querySelectorAll('.modal-screen,.modal-overlay,#roomsScreen,#loginScreen,#shopScreen,#abyssDescentPanel')){
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
    // Navigation title is painted on the moving route itself.
   },true);
  }
  function resizeWorld(){
   const r=stage.getBoundingClientRect(),oldW=worldW,oldH=worldH;
   if(r.width<10||r.height<10)return; // Game screens may hide the menu during resize.
   stageW=r.width;stageH=r.height;
   worldW=Math.max(350,Math.round(r.width));
   worldH=Math.max(300,Math.round(r.height));
   if(!initialized){px=worldW*.5;py=worldH*.15;spawnBubbleTime=1.25;initialized=true;}
   else{px=px/Math.max(1,oldW)*worldW;py=py/Math.max(1,oldH)*worldH;}
   layer.style.setProperty('width',worldW+'px','important');layer.style.setProperty('height',worldH+'px','important');
   window.AbyssalMenuScenery?.draw?.(sceneryCanvas,worldW,worldH);
   drawSubmarine();
   for(const s of stations){s.wx=s.x*worldW;s.wy=s.y*worldH;s.button.style.setProperty('--portal-x',s.wx+'px');s.button.style.setProperty('--portal-y',s.wy+'px');}
   if(routesCtx){const ratio=Math.min(window.devicePixelRatio||1,1.5);routesCanvas.width=Math.round(r.width*ratio);routesCanvas.height=Math.round(r.height*ratio);routesCtx.setTransform(ratio,0,0,ratio,0,0);}
   if(bubblesCtx){const ratio=Math.min(window.devicePixelRatio||1,1.5);bubblesCanvas.width=Math.round(r.width*ratio);bubblesCanvas.height=Math.round(r.height*ratio);bubblesCtx.setTransform(ratio,0,0,ratio,0,0);}
   destination=null;activeDestination=null;px=clamp(px,48,worldW-48);py=clamp(py,48,worldH-48);
   camX=clamp(px-r.width*.5,0,Math.max(0,worldW-r.width));
   camY=clamp(py-r.height*.5,0,Math.max(0,worldH-r.height));
  }
  // Streams begin at the current diver position. The current and labels move
  // with the diver; animated chevrons point toward every destination.
  function drawNavigationStreams(now){
   if(!routesCtx||!stageW||!stageH)return;
   routesCtx.clearRect(0,0,stageW,stageH);
   const fromX=px-camX,fromY=py-camY;
   const tones={cyan:'#66e7ff',teal:'#51ebc6',rift:'#c582ff',gold:'#efc77e',violet:'#b6a1ff',blue:'#80bbff',ice:'#abf3f7',rose:'#ff96c2'};
   for(const [index,station] of stations.entries()){
    const dx=station.wx-px,dy=station.wy-py,d=Math.hypot(dx,dy);
    if(d<42)continue;
    const ux=dx/d,uy=dy/d,normalX=-uy,normalY=ux;
    const sx=fromX+ux*42,sy=fromY+uy*42;
    const length=Math.max(12,d-126),ex=sx+ux*length,ey=sy+uy*length;
    const bend=Math.min(78,length*.12)*(index%2===0?1:-1);
    const cx=(sx+ex)*.5+normalX*bend,cy=(sy+ey)*.5+normalY*bend;
    const color=tones[station.tone]||'#9bfbff',selected=activeDestination===station;
    const pointAt=t=>{const q=1-t;return{x:q*q*sx+2*q*t*cx+t*t*ex,y:q*q*sy+2*q*t*cy+t*t*ey};};
    const trace=()=>{routesCtx.beginPath();routesCtx.moveTo(sx,sy);routesCtx.quadraticCurveTo(cx,cy,ex,ey);};
    routesCtx.save();
    trace();routesCtx.lineCap='round';routesCtx.strokeStyle=color;routesCtx.lineWidth=32;
    routesCtx.globalAlpha=selected?.17:.065;routesCtx.stroke();
    trace();routesCtx.lineWidth=22;routesCtx.globalAlpha=selected?.26:.12;routesCtx.stroke();
    trace();routesCtx.lineWidth=1.9;routesCtx.globalAlpha=selected?.85:.43;
    routesCtx.setLineDash([14,17]);routesCtx.lineDashOffset=-now*.045;routesCtx.stroke();routesCtx.setLineDash([]);
    for(let i=0;i<4;i++){
     const t=(now*.00017+i*.25)%1,p=pointAt(t),q=pointAt(Math.min(1,t+.015));
     routesCtx.save();routesCtx.translate(p.x,p.y);routesCtx.rotate(Math.atan2(q.y-p.y,q.x-p.x));
     routesCtx.globalAlpha=(selected?.82:.5)*Math.sin(Math.PI*t);
     routesCtx.strokeStyle='#d5fbff';routesCtx.lineWidth=1.8;routesCtx.beginPath();
     routesCtx.moveTo(-5,-4);routesCtx.lineTo(0,0);routesCtx.lineTo(-5,4);routesCtx.stroke();routesCtx.restore();
    }
    // Measure along the stream in SCREEN pixels, not a fraction of the
    // world-distance to the portal. Thus a far-away destination still has
    // an always-visible route name beside the swimmer.
    const label=station.label;
    routesCtx.font='700 '+(stageW<600?10:12)+'px Inter, sans-serif';
    const spacing=1.2;
    const glyphs=[...label],glyphWidths=glyphs.map(ch=>routesCtx.measureText(ch).width+spacing);
    const textLength=glyphWidths.reduce((sum,w)=>sum+w,0);
    const samples=[{t:0,p:pointAt(0),distance:0}];
    let routeLength=0;
    for(let j=1;j<=48;j++){
     const t=j/48,p=pointAt(t),prev=samples[j-1].p;
     routeLength+=Math.hypot(p.x-prev.x,p.y-prev.y);
     samples.push({t,p,distance:routeLength});
    }
    const positionAtDistance=distance=>{
     const dist=Math.max(0,Math.min(routeLength,distance));
     let lo=1;
     while(lo<samples.length-1&&samples[lo].distance<dist)lo++;
     const prior=samples[lo-1],next=samples[lo];
     const ratio=(dist-prior.distance)/Math.max(.0001,next.distance-prior.distance);
     return pointAt(prior.t+(next.t-prior.t)*ratio);
    };
    // The center of the caption stays 105-155px from the diver, irrespective
    // of the portal's world position, and never beyond the visible stage.
    const desiredCenter=Math.max(textLength*.55+45,stageW<600?112:155);
    const centerDistance=Math.min(Math.max(textLength*.6,routeLength*.5),desiredCenter,Math.max(0,routeLength-textLength*.6));
    const reversed=ux<-.12;
    const order=reversed?glyphs.slice().reverse():glyphs;
    const widths=reversed?glyphWidths.slice().reverse():glyphWidths;
    let cursor=-textLength/2;
    for(let j=0;j<order.length;j++){
     const ch=order[j],advance=widths[j];
     const d=centerDistance+cursor+advance*.5;
     const p=positionAtDistance(d),near=positionAtDistance(d+3);
     const tang=Math.atan2(near.y-p.y,near.x-p.x)+(reversed?Math.PI:0);
     // Keep each glyph inside the viewport even when the diver hugs a border.
     const x=Math.max(9,Math.min(stageW-9,p.x));
     const y=Math.max(13,Math.min(stageH-13,p.y));
     routesCtx.save();routesCtx.translate(x,y);routesCtx.rotate(tang);
     routesCtx.globalAlpha=selected?.98:.91;
     routesCtx.shadowColor='rgba(0,7,14,.98)';routesCtx.shadowBlur=4;
     routesCtx.strokeStyle='rgba(0,8,16,.96)';routesCtx.lineWidth=2.7;
     routesCtx.strokeText(ch,0,0);
     routesCtx.fillStyle=selected?'#fff':color;routesCtx.fillText(ch,0,0);
     routesCtx.restore();cursor+=advance;
    }
    routesCtx.restore();
   }
  }
  resizeWorld();
  window.addEventListener('resize',()=>{if(!menu.hidden)resizeWorld();});
  if(typeof ResizeObserver==='function'){
   const observer=new ResizeObserver(()=>{if(!menu.hidden&&stage.clientWidth>10)resizeWorld();});
   observer.observe(stage);
  }
  function drawSubmarine(){
   if(!subCtx||!stageW||!stageH)return;
   const dpr=Math.min(1.5,devicePixelRatio||1);
   submarineCanvas.width=Math.round(stageW*dpr);
   submarineCanvas.height=Math.round(stageH*dpr);
   subCtx.setTransform(dpr,0,0,dpr,0,0);
   const c=subCtx,scale=Math.max(.5,Math.min(1.1,stageW/900));
   c.save();c.translate(stageW*.5,0);c.scale(scale,scale);
   const metal=c.createLinearGradient(0,-110,0,95);
   metal.addColorStop(0,'#f7d94f');metal.addColorStop(.38,'#d0a220');
   metal.addColorStop(.75,'#8b6317');metal.addColorStop(1,'#382812');
   c.fillStyle=metal;c.strokeStyle='#101519';c.lineWidth=6;
   c.beginPath();c.moveTo(-260,-125);c.lineTo(260,-125);
   c.bezierCurveTo(265,-4,230,25,170,38);c.lineTo(-170,38);
   c.bezierCurveTo(-230,25,-265,-4,-260,-125);c.closePath();c.fill();c.stroke();
   c.fillStyle='#111820';c.fillRect(-220,-1,440,9);
   c.fillStyle='#eac44a';c.fillRect(-68,-90,136,78);c.strokeRect(-68,-90,136,78);
   for(let x=-220;x<=220;x+=36){c.beginPath();c.fillStyle='#13191c';c.arc(x,22,3.5,0,Math.PI*2);c.fill();}
   c.beginPath();c.ellipse(0,36,52,24,0,0,Math.PI*2);
   c.fillStyle='#07111b';c.fill();c.strokeStyle='#e2bd3d';c.lineWidth=9;c.stroke();
   c.save();c.translate(15,24);c.rotate(-.5);
   c.beginPath();c.ellipse(53,-30,41,20,0,0,Math.PI*2);
   c.fillStyle='#ae821e';c.fill();c.strokeStyle='#101419';c.lineWidth=5;c.stroke();c.restore();
   c.restore();
  }
  function resetToHatch(){
   px=worldW*.5;py=worldH*.15;vx=0;vy=0;heading=Math.PI*.5;
   destination=null;activeDestination=null;arrival=null;arrivalAt=0;
   spawnBubbleTime=1.1;diver.classList.remove('ocean-entering');
  }
  function enterPortal(s){
   if(!s||!isInteractive()||s.button.disabled||s.button.hidden||arrival)return;
   if(Math.hypot(s.wx-px,s.wy-py)>Math.max(48,s.button.offsetWidth*.4))return;
   arrival=s;arrivalAt=performance.now()+430;
   diver.classList.add('ocean-entering');
  }
  function finishArrival(){
   const s=arrival;if(!s)return;arrival=null;arrivalAt=0;
   s.button.dataset.portalArriving='1';
   try{s.button.click();}finally{delete s.button.dataset.portalArriving;}
   if(s.id!=='playBtn')returnOnClose=true;
   destination=null;activeDestination=null;
  }
  window.addEventListener('abyssal-modal-closed',event=>{
   if(event.detail?.screenId==='roomsScreen'&&returnOnClose){
    returnOnClose=false;resetToHatch();
   }
  });
  document.addEventListener('click',e=>{
   if(e.target.closest?.('#abyssDescentClose')&&returnOnClose){
    returnOnClose=false;requestAnimationFrame(resetToHatch);
   }
  },true);
  if(typeof MutationObserver==='function'){
   const observer=new MutationObserver(()=>{
    const panel=document.getElementById('abyssDescentPanel');
    if(returnOnClose&&panel?.hidden&&!menu.hidden&&!document.body.classList.contains('game-active')){
     returnOnClose=false;resetToHatch();
    }
   });
   observer.observe(document.body,{attributes:true,subtree:true,attributeFilter:['hidden']});
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
   if(nearest)nearest.button.classList.add('portal-near');
   // Coordinates, distances and portal-target banners were removed; current labels
   // are already embedded into the directional stream.
   if(enter){enter.disabled=!nearest;enter.textContent=nearest?'ENTRAR · '+nearest.label:'APROXIME-SE DE UM PORTAL';}
   // The outer glow marks proximity, but entry happens at the inner rift.
   // Keep checking until the swimmer actually crosses the entry radius.
   if(nearest&&activeDestination===nearest&&bestDistance<=Math.max(48,nearest.button.offsetWidth*.4))enterPortal(nearest);
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
  function navigateToPointer(event){
   const r=stage.getBoundingClientRect();
   destination={x:clamp(event.clientX-r.left+camX,20,worldW-20),y:clamp(event.clientY-r.top+camY,20,worldH-20)};
   activeDestination=null;
  }
  stage.addEventListener('pointerdown',event=>{
   if(!isInteractive()||event.button!==0||event.target.closest?.('button,a,input,select,#menuOceanMobilePad'))return;
   navigateToPointer(event);
   followingPointer=event.pointerId;
   try{stage.setPointerCapture(event.pointerId);}catch(_){}
  });
  stage.addEventListener('pointermove',event=>{
   if(followingPointer===event.pointerId&&isInteractive())navigateToPointer(event);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
   stage.addEventListener(type,event=>{if(followingPointer===event.pointerId)followingPointer=null;});
  }
  const mobilePad=document.getElementById('menuOceanMobilePad');
  if(mobilePad){
   mobilePad.hidden=false;mobilePad.replaceChildren();
   mobilePad.classList.add('ocean-joystick');
   mobilePad.setAttribute('aria-label','Joystick translúcido para nadar');
   const thumb=document.createElement('span');thumb.className='ocean-joystick-thumb';
   mobilePad.appendChild(thumb);
   let stickId=null,joystickX=0,joystickY=0;
   const drive=e=>{
    const r=mobilePad.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
    const dx=e.clientX-cx,dy=e.clientY-cy,dist=Math.hypot(dx,dy)||1,extent=Math.min(40,r.width*.34);
    const ratio=Math.min(1,dist/extent);
    joystickX=dx/dist*ratio;joystickY=dy/dist*ratio;
    thumb.style.transform='translate('+Math.round(joystickX*extent)+'px,'+Math.round(joystickY*extent)+'px)';
    destination=null;activeDestination=null;
   };
   mobilePad.addEventListener('pointerdown',e=>{
    if(stickId!==null||!isInteractive())return;
    e.preventDefault();stickId=e.pointerId;try{mobilePad.setPointerCapture(e.pointerId)}catch(_){}
    drive(e);
   });
   mobilePad.addEventListener('pointermove',e=>{if(stickId===e.pointerId){e.preventDefault();drive(e);}});
   const stop=e=>{if(stickId!==e.pointerId)return;stickId=null;joystickX=0;joystickY=0;thumb.style.transform='translate(0px,0px)';};
   for(const type of ['pointerup','pointercancel','lostpointercapture'])mobilePad.addEventListener(type,stop);
   window.addEventListener('blur',()=>{stickId=null;joystickX=0;joystickY=0;thumb.style.transform='translate(0px,0px)';});
   window.__abyssalMenuJoystick=()=>({x:joystickX,y:joystickY});
  }
  enter?.addEventListener('click',()=>enterPortal(nearest));
  function animate(now){
   const dt=Math.min(.055,Math.max(0,(now-last)/1000));last=now;
   const enabled=isInteractive();
   if(enabled&&!menuWasActive){menuWasActive=true;if(returnOnClose){returnOnClose=false;resetToHatch();}}
   if(!enabled)menuWasActive=false;
   if(enabled){
    if(stage.clientWidth>10&&(Math.abs(stage.clientWidth-stageW)>2||Math.abs(stage.clientHeight-stageH)>2))resizeWorld();
    let mx=(held.has('right')?1:0)-(held.has('left')?1:0);
    let my=(held.has('down')?1:0)-(held.has('up')?1:0);
    const stick=window.__abyssalMenuJoystick?.();
    if(stick&&Math.hypot(stick.x,stick.y)>.04){mx=stick.x;my=stick.y;}
    if(arrival){destination={x:arrival.wx,y:arrival.wy};mx=0;my=0;if(now>=arrivalAt)finishArrival();}
    else if(mx||my){destination=null;activeDestination=null;}
    else if(destination){
     const dx=destination.x-px,dy=destination.y-py,d=Math.hypot(dx,dy);
     if(d>8){mx=dx/d;my=dy/d;}else{destination=null;mx=0;my=0;}
    }
    const unit=Math.hypot(mx,my)||1;
    const speed=(arrival||activeDestination)?Math.max(520,stageW*1.0):Math.max(190,Math.min(255,worldW*.3));
    const response=1-Math.exp(-dt*9);
    vx=lerp(vx,mx/unit*speed,response);vy=lerp(vy,my/unit*speed,response);
    px=clamp(px+vx*dt,35,worldW-35);py=clamp(py+vy*dt,35,worldH-35);
    if(Math.hypot(vx,vy)>5){const a=Math.atan2(vy,vx),diff=Math.atan2(Math.sin(a-heading),Math.cos(a-heading));heading+=diff*(1-Math.exp(-dt*8));}
    camX=lerp(camX,clamp(px-stage.clientWidth*.5,0,Math.max(0,worldW-stage.clientWidth)),1-Math.exp(-dt*7));
    camY=lerp(camY,clamp(py-stage.clientHeight*.5,0,Math.max(0,worldH-stage.clientHeight)),1-Math.exp(-dt*7));
    layer.style.setProperty('transform','translate3d('+(-camX).toFixed(2)+'px,'+(-camY).toFixed(2)+'px,0)','important');
    diver.style.setProperty('--diver-x',(px-camX)+'px');diver.style.setProperty('--diver-y',(py-camY)+'px');
    diver.classList.toggle('swimming',Math.hypot(vx,vy)>6);
    if(Math.hypot(vx,vy)>22){
     bubbleElapsed+=dt;
     if(bubbleElapsed>.075){
      bubbleElapsed=0;
      for(let i=0;i<2;i++)motionBubbles.push({
       x:px-Math.cos(heading)*16+(Math.random()-.5)*10,
       y:py-Math.sin(heading)*16+(Math.random()-.5)*10,
       vx:-vx*.095+(Math.random()-.5)*15,vy:-16-vy*.06-Math.random()*12,
       radius:1+Math.random()*1.3,life:.36+Math.random()*.28
      });
      if(motionBubbles.length>50)motionBubbles.splice(0,motionBubbles.length-50);
     }
    }else bubbleElapsed=0;
    pickNear();
    drawNavigationStreams(now);
    if(spawnBubbleTime>0){
     spawnBubbleTime=Math.max(0,spawnBubbleTime-dt);
     for(let i=0;i<6;i++)motionBubbles.push({
      x:px+(Math.random()-.5)*48,y:py+(Math.random()-.5)*35,
      vx:(Math.random()-.5)*50,vy:-25-Math.random()*90,
      radius:1+Math.random()*3.5,life:.35+Math.random()*.75
     });
     if(motionBubbles.length>110)motionBubbles.splice(0,motionBubbles.length-110);
    }
   }else{vx=0;vy=0;held.clear();followingPointer=null;}
   if(bubblesCtx){
    bubblesCtx.clearRect(0,0,stageW,stageH);
    for(let i=motionBubbles.length-1;i>=0;i--){
     const b=motionBubbles[i];b.life-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
     if(b.life<=0){motionBubbles.splice(i,1);continue;}
     bubblesCtx.globalAlpha=Math.min(1,b.life/.24)*.52;
     bubblesCtx.strokeStyle='#d4faff';bubblesCtx.lineWidth=.8;
     bubblesCtx.beginPath();bubblesCtx.arc(b.x-camX,b.y-camY,b.radius,0,Math.PI*2);bubblesCtx.stroke();
    }
    bubblesCtx.globalAlpha=1;
   }
   ctx.clearRect(0,0,canvas.width,canvas.height);
   window.AbyssalDiverArt?.draw?.(ctx,90,65,13,heading,heading,now,{gender:window.AbyssalDiverGender||'male',moving:enabled&&Math.hypot(vx,vy)>7});
   requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();