(function(){
 'use strict';
 // The menu is a separate scene. Existing button IDs are retained so that login,
 // matchmaking, purchases, modal handlers and navigation keep their listeners.
 const STATIONS={
  playBtn:{x:33,y:25,tone:'cyan',label:'MERGULHO SOLO'},
  onlineBtn:{x:66,y:25,tone:'teal',label:'MERGULHO ONLINE'},
  riftPortalBtn:{x:83,y:51,tone:'rift',label:'FOSSAS'},
  shopBtn:{x:66,y:77,tone:'gold',label:'ESPÉCIMES'},
  profileBtn:{x:33,y:77,tone:'violet',label:'PERFIL'},
  resonanceBtn:{x:17,y:51,tone:'blue',label:'RESSONÂNCIA'},
  rankingsBtn:{x:10,y:22,tone:'ice',label:'RANKING'},
  wheelBtn:{x:90,y:22,tone:'rose',label:'ROLETA'}
 };
 const MOBILE_STATIONS={
  playBtn:{x:26,y:15},onlineBtn:{x:74,y:15},
  resonanceBtn:{x:26,y:38},riftPortalBtn:{x:74,y:38},
  rankingsBtn:{x:26,y:62},shopBtn:{x:74,y:62},
  profileBtn:{x:26,y:84},wheelBtn:{x:74,y:84}
 };
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function init(){
  const menu=document.getElementById('menuScreen'),stage=document.getElementById('menuOceanStage');
  if(!menu||!stage||menu.dataset.oceanV2Ready)return;
  menu.dataset.oceanV2Ready='true';
  const diver=document.getElementById('menuOceanDiver'),hint=document.getElementById('menuOceanHint'),enter=document.getElementById('menuOceanEnterBtn');
  const canvas=document.getElementById('menuOceanSpecimen'),keys=new Set(),rows=[];
  for(const [id,pos] of Object.entries(STATIONS)){
   const button=document.getElementById(id);
   if(!button)continue;
   button.dataset.portalTone=pos.tone;
   rows.push({button,id,...pos});
  }
  const rift=document.getElementById('riftPortalBtn');
  rift?.addEventListener('click',()=>{
   window.AbyssalPreferredRoomMode='rift';
   document.getElementById('onlineBtn')?.click();
   const mode=document.getElementById('roomModeInput');
   if(mode){mode.value='rift';mode.dispatchEvent(new Event('change',{bubbles:true}));}
  });
  document.getElementById('onlineBtn')?.addEventListener('click',event=>{
   // Programmatic click from Fossas must not overwrite the preferred mode.
   if(event.isTrusted)window.AbyssalPreferredRoomMode='coop';
  });
  let x=50,y=51,vx=0,vy=0,destination=null,nearest=null,last=performance.now();
  function refreshStationPositions(){
   const mobile=stage.clientWidth<=600;
   for(const row of rows){
    const target=mobile?MOBILE_STATIONS[row.id]:STATIONS[row.id];
    row.x=target.x;row.y=target.y;
    row.button.style.setProperty('--portal-x',row.x+'%');
    row.button.style.setProperty('--portal-y',row.y+'%');
   }
  }
  refreshStationPositions();
  window.addEventListener('resize',refreshStationPositions);
  const rectPosition=(clientX,clientY)=>{
   const r=stage.getBoundingClientRect();
   return {x:clamp((clientX-r.left)/Math.max(1,r.width)*100,8,92),y:clamp((clientY-r.top)/Math.max(1,r.height)*100,10,88)};
  };
  function menuInteractive(){
   if(menu.hidden||!menu.isConnected||document.hidden)return false;
   for(const overlay of document.querySelectorAll('section.modal-screen,section.auth-flow-screen,#roomsScreen,#loginScreen,#shopScreen')){
    if(overlay!==menu&&!overlay.hidden&&overlay.getBoundingClientRect().width>0&&overlay.getBoundingClientRect().height>0)return false;
   }
   return true;
  }
  function select(){
   let candidate=null,best=Infinity;
   for(const row of rows){
    const dx=(row.x-x)*(stage.clientWidth/100),dy=(row.y-y)*(stage.clientHeight/100);
    const d=Math.hypot(dx,dy);
    row.button.classList.remove('portal-near');
    if(d<best){candidate=row;best=d;}
   }
   const threshold=Math.max(55,Math.min(stage.clientWidth*.105,100));
   nearest=best<threshold?candidate:null;
   if(nearest){
    nearest.button.classList.add('portal-near');
    hint.textContent='F / ENTER · '+nearest.label;
    if(enter){enter.disabled=false;enter.textContent='ENTRAR · '+nearest.label;}
   }else{
    hint.textContent='WASD / SETAS PARA NADAR · F PARA ENTRAR';
    if(enter){enter.disabled=true;enter.textContent='APROXIME-SE DE UM PORTAL';}
   }
  }
  function enterPortal(){if(menuInteractive()&&nearest&&!nearest.button.disabled&&!nearest.button.hidden)nearest.button.click();}
  function keyName(key){return String(key||'').toLowerCase();}
  function onKeyDown(event){
   if(!menuInteractive()||/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName||''))return;
   const k=keyName(event.key);
   if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){
    keys.add(k);destination=null;event.preventDefault();return;
   }
   if((k==='f'||k==='enter')&&!event.repeat){enterPortal();event.preventDefault();}
  }
  window.addEventListener('keydown',onKeyDown);
  window.addEventListener('keyup',event=>keys.delete(keyName(event.key)));
  window.addEventListener('blur',()=>keys.clear());
  stage.addEventListener('pointerdown',event=>{
   if(!menuInteractive()||event.target.closest('button,a,input,select'))return;
   destination=rectPosition(event.clientX,event.clientY);
  });
  // Touch controls move only the diver. Station buttons remain directly clickable.
  const mobilePad=document.getElementById('menuOceanMobilePad');
  const keyFor={up:'arrowup',down:'arrowdown',left:'arrowleft',right:'arrowright'};
  for(const control of mobilePad?.querySelectorAll('[data-ocean-move]')||[]){
   const key=keyFor[control.dataset.oceanMove];
   control.addEventListener('pointerdown',event=>{event.preventDefault();destination=null;keys.add(key);try{control.setPointerCapture(event.pointerId);}catch(_){ }});
   const release=()=>keys.delete(key);
   control.addEventListener('pointerup',release);control.addEventListener('pointercancel',release);control.addEventListener('lostpointercapture',release);
  }
  enter?.addEventListener('click',enterPortal);
  for(const row of rows)row.button.addEventListener('pointerenter',()=>{if(menuInteractive()&&matchMedia('(pointer:fine)').matches)destination={x:row.x,y:row.y};});
  function frame(now){
   const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
   if(menuInteractive()){
    const mx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    const my=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
    let ax=mx,ay=my;
    if(mx||my)destination=null;
    else if(destination){
     const dx=(destination.x-x)*stage.clientWidth/100,dy=(destination.y-y)*stage.clientHeight/100;
     const distance=Math.hypot(dx,dy);
     if(distance>6){ax=dx/distance;ay=dy/distance;}else destination=null;
    }
    const norm=Math.hypot(ax,ay)||1,baseSpeed=Math.min(260,Math.max(145,stage.clientWidth*.26));
    const desiredVx=ax/norm*baseSpeed,desiredVy=ay/norm*baseSpeed;
    const weight=1-Math.exp(-dt*9);vx+=(desiredVx-vx)*weight;vy+=(desiredVy-vy)*weight;
    x=clamp(x+(vx/Math.max(1,stage.clientWidth))*100*dt,8,92);
    y=clamp(y+(vy/Math.max(1,stage.clientHeight))*100*dt,10,89);
    const moving=Math.hypot(vx,vy)>8;
    diver.classList.toggle('swimming',moving);
    diver.style.setProperty('--diver-x',x+'%');
    diver.style.setProperty('--diver-y',y+'%');
    if(moving)diver.style.setProperty('--swim-angle',Math.atan2(vy,vx)+Math.PI/2+'rad');
    select();
   }else{vx=0;vy=0;keys.clear();}
   requestAnimationFrame(frame);
  }
  diver.style.setProperty('--diver-x',x+'%');diver.style.setProperty('--diver-y',y+'%');
  select();requestAnimationFrame(frame);
  if(canvas)window.dispatchEvent(new CustomEvent('abyssal-menu-specimen-canvas',{detail:{canvas}}));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();