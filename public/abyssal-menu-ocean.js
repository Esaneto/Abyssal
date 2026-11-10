/* Abyssal: submarine hatch, three cinematic ocean routes, accessible persistent utilities.
   All actions re-use the EXISTING game/online/Fossas click handlers after the animation. */
(function(){
 'use strict';
 const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
 const lerp=(a,b,t)=>a+(b-a)*t;
 const ease=t=>t*t*(3-2*t);
 // The playable classics share the LEFT current; the new open sea is RIGHT.
 // Fossas remain a separate fissure in the bottom of the same swimming scene.
 const ROUTES=[
  {id:'divePortalBtn',x:.19,y:.47,tone:'#68e7ff',label:'MERGULHAR',kind:'dive'},
  {id:'openSeaPortalBtn',x:.81,y:.47,tone:'#60eed3',label:'MAR ABERTO',kind:'sea'},
  {id:'riftPortalBtn',x:.50,y:.835,tone:'#aa3347',label:'FOSSAS ABISSAIS',kind:'rift'}
 ];
 function boot(){
  const menu=document.getElementById('menuScreen'),stage=document.getElementById('menuOceanStage');
  if(!menu||!stage||menu.dataset.oceanV4Ready)return;
  menu.dataset.oceanV4Ready='true';
  menu.classList.add('submarine-menu');
  const layer=document.getElementById('menuOceanPortalLayer'),diver=document.getElementById('menuOceanDiver');
  const canvas=document.getElementById('menuOceanDiverCanvas'),ctx=canvas?.getContext('2d');
  const scenery=document.getElementById('menuOceanScenery'),submarine=document.getElementById('menuOceanSubmarine');
  if(!layer||!diver||!ctx)return;
  const routesCanvas=document.createElement('canvas');
  routesCanvas.className='abyss-ocean-routes';
  routesCanvas.setAttribute('aria-hidden','true');
  const bubblesCanvas=document.createElement('canvas');
  bubblesCanvas.className='abyss-ocean-bubbles';
  bubblesCanvas.setAttribute('aria-hidden','true');
  stage.insertBefore(routesCanvas,diver);
  stage.insertBefore(bubblesCanvas,diver);
  const currents=routesCanvas.getContext('2d'),bubbleCtx=bubblesCanvas.getContext('2d');
  const stations=[...ROUTES,{id:'submarineWorkshopBtn',x:.5,y:0,tone:'#d4ad68',label:'LABORATÓRIO',kind:'lab'}].map(p=>({...p,button:document.getElementById(p.id),wx:0,wy:0})).filter(p=>p.button);
  if(stations.length!==4)return;
  let w=0,h=0,px=0,py=0,vx=0,vy=0,heading=Math.PI/2,emergence=0;
  let initialized=false,wasVisible=false,transition=null,waitingForModal=false;
  let nearElapsed=0,nearStationId=null;
  let moveTarget=null,followPointer=null,near=null,last=performance.now(),bubbleElapsed=0;
  let joystickX=0,joystickY=0,joystickId=null;
  const bubbles=[],held=new Set(),keyMap={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
  const interactive=()=>{
   if(menu.hidden||document.hidden||document.body.classList.contains('game-active')||transition||waitingForModal)return false;
   for(const panel of document.querySelectorAll('.modal-screen,.modal-overlay,#abyssDescentPanel,#abyssalDiveChoicePanel')){
    if(panel.hidden||!panel.isConnected)continue;
    if(panel.getClientRects().length&&getComputedStyle(panel).display!=='none'&&getComputedStyle(panel).visibility!=='hidden')return false;
   }
   return true;
  };
  // The hatch position matches the scaling used by drawSubmarine().
  const hatch=()=>({x:w*.5,y:86*Math.min(1.2,Math.max(.59,w/800))});
  const bubble=(x,y,burst=false)=>{
   const count=burst?5:1;
   for(let i=0;i<count;i++)bubbles.push({
    x:x+(Math.random()-.5)*(burst?50:9),y:y+(Math.random()-.5)*(burst?24:8),
    vx:(Math.random()-.5)*(burst?75:25),vy:-20-Math.random()*(burst?96:30),
    radius:(burst?1.3:0.8)+Math.random()*(burst?4:2),
    life:(burst?.55:.36)+Math.random()*(burst?.74:.30),max:burst?1.30:.7
   });
   if(bubbles.length>145)bubbles.splice(0,bubbles.length-145);
  };
  function resetToHatch(){
   if(w<10||h<10)return;
   const pos=hatch();px=pos.x;py=pos.y;vx=0;vy=0;heading=Math.PI/2;
   emergence=0;transition=null;waitingForModal=false;moveTarget=null;followPointer=null;
   nearElapsed=0;nearStationId=null;
   held.clear();joystickX=0;joystickY=0;
   const thumb=stage.querySelector('.ocean-joystick-thumb');if(thumb)thumb.style.transform='translate(0,0)';
   for(let i=0;i<12;i++)bubble(px,py+15,true);
   diver.style.opacity='1';diver.style.setProperty('--abyss-exit-scale','1');
  }
  function sizeScene(){
   const r=stage.getBoundingClientRect();if(r.width<80||r.height<100)return;
   const oldW=w,oldH=h;w=r.width;h=r.height;
   for(const c of [routesCanvas,bubblesCanvas]){
    const ratio=Math.max(1,Math.min(2.25,window.devicePixelRatio||1,Math.sqrt(3000000/(w*h))));
    c.width=Math.round(w*ratio);c.height=Math.round(h*ratio);
    c.style.width=w+'px';c.style.height=h+'px';
    c.getContext('2d').setTransform(ratio,0,0,ratio,0,0);
   }
   const renderDpr=Math.max(1,Math.min(2.5,window.devicePixelRatio||1));
   canvas.width=Math.round(180*renderDpr);canvas.height=Math.round(130*renderDpr);
   ctx.setTransform(renderDpr,0,0,renderDpr,0,0);
   ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
   layer.style.width=w+'px';layer.style.height=h+'px';layer.style.transform='none';
   window.AbyssalMenuScenery?.draw?.(scenery,w,h);
   window.AbyssalMenuScenery?.drawSubmarine?.(submarine,w,h);
   stage.style.setProperty('--abyss-hatch-y',hatch().y+'px');
   stage.style.setProperty('--abyss-hatch-scale',Math.min(1.2,Math.max(.59,w/800)));
   for(const s of stations){
    s.wx=w*s.x;s.wy=s.kind==='lab'?hatch().y:h*s.y;
    s.button.dataset.portalTone=s.kind==='rift'?'blood':s.kind==='dive'?'cyan':'teal';
    s.button.classList.remove('abyss-rift-gate');
    s.button.classList.toggle('abyss-current-entry',s.kind!=='rift');
    s.button.classList.toggle('abyss-fissure-entry',s.kind==='rift');
    s.button.style.setProperty('--portal-x',s.wx+'px');
    s.button.style.setProperty('--portal-y',s.wy+'px');
   }
   if(!initialized){initialized=true;resetToHatch();}
   else if(!transition&&oldW>0&&oldH>0){
    // Keep the same normalized diver position when the phone rotates.
    px=clamp(px/oldW*w,24,w-24);
    py=clamp(py/oldH*h,24,h-24);
   }
  }
  function playEntrance(s){
   if(!interactive()||!s||s.button.disabled||s.button.hidden)return;
   held.clear();moveTarget=null;followPointer=null;joystickX=0;joystickY=0;
   transition={station:s,x:px,y:py,t:0,duration:s.kind==='lab'?1.28:s.kind==='rift'?1.04:.87};
   nearElapsed=0;nearStationId=null;
   vx=0;vy=0;
   stage.dataset.abyssTransit=s.kind;
  }
  function finishEntrance(){
   const s=transition?.station;if(!s)return;
   transition=null;stage.removeAttribute('data-abyss-transit');
   waitingForModal=s.kind==='dive'||s.kind==='rift'||s.kind==='lab';
   s.button.dataset.portalArriving='1';
   try{s.button.click();}
   finally{delete s.button.dataset.portalArriving;}
   // The laboratory remains in the main menu, behind a full-screen cockpit interior.
   if(s.kind==='lab'){diver.style.opacity='0';return;}
   // A right current enters exploration; the left opens the Solo/Online selector.
   if(s.kind==='sea'||document.body.classList.contains('game-active')||menu.hidden){
    wasVisible=false;return;
   }
   // The pre-existing room browser and Fossas choice dialog stay authoritative.
   if(s.kind==='rift'&&document.getElementById('abyssDescentPanel')?.hidden){
    resetToHatch();return;
   }
  }
  for(const s of stations){
   s.button.addEventListener('click',event=>{
    if(s.button.dataset.portalArriving==='1')return;
    if(!interactive())return;
    event.preventDefault();event.stopImmediatePropagation();
    playEntrance(s);
   },true);
  }
  // Keep existing game and online actions intact; only the menu routing changes.
  const divePanel=document.createElement('section');
  divePanel.id='abyssalDiveChoicePanel';
  divePanel.className='abyss-dive-choice-panel';
  divePanel.hidden=true;
  divePanel.innerHTML='<div class="abyss-dive-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="abyssDiveChoiceTitle">'+
   '<button id="abyssDiveChoiceClose" class="abyss-dive-choice-close" type="button" aria-label="Fechar">×</button>'+
   '<small>ESCOLHA SEU MERGULHO</small><h2 id="abyssDiveChoiceTitle">MERGULHAR</h2>'+
   '<div class="abyss-dive-choice-actions">'+
    '<button type="button" id="abyssDiveSoloChoice"><strong>MERGULHAR SOLO</strong><span>Jogar sozinho no modo clássico</span></button>'+
    '<button type="button" id="abyssDiveOnlineChoice"><strong>MERGULHAR ONLINE</strong><span>Escolher uma sala online</span></button>'+
   '</div></div>';
  document.body.appendChild(divePanel);
  const closeDive=()=>{
   if(divePanel.hidden)return;
   divePanel.hidden=true;
   closeReturn();
  };
  document.getElementById('divePortalBtn').addEventListener('click',()=>{
   divePanel.hidden=false;
   divePanel.querySelector('#abyssDiveSoloChoice')?.focus();
  });
  document.getElementById('openSeaPortalBtn').addEventListener('click',()=>{
   window.dispatchEvent(new CustomEvent('abyssal-start-open-sea'));
  });
  divePanel.querySelector('#abyssDiveChoiceClose')?.addEventListener('click',closeDive);
  divePanel.addEventListener('click',e=>{if(e.target===divePanel)closeDive();});
  divePanel.querySelector('#abyssDiveSoloChoice')?.addEventListener('click',()=>{
   divePanel.hidden=true;
   document.getElementById('playBtn')?.click();
  });
  divePanel.querySelector('#abyssDiveOnlineChoice')?.addEventListener('click',()=>{
   divePanel.hidden=true;
   // Existing online button owns the room browser, authentication and PvP flow.
   document.getElementById('onlineBtn')?.click();
   if(!menu.hidden)closeReturn();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!divePanel.hidden){event.preventDefault();closeDive();}});
  function closeReturn(){
   if(!menu.hidden&&!document.body.classList.contains('game-active')&&initialized)resetToHatch();
  }
  window.addEventListener('abyssal-modal-closed',event=>{
   if(['roomsScreen','submarineWorkshop'].includes(event.detail?.screenId))closeReturn();
  });
  window.addEventListener('abyssal-descent-closed',closeReturn);
  window.addEventListener('abyssal-menu-portal-cancelled',event=>{
   if(event.detail?.portal==='riftPortalBtn')closeReturn();
  });
  document.getElementById('loginCancelBtn')?.addEventListener('click',()=>{
   if(waitingForModal)closeReturn();
  });
  window.addEventListener('abyssal-room-joined',()=>{wasVisible=false;waitingForModal=false;});
  // Keyboard, mouse and joystick stay available for free-swim navigation.
  function nearestStation(){
   let closest=null,distance=Infinity;
   for(const s of stations){
    s.button.classList.remove('portal-near');
    const d=Math.hypot(px-s.wx,py-s.wy);
    if(d<distance){closest=s;distance=d;}
   }
   near=distance<Math.max(47,Math.min(closest?.button.offsetWidth*.34||50,73))?closest:null;
   if(near)near.button.classList.add('portal-near');
   return near;
  }
  window.addEventListener('keydown',event=>{
   if(!interactive()||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName||''))return;
   const key=String(event.key||'').toLowerCase();
   if(keyMap[key]){held.add(keyMap[key]);moveTarget=null;event.preventDefault();}
   else if((key==='f'||key==='enter')&&!event.repeat&&nearestStation()){
    event.preventDefault();playEntrance(near);
   }
  });
  window.addEventListener('keyup',event=>held.delete(keyMap[String(event.key||'').toLowerCase()]));
  window.addEventListener('blur',()=>{held.clear();followPointer=null;joystickX=0;joystickY=0;});
  function pointerTarget(e){
   const r=stage.getBoundingClientRect();
   moveTarget={x:clamp(e.clientX-r.left,20,w-20),y:clamp(e.clientY-r.top,24,h-24)};
  }
  stage.addEventListener('pointerdown',event=>{
   if(!interactive()||event.button!==0||event.target.closest?.('button,a,input,select,#menuOceanMobilePad'))return;
   pointerTarget(event);followPointer=event.pointerId;
   try{stage.setPointerCapture(event.pointerId);}catch(_){}
  });
  stage.addEventListener('pointermove',event=>{
   if(followPointer===event.pointerId&&interactive())pointerTarget(event);
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture']){
   stage.addEventListener(name,event=>{if(followPointer===event.pointerId)followPointer=null;});
  }
  const pad=document.getElementById('menuOceanMobilePad');
  if(pad){
   pad.hidden=false;pad.replaceChildren();pad.classList.add('ocean-joystick');
   pad.setAttribute('aria-label','Joystick translúcido para nadar');
   const thumb=document.createElement('span');thumb.className='ocean-joystick-thumb';pad.appendChild(thumb);
   const drive=e=>{
    const r=pad.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;
    const length=Math.hypot(dx,dy)||1,reach=Math.min(39,r.width*.34),scale=Math.min(1,length/reach);
    joystickX=dx/length*scale;joystickY=dy/length*scale;moveTarget=null;
    thumb.style.transform='translate('+Math.round(joystickX*reach)+'px,'+Math.round(joystickY*reach)+'px)';
   };
   pad.addEventListener('pointerdown',e=>{
    if(!interactive()||joystickId!==null)return;
    joystickId=e.pointerId;e.preventDefault();
    try{pad.setPointerCapture(e.pointerId);}catch(_){}drive(e);
   });
   pad.addEventListener('pointermove',e=>{if(joystickId===e.pointerId){e.preventDefault();drive(e);}});
   const stop=e=>{if(e.pointerId!==joystickId)return;joystickId=null;joystickX=0;joystickY=0;thumb.style.transform='translate(0,0)';};
   for(const name of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(name,stop);
  }
  function renderCurrents(now){
   if(!currents||w<10||h<10)return;
   currents.clearRect(0,0,w,h);
   // Water streams past the gates and disappears off-screen. The flow belongs
   // to the ocean, never to the diver's current position.
   for(const s of stations){
    if(s.kind!=='dive'&&s.kind!=='sea')continue;
    const direction=s.kind==='dive'?-1:1;
    const startX=s.wx-direction*w*.19,endX=s.wx+direction*w*.37;
    const span=endX-startX,band=Math.min(64,h*.105);
    currents.save();currents.lineCap='round';
    for(let lane=-5;lane<=5;lane++){
     const offset=lane/5,centerY=s.wy+offset*band;
     const bend=Math.sin(now*.00032+lane*.75)*7;
     const a={x:startX,y:centerY-offset*9};
     const b={x:startX+span*.35,y:centerY-8+offset*4+bend};
     const c={x:startX+span*.66,y:centerY+10-offset*7+bend*.5};
     const d={x:endX,y:centerY+offset*19};
     const path=()=>{currents.beginPath();currents.moveTo(a.x,a.y);currents.bezierCurveTo(b.x,b.y,c.x,c.y,d.x,d.y);};
     currents.strokeStyle=s.tone;currents.globalAlpha=(.035+(1-Math.abs(offset))*.043);
     currents.lineWidth=8+(1-Math.abs(offset))*12;path();currents.stroke();
     currents.strokeStyle=lane%2?'#9beefa':s.tone;
     currents.globalAlpha=.11+(1-Math.abs(offset))*.085;
     currents.lineWidth=.9+(1-Math.abs(offset))*.9;
     currents.setLineDash([9+Math.abs(lane)*2,18+Math.abs(lane)*3]);
     currents.lineDashOffset=-now*(.034+Math.abs(offset)*.007);
     path();currents.stroke();currents.setLineDash([]);
     // A sparse stream of whitewater particles follows the same cubic curve.
     for(let j=0;j<3;j++){
      const t=(now*.00022+j/3+(lane+5)*.071)%1,inv=1-t;
      const px=inv*inv*inv*a.x+3*inv*inv*t*b.x+3*inv*t*t*c.x+t*t*t*d.x;
      const py=inv*inv*inv*a.y+3*inv*inv*t*b.y+3*inv*t*t*c.y+t*t*t*d.y;
      currents.globalAlpha=(.13+.27*(1-Math.abs(offset)))*Math.pow(Math.sin(Math.PI*t),1.6);
      currents.fillStyle='#d9ffff';
      currents.beginPath();currents.ellipse(px,py,2.8+1.6*t,.7,0,0,Math.PI*2);currents.fill();
     }
    }
    currents.restore();
   }
  }
  function animate(now){
   const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
   const visible=!menu.hidden&&!document.body.classList.contains('game-active');
   if(visible&&!wasVisible){sizeScene();resetToHatch();}
   wasVisible=visible;
   // No menu paint, currents or particles while gameplay/other screens own the UI.
   if(!visible){vx=0;vy=0;held.clear();followPointer=null;setTimeout(()=>requestAnimationFrame(animate),250);return;}
   if(visible){
    if(Math.abs(stage.clientWidth-w)>2||Math.abs(stage.clientHeight-h)>2)sizeScene();
    if(transition){
     const tx=transition;
     tx.t=Math.min(1,tx.t+dt/tx.duration);
     const t=ease(tx.t),s=tx.station,curve=Math.sin(Math.PI*t)*Math.min(38,w*.055);
     px=lerp(tx.x,s.wx,t)+(s.kind==='lab'?Math.sin(t*Math.PI)*10:s.kind==='rift'?0:(s.kind==='dive'?-1:1)*curve);
     py=lerp(tx.y,s.wy,t)+(s.kind==='lab'?-Math.sin(Math.PI*t)*16:s.kind==='rift'?-Math.sin(Math.PI*t)*17:Math.sin(Math.PI*t)*8);
     if(s.kind==='lab'){
      const fade=clamp((t-.64)/.36,0,1);
      diver.style.setProperty('--abyss-exit-scale',String(1-fade*.70));
      if(t>.71&&Math.random()<.16)bubble(px,py+14,true);
     }
     heading=Math.atan2(s.wy-py,s.wx-px);
     diver.style.opacity=String(clamp((1-tx.t)*(s.kind==='lab'?2.1:3.3),0,1));
     if(tx.t===1)finishEntrance();
    }else if(!waitingForModal){
     // Hatch ejects the diver with a short easing, showering bubbles.
     if(emergence<1){
      const step=dt/1.05;emergence=Math.min(1,emergence+step);
      const starting=hatch();px=starting.x;
      py=lerp(starting.y,Math.min(h*.40,starting.y+94),ease(emergence));
      heading=Math.PI/2;vx=0;vy=85*(1-emergence);
      bubbleElapsed+=dt;
      if(bubbleElapsed>.028){bubbleElapsed=0;for(let n=0;n<4;n++)bubble(px,py+17,true);}
     }else{
      let mx=(held.has('right')?1:0)-(held.has('left')?1:0);
      let my=(held.has('down')?1:0)-(held.has('up')?1:0);
      if(Math.hypot(joystickX,joystickY)>.04){mx=joystickX;my=joystickY;}
      else if(moveTarget){
       const dx=moveTarget.x-px,dy=moveTarget.y-py,d=Math.hypot(dx,dy);
       if(d>9){mx=dx/d;my=dy/d;}else moveTarget=null;
      }
      const speed=clamp(w*.37,175,245),unit=Math.hypot(mx,my)||1,alpha=1-Math.exp(-dt*8);
      vx=lerp(vx,mx/unit*speed,alpha);vy=lerp(vy,my/unit*speed,alpha);
      px=clamp(px+vx*dt,24,w-24);py=clamp(py+vy*dt,28,h-26);
      if(Math.hypot(vx,vy)>6){
       const a=Math.atan2(vy,vx),diff=Math.atan2(Math.sin(a-heading),Math.cos(a-heading));
       heading+=diff*(1-Math.exp(-dt*10));
       bubbleElapsed+=dt;
       if(bubbleElapsed>.07){bubbleElapsed=0;bubble(px-Math.cos(heading)*15,py-Math.sin(heading)*15);}
      }
      // Free swimming only highlights a destination; entering requires a click or F.
      const nearby=nearestStation();
      if(nearby&&nearby.kind!=='lab'&&Math.hypot(px-nearby.wx,py-nearby.wy)<Math.max(23,Math.min(nearby.button.offsetWidth*.25,42))){
       nearElapsed=nearStationId===nearby.id?nearElapsed+dt:0;
       nearStationId=nearby.id;
       if(nearElapsed>.38)playEntrance(nearby);
      }else{nearElapsed=0;nearStationId=null;}
     }
     diver.style.opacity='1';
    }
    diver.style.setProperty('--diver-x',px+'px');
    diver.style.setProperty('--diver-y',py+'px');
    diver.classList.toggle('swimming',Boolean(transition)||emergence<1||Math.hypot(vx,vy)>5);
    renderCurrents(now);
    if(bubbleCtx){
     bubbleCtx.clearRect(0,0,w,h);
     for(let i=bubbles.length-1;i>=0;i--){
      const b=bubbles[i];b.life-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(b.life<=0){bubbles.splice(i,1);continue;}
      bubbleCtx.globalAlpha=.7*clamp(b.life/(b.max||.7),0,1);
      bubbleCtx.strokeStyle='#c8faff';bubbleCtx.lineWidth=.8;
      bubbleCtx.beginPath();bubbleCtx.arc(b.x,b.y,b.radius,0,2*Math.PI);bubbleCtx.stroke();
     }
     bubbleCtx.globalAlpha=1;
    }
    ctx.clearRect(0,0,180,130);
    window.AbyssalDiverArt?.draw?.(ctx,90,65,13,heading,heading,now,{
     gender:window.AbyssalDiverGender||'male',
     moving:emergence<1||Boolean(transition)||Math.hypot(vx,vy)>6
    });
   }
   requestAnimationFrame(animate);
  }
  sizeScene();
  // Only expose the menu after the active swimmer/currents have their geometry.
  menu.classList.add('menu-ready');
  window.addEventListener('resize',()=>{if(!menu.hidden)sizeScene();});
  if(typeof ResizeObserver==='function'){
   const ro=new ResizeObserver(()=>{if(!menu.hidden&&stage.clientWidth>80&&Math.abs(stage.clientWidth-w)>2)sizeScene();});
   ro.observe(stage);
  }
  requestAnimationFrame(animate);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
 else boot();
})();
