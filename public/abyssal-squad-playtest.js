/* ABYSSAL: playable expedition terrain validation, separate from Solo and Online.
 * No multiplayer rooms, purchases, persistent rewards or account mutations. */
(function(root){
'use strict';
function init(){
 const world=root.AbyssalSquadMapWorld,P=root.AbyssalSquadPhysics;
 const chart=document.getElementById('abyssSquadChart');
 if(!world||!P||!chart||document.getElementById('squadPlaytest'))return;
 const entry=document.createElement('button');entry.id='squadMapEnterWorld';entry.type='button';entry.textContent='EXPLORAR TERRENO';
 chart.querySelector('.squad-chart-footer')?.prepend(entry);
 // Show per-biome danger and boss data in the cartographic panel.
 const dangerLine=document.createElement('p');dangerLine.id='squadChartDanger';dangerLine.className='squad-chart-danger';
 chart.querySelector('#squadZoneDesc')?.insertAdjacentElement('afterend',dangerLine);
 const updateDanger=()=>{const name=chart.querySelector('#squadZoneName')?.textContent;const zone=world.zones.find(z=>z.name===name);const data=zone&&P.DIFFICULTY[zone.id];dangerLine.textContent=data?'PERIGO '+data.tier+' · BOSS: '+data.bossName.toUpperCase()+(zone.id==='crystals'?' · 8 ARMADILHAS DE TENTÁCULO':''):'PONTO DE PARTIDA / SUBMARINO';};
 new MutationObserver(updateDanger).observe(chart.querySelector('#squadZoneName'),{childList:true,characterData:true,subtree:true});updateDanger();
 const scene=document.createElement('section');scene.id='squadPlaytest';scene.hidden=true;scene.setAttribute('aria-label','Mapa jogável da Expedição');
 scene.innerHTML='<header class="squad-play-head"><div><span class="squad-play-kicker">ABYSSAL / EXPEDIÇÃO / TESTE DE TERRENO</span><strong id="squadPlayZone">MAR ORIGINAL</strong></div><div class="squad-play-meters"><span id="squadPlayHealth">VIDA 100/100</span><span id="squadPlayRisk">PERIGO 0</span><span id="squadPlayBoss">EXPLORANDO</span></div><button type="button" id="squadPlayReturn">VOLTAR AO MAPA</button></header><canvas id="squadPlayCanvas" aria-label="Mapa explorável com rochas, cavernas, perigos e chefes"></canvas><div class="squad-play-hint">WASD / SETAS: MOVER · MOUSE / ESPAÇO: ATACAR · E: LANTERNA · M: MAPA</div><div class="squad-play-pad"><button data-x="0" data-y="-1" aria-label="Nadar para cima">▲</button><div><button data-x="-1" data-y="0" aria-label="Nadar para a esquerda">◀</button><button data-x="0" data-y="1" aria-label="Nadar para baixo">▼</button><button data-x="1" data-y="0" aria-label="Nadar para a direita">▶</button></div></div><button id="squadPlayFire" type="button" aria-label="Atacar">ATACAR</button><div id="squadPlayNotice" role="status" aria-live="polite"></div>';
 document.body.appendChild(scene);
 const canvas=scene.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return;
 const encounters=P.createEncounters(world).map(e=>({...e,maxHp:e.hp,spawnX:e.x,spawnY:e.y,alive:true,alertUntil:0,respawnAt:0,attackAt:0}));
 const traps=encounters.flatMap(e=>e.traps.map(t=>({...t,owner:e})));
 const orig=world.submarine,player={x:orig.x,y:orig.y,hp:100,lastHit:0,aim:0,light:true,lastShot:0};
 let playing=false,raf=0,last=0,elapsed=0,w=900,h=540,dpr=1,zoom=1,camX=0,camY=0,shot=null,noticeUntil=0;
 const pressed=new Set(),touch=new Map(),zones=Object.fromEntries(world.zones.map(z=>[z.id,z]));
 const flash=text=>{noticeUntil=elapsed+4;scene.querySelector('#squadPlayNotice').textContent=text;};
 function resize(){const box=canvas.getBoundingClientRect();w=Math.max(320,box.width);h=Math.max(240,box.height);dpr=Math.min(2,root.devicePixelRatio||1);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}zoom=w<700?.94:1.04;}
 const sx=x=>(x-camX)*zoom,sy=y=>(y-camY)*zoom;
 function within(x,y,r=0){return sx(x)+r*zoom>=0&&sx(x)-r*zoom<=w&&sy(y)+r*zoom>=0&&sy(y)-r*zoom<=h;}
 function poly(p){ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));ctx.closePath();}
 function circle(x,y,r){ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),0,Math.PI*2);}
 function moveInput(){let mx=0,my=0;if(pressed.has('w')||pressed.has('arrowup'))my--;if(pressed.has('s')||pressed.has('arrowdown'))my++;if(pressed.has('a')||pressed.has('arrowleft'))mx--;if(pressed.has('d')||pressed.has('arrowright'))mx++;for(const v of touch.values()){mx+=v.x;my+=v.y;}const n=Math.hypot(mx,my)||1;return {x:mx/n,y:my/n};}
 function damage(n){if(elapsed-player.lastHit<.8)return;player.hp=Math.max(0,player.hp-n);player.lastHit=elapsed;if(player.hp<=0){player.hp=100;player.x=orig.x;player.y=orig.y;flash('Mergulhador recuperado na região inicial. Nenhuma recompensa é alterada.');}}
 function fire(){if(elapsed-player.lastShot<.28)return;player.lastShot=elapsed;
  let target=null,dist=Infinity;for(const e of encounters){if(!e.alive)continue;const d=Math.hypot(player.x-e.x,player.y-e.y);if(d<440&&d<dist&&P.visible(world,player.x,player.y,e.x,e.y)){target=e;dist=d;}}
  if(!target){shot={x:player.x,y:player.y,toX:player.x+Math.cos(player.aim)*190,toY:player.y+Math.sin(player.aim)*190,until:elapsed+.13};return;}
  target.hp-=18;shot={x:player.x,y:player.y,toX:target.x,toY:target.y,until:elapsed+.16};player.aim=Math.atan2(target.y-player.y,target.x-player.x);
  if(target.hp<=0){target.alive=false;target.respawnAt=elapsed+300;flash(target.bossName+' derrotado. Retorno ao vórtice em cinco minutos.');}
 }
 function update(dt){elapsed+=dt;const m=moveInput(),speed=270,step=P.move(world,player.x,player.y,m.x*dt*speed,m.y*dt*speed,15);player.x=step.x;player.y=step.y;if(m.x||m.y)player.aim=Math.atan2(m.y,m.x);
  if(pressed.has(' ')||pressed.has('f'))fire();
  for(const enemy of encounters){if(!enemy.alive){if(elapsed>=enemy.respawnAt){enemy.hp=enemy.maxHp;enemy.x=enemy.spawnX;enemy.y=enemy.spawnY;enemy.alive=true;enemy.alertUntil=0;}else continue;}
   const cave=world.caves.find(c=>c.id===enemy.id),dist=Math.hypot(player.x-enemy.x,player.y-enemy.y);
   if(dist<325&&P.visible(world,enemy.x,enemy.y,player.x,player.y))enemy.alertUntil=elapsed+2;
   if(elapsed<enemy.alertUntil&&dist>enemy.r+24&&dist<cave.r*.88){const dx=(player.x-enemy.x)/(dist||1),dy=(player.y-enemy.y)/(dist||1);const p=P.move(world,enemy.x,enemy.y,dx*dt*(22+enemy.tier*9),dy*dt*(22+enemy.tier*9),enemy.r*.65);if(Math.hypot(p.x-cave.x,p.y-cave.y)<cave.r*.59){enemy.x=p.x;enemy.y=p.y;}}
   if(elapsed<enemy.alertUntil&&dist<enemy.r+26&&elapsed>=enemy.attackAt){enemy.attackAt=elapsed+1.2;damage(7+enemy.tier*5);}
  }
  for(const t of traps){if(!t.owner.alive||Math.hypot(t.x-player.x,t.y-player.y)>t.radius+14)continue;if(P.trapState(t,elapsed)==='active'&&elapsed-player.lastHit>1.1)damage(19);}
  if(shot&&elapsed>shot.until)shot=null;if(elapsed>noticeUntil)scene.querySelector('#squadPlayNotice').textContent='';
  const zone=P.zoneAt(world,player.x,player.y),risk=zone?.id==='origin'?0:P.DIFFICULTY[zone.id]?.tier||0;
  scene.querySelector('#squadPlayZone').textContent=zone?.name||'MAR INEXPLORADO';scene.querySelector('#squadPlayRisk').textContent='PERIGO '+risk;scene.querySelector('#squadPlayHealth').textContent='VIDA '+Math.ceil(player.hp)+'/100';
  const nearest=encounters.find(e=>Math.hypot(player.x-e.x,player.y-e.y)<(world.caves.find(c=>c.id===e.id)?.r||250)*1.2);
  scene.querySelector('#squadPlayBoss').textContent=nearest?(nearest.alive?'BOSS: '+nearest.bossName.toUpperCase():'BOSS DERROTADO'):'EXPLORANDO';
 }
 function draw(){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#03121f';ctx.fillRect(0,0,w,h);
  camX=Math.max(0,Math.min(world.width-w/zoom,player.x-w/(2*zoom)));camY=Math.max(0,Math.min(world.height-h/zoom,player.y-h/(2*zoom)));
  const gx=ctx.createLinearGradient(0,0,0,h);gx.addColorStop(0,'#051b29');gx.addColorStop(1,'#030d17');ctx.fillStyle=gx;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(-camX*zoom,-camY*zoom);ctx.scale(zoom,zoom);
  for(const z of world.zones){if(z.x+z.w<camX||z.y+z.h<camY||z.x>camX+w/zoom||z.y>camY+h/zoom)continue;
   ctx.fillStyle=z.color;ctx.globalAlpha=.3;ctx.fillRect(z.x,z.y,z.w,z.h);ctx.globalAlpha=1;
   const g=ctx.createRadialGradient(z.x+z.w*.5,z.y+z.h*.5,10,z.x+z.w*.5,z.y+z.h*.5,Math.max(z.w,z.h)*.7);g.addColorStop(0,z.accent+'24');g.addColorStop(1,'#06121e00');ctx.fillStyle=g;ctx.fillRect(z.x,z.y,z.w,z.h);}
  for(const cave of world.caves){if(!within(cave.x,cave.y,cave.r*1.6))continue;let g=ctx.createRadialGradient(cave.x,cave.y,20,cave.x,cave.y,cave.r*.74);g.addColorStop(0,cave.zone==='crystals'?'#260b43':'#07121d');g.addColorStop(1,'#030911');ctx.fillStyle=g;circle(cave.x,cave.y,cave.r*.85);ctx.fill();}
  for(const f of world.features){if(!within(f.x,f.y,30))continue;const z=zones[f.zone];ctx.strokeStyle=z.accent+'99';ctx.fillStyle=z.accent+'55';ctx.lineWidth=2;const s=Math.min(25,Math.max(4,f.size));
   if(f.kind==='glow'){circle(f.x,f.y,s*.45);ctx.fill();}else if(f.kind==='crystal'){poly([[f.x-s*.4,f.y+s],[f.x,f.y-s],[f.x+s*.4,f.y+s]]);ctx.fill();}else if(f.kind==='kelp'){ctx.beginPath();ctx.moveTo(f.x,f.y+s);ctx.quadraticCurveTo(f.x+s,f.y,f.x,f.y-s);ctx.stroke();}else{ctx.beginPath();ctx.moveTo(f.x,f.y+s);ctx.lineTo(f.x,f.y-s);ctx.moveTo(f.x,f.y);ctx.lineTo(f.x-s*.4,f.y-s*.4);ctx.moveTo(f.x,f.y);ctx.lineTo(f.x+s*.4,f.y-s*.4);ctx.stroke();}}
  for(const r of P.obstacles(world)){if(r.maxX<camX-40||r.maxY<camY-40||r.minX>camX+w/zoom+40||r.minY>camY+h/zoom+40)continue;poly(r.p);ctx.fillStyle='#0b1e2a';ctx.fill();ctx.strokeStyle='#557d86';ctx.lineWidth=2;ctx.stroke();}
  for(const e of encounters){if(!within(e.x,e.y,160)||!e.alive)continue;const z=zones[e.zone];if(e.zone==='crystals'&&root.AbyssalRiftHardcore?.drawFinalBoss){root.AbyssalRiftHardcore.drawFinalBoss(ctx,{x:e.x,y:e.y,r:e.r},elapsed*1000);}
   else {ctx.save();ctx.shadowBlur=20;ctx.shadowColor=z.accent;ctx.fillStyle='#071323';ctx.strokeStyle=z.accent;ctx.lineWidth=3;circle(e.x,e.y,e.r);ctx.fill();ctx.stroke();ctx.restore();ctx.fillStyle='#e4edf1';circle(e.x-e.r*.2,e.y-e.r*.12,3);ctx.fill();circle(e.x+e.r*.2,e.y-e.r*.12,3);ctx.fill();}
   const bw=Math.max(70,e.r*2);ctx.fillStyle='#300e1b';ctx.fillRect(e.x-bw/2,e.y-e.r-24,bw,6);ctx.fillStyle=z.accent;ctx.fillRect(e.x-bw/2,e.y-e.r-24,bw*(e.hp/e.maxHp),6);}
  for(const t of traps){if(!within(t.x,t.y,150)||!t.owner.alive)continue;const state=P.trapState(t,elapsed);ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.index*Math.PI/4);ctx.strokeStyle=state==='active'?'#fa5d9a':state==='warning'?'#f9a1e5':'#54375e';ctx.lineWidth=state==='active'?9:5;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(25*Math.sin(elapsed*2),-24,22,20,65,4);ctx.stroke();ctx.strokeStyle='#e1abff';circle(0,0,9);ctx.stroke();ctx.restore();}
  ctx.save();ctx.shadowBlur=14;ctx.shadowColor='#64ebf7';ctx.strokeStyle='#a9faff';ctx.fillStyle='#072b3b';ctx.lineWidth=3;circle(player.x,player.y,15);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(player.x,player.y);ctx.lineTo(player.x+Math.cos(player.aim)*24,player.y+Math.sin(player.aim)*24);ctx.stroke();ctx.restore();
  if(shot){ctx.strokeStyle='#c5f6ff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(shot.x,shot.y);ctx.lineTo(shot.toX,shot.toY);ctx.stroke();}ctx.restore();
  if(world.caves.some(c=>Math.hypot(player.x-c.x,player.y-c.y)<c.r*.82)){ctx.save();ctx.fillStyle='rgba(0,3,10,.80)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='destination-out';const px=sx(player.x),py=sy(player.y),rad=player.light?225:55;const gr=ctx.createRadialGradient(px,py,8,px,py,rad);gr.addColorStop(0,'#000');gr.addColorStop(1,'#0000');ctx.fillStyle=gr;circle(px,py,rad);ctx.fill();ctx.restore();}
  const mx=w-132,my=93,mw=116,mh=72;ctx.fillStyle='#03131ee5';ctx.fillRect(mx,my,mw,mh);ctx.strokeStyle='#6bc4cf';ctx.strokeRect(mx,my,mw,mh);
  for(const z of world.zones){ctx.fillStyle=z.accent+'60';ctx.fillRect(mx+z.x/world.width*mw,my+z.y/world.height*mh,z.w/world.width*mw,z.h/world.height*mh);}
  ctx.fillStyle='#f8dca1';circle(mx+player.x/world.width*mw,my+player.y/world.height*mh,3.5);ctx.fill();
 }
 function loop(now){if(!playing)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000||0));last=now;update(dt);draw();raf=requestAnimationFrame(loop);}
 function start(){chart.hidden=true;scene.hidden=false;playing=true;player.x=orig.x;player.y=orig.y;player.hp=100;elapsed=0;last=performance.now();resize();flash('Mapa jogável em desenvolvimento. Explore os biomas e teste as colisões.');raf=requestAnimationFrame(loop);scene.querySelector('#squadPlayReturn').focus({preventScroll:true});}
 function stop(){playing=false;cancelAnimationFrame(raf);pressed.clear();touch.clear();scene.hidden=true;chart.hidden=false;root.AbyssalSquadExpedition?.fit?.();entry.focus({preventScroll:true});}
 entry.addEventListener('click',start);scene.querySelector('#squadPlayReturn').addEventListener('click',stop);
 document.addEventListener('keydown',e=>{if(!playing||e.target?.matches?.('input,textarea,select'))return;const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','f','e','m','escape'].includes(k)){e.preventDefault();if(k==='escape'||k==='m'){stop();return;}if(k==='e'&&!e.repeat){player.light=!player.light;return;}pressed.add(k);}});
 document.addEventListener('keyup',e=>pressed.delete(e.key.toLowerCase()));root.addEventListener('blur',()=>pressed.clear());root.addEventListener('resize',()=>{if(playing)resize();});
 canvas.addEventListener('pointerdown',e=>{if(!playing)return;const r=canvas.getBoundingClientRect();player.aim=Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2);fire();});
 for(const b of scene.querySelectorAll('.squad-play-pad button')){b.addEventListener('pointerdown',e=>{e.preventDefault();touch.set(e.pointerId,{x:+b.dataset.x,y:+b.dataset.y});b.setPointerCapture(e.pointerId);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,e=>touch.delete(e.pointerId));}
 const attack=scene.querySelector('#squadPlayFire');attack.addEventListener('pointerdown',e=>{e.preventDefault();fire();pressed.add('f');});for(const ev of ['pointerup','pointercancel','lostpointercapture'])attack.addEventListener(ev,()=>pressed.delete('f'));
 root.AbyssalSquadPlaytest={start,stop,world,encounters};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);