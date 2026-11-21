/* ABYSSAL | Carta da Expedição. Preview cartográfico independente dos modos atuais. */
(function(root){
'use strict';
const W=9600,H=6000,CENTER={x:2400,y:1500,w:4800,h:3000};
const ZONES=[
 {id:'canyons',name:'CÂNIONS ESCUROS',short:'Cânions Escuros',sub:'Paredões e correntes',x:0,y:0,w:2400,h:1500,color:'#28485a',accent:'#5aa3bd',flora:'spires'},
 {id:'gardens',name:'JARDINS LUMINOSOS',short:'Jardins Luminosos',sub:'Vida bioluminescente',x:2400,y:0,w:4800,h:1500,color:'#174954',accent:'#5bdccc',flora:'glow'},
 {id:'corals',name:'FLORESTA CORALINA',short:'Floresta Coralina',sub:'Corais e labirintos',x:7200,y:0,w:2400,h:1500,color:'#4c344b',accent:'#ed8cb3',flora:'coral'},
 {id:'black',name:'RECIFES NEGROS',short:'Recifes Negros',sub:'Rochas e túneis',x:0,y:1500,w:2400,h:3000,color:'#243848',accent:'#94a4bb',flora:'spires'},
 {id:'origin',name:'MAR ORIGINAL',short:'Mar Original',sub:'Submarino / zona segura',x:2400,y:1500,w:4800,h:3000,color:'#164254',accent:'#daae6c',flora:'center'},
 {id:'kelp',name:'FLORESTA DE ALGAS',short:'Floresta de Algas',sub:'Densa vegetação',x:7200,y:1500,w:2400,h:3000,color:'#1e4b43',accent:'#8dd18b',flora:'kelp'},
 {id:'crystals',name:'CRISTAIS ABISSAIS',short:'Cristais Abissais',sub:'Formações brilhantes',x:0,y:4500,w:2400,h:1500,color:'#303d63',accent:'#9ab5ff',flora:'crystal'},
 {id:'hadal',name:'FENDAS HADAIS',short:'Fendas Hadais',sub:'Abismos e predadores',x:2400,y:4500,w:4800,h:1500,color:'#222b48',accent:'#9b87eb',flora:'spires'},
 {id:'vents',name:'FUMAROLAS',short:'Fumarolas',sub:'Fontes térmicas',x:7200,y:4500,w:2400,h:1500,color:'#563c3e',accent:'#e9a26a',flora:'vents'}
];
function rnd(seed){let v=seed>>>0;return ()=>((v=Math.imul(1664525,v)+1013904223>>>0)/4294967296);}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function poly(cx,cy,rx,ry,r,points=12){const v=[];for(let i=0;i<points;i++){let a=i*Math.PI*2/points,rr=.79+r()*.31;v.push([cx+Math.cos(a)*rx*rr,cy+Math.sin(a)*ry*rr]);}return v;}
function makeWorld(){const rocks=[],caves=[],features=[],seed=172907;for(const z of ZONES){const r=rnd(hash(z.id)+seed);if(z.id==='origin')continue;
 for(let i=0;i<21;i++){let x=z.x+130+r()*(z.w-260),y=z.y+100+r()*(z.h-200),rx=55+r()*175,ry=35+r()*108;
  if(Math.abs(x-(z.x+z.w*.5))<310&&Math.abs(y-(z.y+z.h*.5))<260)continue;
  rocks.push({zone:z.id,points:poly(x,y,rx,ry,r,13),x,y,rx,ry});}
 for(let i=0;i<48;i++){features.push({zone:z.id,x:z.x+70+r()*(z.w-140),y:z.y+48+r()*(z.h-100),size:3+r()*17,kind:z.flora,alpha:.25+r()*.55});}
 let cx=z.x+z.w*(.37+r()*.28),cy=z.y+z.h*(.34+r()*.30);let radius=Math.min(z.w,z.h)*(.18+r()*.025);let mouth=Math.atan2(H*.46-cy,W*.5-cx);
 const walls=[];const parts=34;for(let i=0;i<parts;i++){let a=mouth-Math.PI+i*2*Math.PI/parts,b=mouth-Math.PI+(i+1)*2*Math.PI/parts;let mid=(a+b)*.5;if(Math.abs(Math.atan2(Math.sin(mid-mouth),Math.cos(mid-mouth)))<.21)continue;let p=(ang,rad)=>[cx+Math.cos(ang)*rad,cy+Math.sin(ang)*rad];walls.push([p(a,radius*.69),p(b,radius*.69),p(b,radius*1.20),p(a,radius*1.20)]);}
 caves.push({id:'cave-'+z.id,zone:z.id,x:cx,y:cy,r:radius,mouth,wallPolygons:walls,vortex:{x:cx,y:cy}});
 }
 // Preserve classic geometry by generating at its ORIGINAL 4800x3000 dimensions, then only translate its origin.
 const orig=root.AbyssalSoloCavern?.buildRocks?.(4800,3000)||[];
 for(const p of orig){const c=Math.cos(p.angle||0),s=Math.sin(p.angle||0),points=p.vertices.map(v=>[CENTER.x+p.x+v[0]*c-v[1]*s,CENTER.y+p.y+v[0]*s+v[1]*c]);rocks.push({zone:'origin',points,x:CENTER.x+p.x,y:CENTER.y+p.y,rx:p.rx,ry:p.ry,classic:true});}
 return {width:W,height:H,center:CENTER,zones:ZONES,rocks,caves,features,submarine:{x:CENTER.x+2400,y:CENTER.y+1170},sourceRocks:orig.length,seed};
}
const world=makeWorld();
function setup(){const chooser=document.getElementById('abyssalDiveChoicePanel');if(!chooser||document.getElementById('abyssDiveExpeditionChoice'))return;
 const actions=chooser.querySelector('.abyss-dive-choice-actions');if(!actions)return;
 const entry=document.createElement('button');entry.type='button';entry.id='abyssDiveExpeditionChoice';entry.className='abyss-squad-entry';entry.innerHTML='<small class="ds-mode-kicker">03 / NOVO MUNDO</small><strong class="ds-mode-title">EXPEDIÇÃO</strong><span class="ds-mode-copy">Oito biomas, cavernas profundas e um novo oceano para descobrir.</span><span class="ds-mode-cta">Explorar o mapa ›</span>';actions.appendChild(entry);
 const wrap=document.createElement('section');wrap.id='abyssSquadChart';wrap.className='abyss-squad-chart';wrap.hidden=true;wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');wrap.setAttribute('aria-labelledby','squadChartTitle');
 wrap.innerHTML='<div class="squad-chart-shell"><header class="squad-chart-header"><div class="squad-chart-mark">A / 03</div><div class="squad-chart-titles"><small>CARTA BATIMÉTRICA • ESTAÇÃO ABISSAL</small><h2 id="squadChartTitle">MAPA DA EXPEDIÇÃO</h2></div><button type="button" id="squadChartClose" aria-label="Voltar ao menu de mergulho">✕ <span>VOLTAR</span></button></header><div class="squad-chart-main"><div class="squad-chart-map"><canvas id="squadChartCanvas" aria-label="Carta interativa com oito biomas, centro original, rochas e cavernas"></canvas><div class="squad-chart-coordinates">09 REGIÕES <b>•</b> 08 CAVERNAS <b>•</b> SEED 172907</div><div class="squad-chart-controls"><button id="squadChartMinus" aria-label="Afastar mapa">−</button><button id="squadChartReset" aria-label="Recentrar mapa">⌖</button><button id="squadChartPlus" aria-label="Aproximar mapa">+</button></div></div><aside class="squad-chart-sidebar"><small class="squad-chart-eyebrow">REGIÃO SELECIONADA</small><h3 id="squadZoneName">MAR ORIGINAL</h3><p id="squadZoneDesc">Submarino / zona segura</p><div class="squad-chart-divider"></div><div class="squad-chart-label">CARTOGRAFIA INICIAL</div><p>O oceano original permanece no centro. Os oito biomas vizinhos incluem estruturas rochosas, cavernas de entrada única e um vórtice em cada câmara.</p><div class="squad-chart-mini"><span class="squad-pill"><i class="squad-dot"></i> SUBMARINO</span><span class="squad-pill"><i class="squad-dot cave"></i> VÓRTICE</span><span class="squad-pill"><i class="squad-dot rock"></i> ROCHAS</span></div><div class="squad-chart-divider"></div><small class="squad-chart-eyebrow">FASE 1 / CONSTRUÇÃO DO MUNDO</small><p class="squad-chart-note">Carta navegável para visualizar o terreno. A entrada jogável, os bots e as missões serão conectados nas próximas etapas.</p><div class="squad-chart-foot">ARRASTE PARA NAVEGAR · USE A RODA PARA ZOOM</div></aside></div><footer class="squad-chart-footer"><span>ABYSSAL • ECOS DAS PROFUNDEZAS</span><span>EXPEDIÇÃO / PRÉVIA DO MAPA</span></footer></div>';
 document.body.appendChild(wrap);
 const canvas=wrap.querySelector('#squadChartCanvas'),ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return;
 let selected=ZONES[4],scale=1,ox=0,oy=0,drag=null,animate=0,lastFocus=entry;
 const info=()=>{wrap.querySelector('#squadZoneName').textContent=selected.name;wrap.querySelector('#squadZoneDesc').textContent=selected.sub;wrap.style.setProperty('--zone-accent',selected.accent);};
 const cxy=(x,y)=>[ox+x*scale,oy+y*scale];
 function polygon(points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...cxy(p[0],p[1])):ctx.moveTo(...cxy(p[0],p[1])));ctx.closePath();}
 function draw(){if(wrap.hidden)return;const rect=canvas.getBoundingClientRect(),cw=Math.max(300,rect.width),ch=Math.max(220,rect.height),dpr=Math.min(2,window.devicePixelRatio||1);if(canvas.width!==Math.round(cw*dpr)||canvas.height!==Math.round(ch*dpr)){canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#071927';ctx.fillRect(0,0,cw,ch);
 ctx.save();ctx.beginPath();ctx.rect(0,0,cw,ch);ctx.clip();
 // terrain: organic colored bathymetric cells, not a single stock background
 for(const z of ZONES){const [x,y]=cxy(z.x,z.y);let w=z.w*scale,h=z.h*scale;ctx.fillStyle=z.color;ctx.fillRect(x,y,w,h);
  let g=ctx.createRadialGradient(x+w*.52,y+h*.45,0,x+w*.5,y+h*.5,Math.max(w,h)*.70);g.addColorStop(0,z.accent+'25');g.addColorStop(1,'#04121d15');ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
  ctx.strokeStyle='#a6d6e518';ctx.lineWidth=.7;for(let l=1;l<=4;l++){ctx.beginPath();for(let i=0;i<=55;i++){let xx=x+w*i/55,yy=y+h*(l/5)+Math.sin(i*.33+l*1.7)*15*scale+Math.sin(i*.13+l)*20*scale;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}ctx.stroke();}
 }
 // center is a faithful placement of the classic rock geometry; accents remain cartographic
 for(const f of world.features){const z=ZONES.find(z=>z.id===f.zone);if(!z)continue;const [x,y]=cxy(f.x,f.y);if(x<0||x>cw||y<0||y>ch)continue;ctx.strokeStyle=z.accent;ctx.fillStyle=z.accent;ctx.globalAlpha=f.alpha;
 const s=Math.max(.8,f.size*scale);ctx.lineWidth=Math.max(.6,scale*.85);ctx.beginPath();if(f.kind==='kelp'){ctx.moveTo(x,y+s);ctx.quadraticCurveTo(x-s,y,x,y-s);ctx.quadraticCurveTo(x+s,y-s*1.9,x+s*.3,y-s*2.3);ctx.stroke();}else if(f.kind==='crystal'){ctx.moveTo(x,y+s);ctx.lineTo(x-s*.6,y);ctx.lineTo(x,y-s*1.65);ctx.lineTo(x+s*.8,y);ctx.closePath();ctx.fill();}else if(f.kind==='glow'){ctx.arc(x,y,Math.max(1,s*.48),0,Math.PI*2);ctx.fill();}else if(f.kind==='coral'){ctx.moveTo(x,y+s);ctx.lineTo(x,y-s);ctx.moveTo(x,y);ctx.lineTo(x-s,y-s*.6);ctx.moveTo(x,y-s*.3);ctx.lineTo(x+s*.8,y-s*.9);ctx.stroke();}else{ctx.moveTo(x,y+s);ctx.lineTo(x-s*.4,y-s);ctx.lineTo(x+s*.6,y-s*1.6);ctx.stroke();}ctx.globalAlpha=1;}
 for(const r of world.rocks){polygon(r.points);ctx.fillStyle=r.classic?'#112b37':'#132737';ctx.fill();ctx.strokeStyle=r.classic?'#8fb8ad85':'#83c2cf65';ctx.lineWidth=Math.max(.6,1.4*scale);ctx.stroke();}
 for(const cave of world.caves){const [cx,cy]=cxy(cave.x,cave.y),rad=cave.r*scale;ctx.beginPath();ctx.arc(cx,cy,rad*.69,0,Math.PI*2);ctx.fillStyle='#030b17';ctx.fill();ctx.strokeStyle='#56b0c55a';ctx.lineWidth=2;ctx.stroke();for(const p of cave.wallPolygons){polygon(p);ctx.fillStyle='#0d202d';ctx.fill();ctx.strokeStyle='#6898ae8c';ctx.lineWidth=Math.max(.6,1.5*scale);ctx.stroke();}
  if(rad>11){ctx.save();ctx.translate(cx,cy);ctx.strokeStyle='#d39de6bb';ctx.lineWidth=Math.max(1,1.8*scale);for(let j=0;j<3;j++){ctx.beginPath();ctx.arc(0,0,Math.max(3,rad*(.11+j*.1)),j*.68,j*.68+Math.PI*1.65);ctx.stroke();}ctx.restore();}}
 // submarine center
 const [sx,sy]=cxy(world.submarine.x,world.submarine.y);ctx.save();ctx.translate(sx,sy);ctx.shadowBlur=18;ctx.shadowColor='#efcc8c';ctx.fillStyle='#f6d9a5';ctx.beginPath();ctx.ellipse(0,0,Math.max(4,23*scale),Math.max(2,7*scale),0,0,2*Math.PI);ctx.fill();ctx.shadowBlur=0;ctx.restore();
 // label overlays on top of chart terrain
 ctx.textAlign='center';for(const z of ZONES){let[x,y]=cxy(z.x+z.w*.5,z.y+z.h*.5);if(x<-120||x>cw+120||y<-80||y>ch+80)continue;let fs=Math.max(8,Math.min(13,11*scale));ctx.fillStyle=z.id===selected.id?'#fff4d6':'#d3eaf0';ctx.font='600 '+fs+'px system-ui, sans-serif';ctx.shadowColor='#04131b';ctx.shadowBlur=8;ctx.fillText(z.name,x,y-Math.max(5,16*scale),Math.max(70,z.w*scale*.86));ctx.shadowBlur=0;if(z.id===selected.id){ctx.strokeStyle='#e0b978';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,Math.max(4,8*scale),0,Math.PI*2);ctx.stroke();}}
 // chart measurement lines
 ctx.strokeStyle='#cfdfdd19';ctx.lineWidth=.7;for(let k=0;k<=8;k++){let x=ox+k*W*scale/8;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,ch);ctx.stroke();}for(let k=0;k<=6;k++){let y=oy+k*H*scale/6;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(cw,y);ctx.stroke();}
 ctx.restore();ctx.strokeStyle='#c9a7698a';ctx.strokeRect(.5,.5,cw-1,ch-1);
 }
 function fit(){const r=canvas.getBoundingClientRect();scale=Math.min((r.width-26)/W,(r.height-26)/H);ox=(r.width-W*scale)/2;oy=(r.height-H*scale)/2;draw();}
 function zoom(f,clientX,clientY){const r=canvas.getBoundingClientRect(),mx=clientX-r.left,my=clientY-r.top,ns=Math.min(.7,Math.max(.025,scale*f));ox=mx-(mx-ox)*ns/scale;oy=my-(my-oy)*ns/scale;scale=ns;draw();}
 function open(){lastFocus=document.activeElement;chooser.hidden=true;wrap.hidden=false;selected=ZONES[4];info();requestAnimationFrame(()=>{fit();wrap.querySelector('#squadChartClose').focus({preventScroll:true});});}
 function close(){wrap.hidden=true;chooser.hidden=false;requestAnimationFrame(()=>{entry.focus({preventScroll:true});});}
 entry.addEventListener('click',open);wrap.querySelector('#squadChartClose').addEventListener('click',close);wrap.addEventListener('click',e=>{if(e.target===wrap)close();});
 wrap.querySelector('#squadChartReset').addEventListener('click',fit);
 wrap.querySelector('#squadChartPlus').addEventListener('click',()=>{let r=canvas.getBoundingClientRect();zoom(1.32,r.left+r.width/2,r.top+r.height/2);});
 wrap.querySelector('#squadChartMinus').addEventListener('click',()=>{let r=canvas.getBoundingClientRect();zoom(1/1.32,r.left+r.width/2,r.top+r.height/2);});
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.12:1/1.12,e.clientX,e.clientY);},{passive:false});
 canvas.addEventListener('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;let dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved=drag.moved||Math.abs(dx)+Math.abs(dy)>4;ox+=dx;oy+=dy;drag.x=e.clientX;drag.y=e.clientY;draw();});
 canvas.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;if(!drag.moved){let r=canvas.getBoundingClientRect(),px=(e.clientX-r.left-ox)/scale,py=(e.clientY-r.top-oy)/scale;let match=ZONES.find(z=>px>=z.x&&px<z.x+z.w&&py>=z.y&&py<z.y+z.h);if(match){selected=match;info();draw();}}drag=null;});
 document.addEventListener('keydown',e=>{if(wrap.hidden)return;if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Tab'){const buttons=[...wrap.querySelectorAll('button')];if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[buttons.length-1].focus();}else if(!e.shiftKey&&document.activeElement===buttons[buttons.length-1]){e.preventDefault();buttons[0].focus();}}});
 window.addEventListener('resize',()=>{if(!wrap.hidden)fit();});
 root.AbyssalSquadExpedition={world,open,close,draw,fit};
}
root.AbyssalSquadMapWorld=world;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})(typeof window!=='undefined'?window:globalThis);