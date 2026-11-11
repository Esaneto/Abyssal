/* Abyssal sonar navigator. Samples the exact shared collision geometry,
 * never invents visual-only obstacles. Local view is bounded for performance. */
(function(){
 'use strict';
 const geo=window.AbyssalOceanGeography;
 const shell=document.getElementById('gameShell');
 if(!geo||!shell||typeof geo.isSolid!=='function')return;
 const root=document.createElement('aside');
 root.id='abyssalSonarShell';
 root.setAttribute('aria-label','Minimapa do Mar Aberto');
 root.innerHTML='<div id="abyssalMiniMap" role="group" aria-label="Sonar de terreno e colisões"><div class="abyss-sonar-head"><span>SONAR / TERRENO</span><span class="abyss-sonar-status">● ATIVO</span></div><canvas width="240" height="152" aria-label="Água em azul e obstáculos sólidos em roxo, com posição do mergulhador no centro"></canvas><div class="abyss-sonar-footer"><span>ÁGUA</span><span>ROCHAS SÓLIDAS</span><span id="abyssalSonarCoords">0, 0</span></div></div><button id="abyssalHudToggle" type="button" aria-label="Ocultar interface de exploração" aria-expanded="true" title="Mostrar ou ocultar toda a interface">⌃</button>';
 shell.appendChild(root);
 const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:false});
 const button=root.querySelector('#abyssalHudToggle'),coords=root.querySelector('#abyssalSonarCoords');
 if(!ctx)return;
 const W=canvas.width,H=canvas.height,SW=72,SH=44;
 let visible=false,folded=false,lastX=Infinity,lastY=Infinity,lastDraw=0;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function fold(value){
  folded=Boolean(value);
  document.body.classList.toggle('abyss-hud-folded',folded&&visible);
  button.textContent=folded?'⌄':'⌃';
  button.setAttribute('aria-expanded',String(!folded));
  button.setAttribute('aria-label',folded?'Mostrar interface de exploração':'Ocultar interface de exploração');
  button.title=folded?'Mostrar interface':'Ocultar interface';
 }
 button.addEventListener('click',()=>fold(!folded));
 function render(p){
  const spanX=2600,spanY=1700;
  const left=clamp(p.x-spanX/2,0,Math.max(0,geo.WIDTH-spanX));
  const top=clamp(p.y-spanY/2,0,Math.max(0,geo.HEIGHT-spanY));
  const cw=W/SW,ch=H/SH;
  const sea=ctx.createLinearGradient(0,0,0,H);
  sea.addColorStop(0,'#0d678b');sea.addColorStop(.5,'#124b76');sea.addColorStop(1,'#091e43');
  ctx.fillStyle=sea;ctx.fillRect(0,0,W,H);
  // Row-run rasterization avoids expensive per-pixel canvas calls.
  ctx.fillStyle='#4a4269';
  for(let j=0;j<SH;j++){
   const y=top+(j+.5)*spanY/SH;
   let start=-1;
   for(let i=0;i<=SW;i++){
    const solid=i<SW&&geo.isSolid(left+(i+.5)*spanX/SW,y,8);
    if(solid&&start<0)start=i;
    if(!solid&&start>=0){
     ctx.fillRect(start*cw,j*ch,(i-start)*cw+0.3,ch+0.3);
     start=-1;
    }
   }
  }
  ctx.strokeStyle='rgba(102,216,248,.10)';ctx.lineWidth=1;
  for(let i=1;i<6;i++){const x=i*W/6;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let j=1;j<4;j++){const y=j*H/4;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  const x=(p.x-left)*W/spanX,y=(p.y-top)*H/spanY;
  ctx.fillStyle='rgba(4,13,28,.45)';ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#ffbe63';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#fff3cf';ctx.beginPath();ctx.arc(x,y,2.8,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#adf8ff';ctx.font='bold 10px sans-serif';ctx.fillText('N',W-17,13);
  ctx.strokeStyle='#aaf2fd';ctx.strokeRect(.5,.5,W-1,H-1);
  coords.textContent=Math.round(p.x)+' / '+Math.round(p.y);
 }
 function update(time){
  const p=window.AbyssalGameHooks?.explorationPosition?.();
  const active=p?.mode==='open-sea'&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  if(active!==visible){
   visible=active;root.hidden=!active;
   if(!active)fold(false);
  }
  if(!active)return;
  if(folded)return;
  if(time-lastDraw<370&&Math.hypot(p.x-lastX,p.y-lastY)<65)return;
  lastX=p.x;lastY=p.y;lastDraw=time;render(p);
 }
 root.hidden=true;
 // Avoid a perpetual 60fps raster job; the sonar only needs an update as the
 // diver changes sector, while animation continues at the game's own rate.
 window.setInterval(()=>update(performance.now()),230);
 window.AbyssalSonarMiniMap=Object.freeze({setFolded:fold,render});
})();
