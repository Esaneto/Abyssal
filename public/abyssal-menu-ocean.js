(function(){
 'use strict';
 const PORTALS={
  playBtn:{x:50,y:22,tone:'cyan',label:'MERGULHO SOLO'},
  onlineBtn:{x:76,y:31,tone:'teal',label:'ONLINE'},
  riftPortalBtn:{x:86,y:64,tone:'rift',label:'FOSSAS'},
  shopBtn:{x:66,y:76,tone:'gold',label:'ESPÉCIMES'},
  profileBtn:{x:34,y:76,tone:'violet',label:'PERFIL'},
  resonanceBtn:{x:18,y:60,tone:'blue',label:'RESSONÂNCIA'},
  rankingsBtn:{x:22,y:34,tone:'ice',label:'RANKING'},
  wheelBtn:{x:50,y:84,tone:'rose',label:'ROLETA'},
  catalogBtn:{x:10,y:45,tone:'slate',label:'ABYSSARIO'},
  cardumesBtn:{x:90,y:43,tone:'green',label:'CARDUMES'},
  matchHistoryBtn:{x:12,y:78,tone:'slate',label:'HISTÓRICO'},
  supportBtn:{x:88,y:80,tone:'slate',label:'SUPORTE'}
 };
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function boot(){
  const menu=document.getElementById('menuScreen');if(!menu||menu.dataset.oceanReady)return;
  menu.dataset.oceanReady='1';menu.classList.add('ocean-menu');
  const stage=document.createElement('div');stage.className='ocean-menu-stage';stage.setAttribute('aria-hidden','true');
  stage.innerHTML='<div class="ocean-caustics"></div><div class="ocean-depth-glow"></div><div id="menuOceanDiver" class="menu-ocean-diver"><span class="diver-pack"></span><span class="diver-body"></span><span class="diver-visor"></span><span class="diver-arm arm-a"></span><span class="diver-arm arm-b"></span><span class="diver-leg leg-a"></span><span class="diver-leg leg-b"></span><canvas id="menuOceanSpecimen" width="140" height="90"></canvas></div><div id="menuOceanHint" class="menu-ocean-hint">NADE ATÉ UM PORTAL · F / ENTER PARA ENTRAR</div>';
  menu.prepend(stage);
  const diver=stage.querySelector('#menuOceanDiver'),hint=stage.querySelector('#menuOceanHint'),specimenCanvas=stage.querySelector('#menuOceanSpecimen');
  const buttons=[];
  for(const [id,cfg] of Object.entries(PORTALS)){
   const b=document.getElementById(id);if(!b||!menu.contains(b))continue;
   b.classList.add('ocean-portal');b.dataset.portalTone=cfg.tone;b.dataset.portalLabel=cfg.label;
   b.style.setProperty('--portal-x',cfg.x+'%');b.style.setProperty('--portal-y',cfg.y+'%');
   buttons.push({b,cfg});
  }
  const rift=document.getElementById('riftPortalBtn');
  rift?.addEventListener('click',()=>{
   window.AbyssalPreferredRoomMode='rift';
   const online=document.getElementById('onlineBtn');if(!online)return;
   online.click();
   setTimeout(()=>{const mode=document.getElementById('roomModeInput');if(mode){mode.value='rift';mode.dispatchEvent(new Event('change',{bubbles:true}));}},0);
  });
  document.getElementById('onlineBtn')?.addEventListener('click',event=>{if(event.isTrusted)window.AbyssalPreferredRoomMode='coop';});
  let x=50,y=52,vx=0,vy=0,target=null,nearest=null,last=performance.now(),active=true;
  const keys=new Set();
  function setPos(){diver.style.setProperty('--diver-x',x+'%');diver.style.setProperty('--diver-y',y+'%');}
  function updateNearest(){
   let best=null,bd=Infinity;
   for(const row of buttons){const dx=row.cfg.x-x,dy=row.cfg.y-y,d=Math.hypot(dx,dy);row.b.classList.remove('portal-near');if(d<bd){bd=d;best=row;}}
   nearest=bd<11?best:null;
   if(nearest){nearest.b.classList.add('portal-near');hint.textContent='F / ENTER · '+nearest.cfg.label;}
   else hint.textContent='NADE ATÉ UM PORTAL · F / ENTER PARA ENTRAR';
  }
  function activateNearest(){if(nearest&&!nearest.b.disabled&&!nearest.b.hidden)nearest.b.click();}
  window.addEventListener('keydown',e=>{
   if(menu.hidden||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName||''))return;
   if(['w','a','s','d','W','A','S','D','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){keys.add(e.key.toLowerCase());e.preventDefault();}
   if((e.key==='f'||e.key==='F'||e.key==='Enter')&&!e.repeat){activateNearest();e.preventDefault();}
  });
  window.addEventListener('keyup',e=>keys.delete(String(e.key||'').toLowerCase()));
  stage.addEventListener('pointerdown',e=>{
   if(e.target.closest?.('button,a,input,select'))return;
   const r=stage.getBoundingClientRect();target={x:clamp((e.clientX-r.left)/r.width*100,5,95),y:clamp((e.clientY-r.top)/r.height*100,10,90)};
  });
  for(const row of buttons)row.b.addEventListener('pointerenter',()=>{target={x:row.cfg.x,y:row.cfg.y};});
  function frame(now){
   const dt=Math.min(.05,(now-last)/1000||0);last=now;active=!menu.hidden;
   if(active){
    let mx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
    let my=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
    if(!mx&&!my&&target){const dx=target.x-x,dy=target.y-y,d=Math.hypot(dx,dy);if(d>.7){mx=dx/d;my=dy/d}else target=null;}
    const mag=Math.hypot(mx,my)||1,speed=21;vx+=(mx/mag*speed-vx)*Math.min(1,dt*6);vy+=(my/mag*speed-vy)*Math.min(1,dt*6);
    if(!mx&&!my){vx*=Math.pow(.03,dt);vy*=Math.pow(.03,dt);}
    x=clamp(x+vx*dt,5,95);y=clamp(y+vy*dt,10,91);
    diver.classList.toggle('swimming',Math.hypot(vx,vy)>1);diver.style.setProperty('--swim-angle',Math.atan2(vy,vx)+'rad');setPos();updateNearest();
   }
   requestAnimationFrame(frame);
  }
  setPos();updateNearest();requestAnimationFrame(frame);
  window.dispatchEvent(new CustomEvent('abyssal-menu-specimen-canvas',{detail:{canvas:specimenCanvas}}));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();