/* Lightweight expedition chart, separate from combat and resource streaming.
 * Only 160 sector flags can be explored; never renders 15x-world scenery into UI.
 */
(function(){
 'use strict';
 const stream=window.AbyssalOceanStream,ecology=window.AbyssalOpenSeaEcology,geo=window.AbyssalOceanGeography;
 if(!stream||!ecology)return;
 const shell=document.getElementById('gameShell');if(!shell)return;
 const trigger=document.createElement('button');trigger.type='button';trigger.id='oceanChartButton';
 trigger.textContent='MAPA · M';trigger.title='Consultar mapa de exploração (M)';
 shell.appendChild(trigger);
 const panel=document.createElement('section');panel.id='oceanChartPanel';panel.hidden=true;
 panel.innerHTML='<header><strong>MAPA DE EXPLORAÇÃO</strong><button id="oceanChartClose" type="button" aria-label="Fechar mapa">×</button></header>'+
 '<canvas id="oceanChartCanvas" width="440" height="250" aria-label="Carta de navegação submarina"></canvas>'+
 '<p id="oceanChartDetails">Descubra regiões ao navegar pelo oceano.</p>';
 shell.appendChild(panel);
 const canvas=panel.querySelector('canvas'),ctx=canvas.getContext('2d');
 let visited=new Set(),lastCell='',lastPaint=0;
 try{visited=new Set(JSON.parse(localStorage.getItem('abyssalVisitedOceanSectors')||'[]'));}catch(_){}
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const current=()=>window.AbyssalGameHooks?.explorationPosition?.();
 function toggle(){if(!current())return;panel.hidden=!panel.hidden;if(!panel.hidden)draw(performance.now());}
 trigger.addEventListener('click',toggle);
 panel.querySelector('#oceanChartClose').addEventListener('click',()=>panel.hidden=true);
 document.addEventListener('keydown',ev=>{
  if((ev.key==='m'||ev.key==='M')&&!ev.repeat&&!ev.target.closest?.('input,textarea,select,[contenteditable]'))toggle();
 });
 function mapOpenSea(p){
  const width=canvas.width,height=canvas.height,margin=20;
  ctx.fillStyle='#051724';ctx.fillRect(0,0,width,height);
  const sx=(width-margin*2)/stream.WIDTH,sy=(height-margin*2)/stream.HEIGHT;
  const drawX=x=>margin+x*sx,drawY=y=>margin+y*sy;
  const columns=Math.ceil(stream.WIDTH/stream.CHUNK),rows=Math.ceil(stream.HEIGHT/stream.CHUNK);
  for(let cy=0;cy<rows;cy++)for(let cx=0;cx<columns;cx++){
   const key=stream.id(cx,cy),x=drawX(cx*stream.CHUNK),y=drawY(cy*stream.CHUNK);
   const w=Math.min(stream.CHUNK,stream.WIDTH-cx*stream.CHUNK)*sx;
   const h=Math.min(stream.CHUNK,stream.HEIGHT-cy*stream.CHUNK)*sy;
   ctx.fillStyle=visited.has(key)?'#164b5a':'#071e2e';ctx.fillRect(x+.7,y+.7,w-1.4,h-1.4);
  }
  if(geo){
   // Cross-section in the exploration chart mirrors the real side-view collision map.
   ctx.fillStyle='rgba(23,52,61,.85)';ctx.strokeStyle='rgba(110,174,173,.55)';ctx.lineWidth=1.2;
   ctx.beginPath();ctx.moveTo(drawX(0),drawY(stream.HEIGHT));
   for(let x=0;x<=stream.WIDTH;x+=110){ctx.lineTo(drawX(x),drawY(geo.floorAt(x)));}
   ctx.lineTo(drawX(stream.WIDTH),drawY(geo.floorAt(stream.WIDTH)));
   ctx.lineTo(drawX(stream.WIDTH),drawY(stream.HEIGHT));ctx.closePath();ctx.fill();ctx.stroke();
   ctx.fillStyle='rgba(96,163,168,.48)';
   for(const r of geo.ROCKS){ctx.beginPath();ctx.ellipse(drawX(r.x),drawY(r.y),Math.max(1,r.rx*sx),Math.max(1,r.ry*sy),0,0,Math.PI*2);ctx.fill();}
   ctx.fillStyle='#8dd2d5';
   for(const cave of geo.CAVES){const entry=cave.nodes[0];ctx.beginPath();ctx.arc(drawX(entry.x),drawY(entry.y),2.2,0,Math.PI*2);ctx.fill();}
  }
  ctx.textAlign='center';ctx.font='9px Inter,Arial,sans-serif';ctx.fillStyle='rgba(160,218,221,.68)';
  for(const [name,x,y] of [['RECIFES',1900,1000],['ALGAS',5000,2500],['ÁGUAS LIVRES',9900,2100],['CÂNIONS',16500,5100],['FOSSA',21700,6800]]){
   ctx.fillText(name,drawX(x),drawY(y));
  }
  ctx.fillStyle='#e9fff3';ctx.strokeStyle='#6ffbe8';ctx.lineWidth=2;
  const px=drawX(p.x),py=drawY(p.y);
  ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+Math.cos(p.angle||0)*18,py+Math.sin(p.angle||0)*18);ctx.stroke();
  const chart=panel.querySelector('#oceanChartDetails');
  const h=ecology.habitatAt(p.x,p.y);
  chart.textContent=h.label+' · Setor '+stream.chunkAt(p.x,p.y).cx+':'+stream.chunkAt(p.x,p.y).cy+
   ' · '+visited.size+'/'+(columns*rows)+' setores explorados · Clique em M para fechar.';
 }
 function mapFossas(p){
  ctx.fillStyle='#071020';ctx.fillRect(0,0,canvas.width,canvas.height);
  const signals=window.AbyssalGameHooks?.riftSonar?.()||[];
  const x0=canvas.width/2,y0=canvas.height/2,r=3000;
  ctx.strokeStyle='#366575';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x0,y0,70,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(x0,y0,140,0,Math.PI*2);ctx.stroke();
  for(const row of signals){
   const x=x0+clamp((row.x-p.x)/r,-1,1)*canvas.width*.41,y=y0+clamp((row.y-p.y)/r,-1,1)*canvas.height*.38;
   ctx.fillStyle=row.type==='anomaly'?'#ff8aa5':'#8fe0d7';ctx.beginPath();ctx.arc(x,y,row.type==='anomaly'?5:3,0,Math.PI*2);ctx.fill();
   ctx.font='10px Inter,Arial,sans-serif';ctx.fillText(String(row.label||row.id).slice(0,26),x+8,y-5);
  }
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x0,y0,5,0,Math.PI*2);ctx.fill();
  panel.querySelector('#oceanChartDetails').textContent='Radar local: '+signals.length+' sinais próximos. Obstáculos e salas fora do alcance permanecem desconhecidos.';
 }
 function draw(now){
  const p=current();trigger.hidden=!p||p.mode==='pvp';
  if(!p||p.mode==='pvp'){panel.hidden=true;lastCell='';return;}
  if(p.mode!=='rift'){
   const key=stream.id(stream.chunkAt(p.x,p.y).cx,stream.chunkAt(p.x,p.y).cy);
   if(key!==lastCell){lastCell=key;visited.add(key);
    try{localStorage.setItem('abyssalVisitedOceanSectors',JSON.stringify([...visited]));}catch(_){}
   }
  }
  if(panel.hidden)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(p.mode==='rift')mapFossas(p);else mapOpenSea(p);
 }
 function loop(now){requestAnimationFrame(loop);if(now-lastPaint<350)return;lastPaint=now;draw(now);}
 requestAnimationFrame(loop);
})();
