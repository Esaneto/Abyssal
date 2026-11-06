/* Deterministic Fossas hazard geometry. Shared by solo renderer and authoritative server.
 * Hazards only exist in the rift map and are intentionally readable before impact.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.AbyssalRiftHardcore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const FINAL_TIER=7,FINAL_KIND='riftSmile',FINAL_CHEST_COINS=100000;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const layoutCache=new Map();
const TYPES=Object.freeze({
  volcano:{name:'VULCÃO ABISSAL',period:9,warning:1.7,active:1.55,radius:100,damage:24,color:'#ff7341'},
  fumarole:{name:'FUMAROLA TÓXICA',period:12,warning:1.6,active:3.1,radius:120,damage:12,color:'#8feb78'},
  rockfall:{name:'DESMORONAMENTO',period:10,warning:1.45,active:.8,radius:95,damage:31,color:'#d2a3a3'},
  tentacle:{name:'TENTÁCULO DA FENDA',period:8.8,warning:1.2,active:.7,radius:82,length:320,damage:29,color:'#b873ff'},
  pressure:{name:'PRESSÃO ESMAGADORA',period:11.6,warning:1.7,active:2.2,radius:140,damage:20,color:'#8bb7ff'},
  spikes:{name:'CORAL FOSSILIZADO',period:8,warning:1.15,active:1.55,radius:108,damage:20,color:'#e48b82'},
  vortex:{name:'VÓRTICE DE SUCÇÃO',period:13,warning:2,active:3.2,radius:155,damage:10,color:'#68a9e5'},
  lure:{name:'ISCA DA MORTE',period:14,warning:1.1,active:1.4,radius:82,damage:25,color:'#71eaff'},
  electric:{name:'ARCO BIOELÉTRICO',period:10.2,warning:1.2,active:1,radius:59,length:300,damage:24,color:'#8bdfff'}
});
const ALLOCATION=Object.freeze({
  shoal:['volcano','spikes'],trench:['fumarole','rockfall'],lantern:['lure','electric'],
  junction:['vortex','pressure'],event:['rockfall','tentacle'],hub:['volcano','pressure'],
  landing:['tentacle','volcano','vortex'],elite:['electric','spikes','tentacle'],
  boss:['tentacle','fumarole','vortex']
});
function idHash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
function build(layout,tier=0){
 if(!layout||!Array.isArray(layout.rooms))return [];
 const safeTier=clamp(Math.floor(Number(tier)||0),0,100);
 const key=String(layout.seed||layout.mapSeed||layout.id||'')+':'+safeTier+':'+layout.rooms.map(r=>r.id+':'+r.x+':'+r.y).join(',');
 if(layoutCache.has(key))return layoutCache.get(key);
 const hazards=[];
 for(const room of layout.rooms){
  if(room.id==='start')continue;
  let choices=ALLOCATION[room.id]||['spikes'];
  if(room.id==='boss'&&safeTier<3)choices=[];
  const count=Math.min(choices.length,safeTier>=4?3:2);
  for(let i=0;i<count;i++){
   const type=choices[(i+Math.floor(safeTier/3))%choices.length],cfg=TYPES[type];
   const theta=(i*2.399963+idHash(room.id+':'+i)%120/120)*Math.PI;
   const radial=room.id==='boss'?.64:.48;
   const x=room.x+Math.cos(theta)*room.rx*radial;
   const y=room.y+Math.sin(theta)*room.ry*radial;
   const angle=(idHash(room.id+':angle:'+i)%628)/100;
   hazards.push({id:room.id+':'+i,type,roomId:room.id,x,y,
    angle,period:cfg.period,warning:cfg.warning,active:cfg.active,
    offset:(idHash(room.id+':timing:'+i+':'+safeTier)%1000)/1000*cfg.period,
    radius:cfg.radius,length:cfg.length||0,damage:Math.round(cfg.damage*(1+Math.min(.9,safeTier*.07)))});
  }
 }
 if(layoutCache.size>16)layoutCache.clear();
 layoutCache.set(key,hazards);
 return hazards;
}
function state(hazard,seconds){
 const period=hazard.period||10;
 const p=((Number(seconds||0)+hazard.offset)%period+period)%period;
 if(p>=period-hazard.active)return {phase:'active',progress:clamp((p-(period-hazard.active))/hazard.active,0,1)};
 if(p>=period-hazard.active-hazard.warning)return {phase:'warning',progress:clamp((p-(period-hazard.active-hazard.warning))/hazard.warning,0,1)};
 return {phase:'idle',progress:0};
}
function segmentDistance(px,py,ax,ay,bx,by){
 const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
 const t=den>0?clamp(((px-ax)*dx+(py-ay)*dy)/den,0,1):0;
 return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
}
function hit(hazard,px,py,pad=0){
 const r=hazard.radius+pad,dx=px-hazard.x,dy=py-hazard.y;
 if(hazard.type==='tentacle'||hazard.type==='electric'){
  const length=hazard.length||300,a=hazard.angle||0;
  return segmentDistance(px,py,hazard.x-Math.cos(a)*length*.45,hazard.y-Math.sin(a)*length*.45,
    hazard.x+Math.cos(a)*length*.55,hazard.y+Math.sin(a)*length*.55)<=r*.5;
 }
 return dx*dx+dy*dy<=r*r;
}
function checkpoint(layout,x,y,previous='start'){
 const room=layout?.rooms?.find(r=>r.id===previous);
 const found=layout?.rooms?.find(r=>((x-r.x)/Math.max(1,r.rx))**2+((y-r.y)/Math.max(1,r.ry))**2<.86);
 const target=found||room||layout?.rooms?.find(r=>r.id==='start');
 if(!target)return {roomId:'start',x,y};
 const offset=target.id==='boss'?Math.min(290,target.ry*.62):Math.min(105,target.ry*.23);
 return {roomId:target.id,x:target.x,y:target.y-offset};
}
function paintShape(c,trap){
 const r=trap.radius;
 if(trap.type==='tentacle'||trap.type==='electric'){
  const a=trap.angle||0,l=trap.length||300;
  c.save();c.translate(trap.x,trap.y);c.rotate(a);
  c.beginPath();c.roundRect(-l*.45,-r*.5,l,r,Math.max(8,r*.43));c.restore();
 }else{
  c.beginPath();c.ellipse(trap.x,trap.y,r,r*.82,0,0,Math.PI*2);
 }
}
function draw(c,hazards,seconds,view){
 if(!Array.isArray(hazards))return;
 for(const h of hazards){
  if(view&&(h.x<view.x-350||h.x>view.x+view.w+350||h.y<view.y-350||h.y>view.y+view.h+350))continue;
  const s=state(h,seconds),cfg=TYPES[h.type];
  c.save();
  const t=Number(seconds||0)*1000;
  const pulse=.5+.5*Math.sin(t*.005+h.offset);
  c.fillStyle='rgba(6,13,26,.65)';c.strokeStyle=cfg.color;c.lineWidth=3;
  if(h.type==='volcano'||h.type==='fumarole'){
   c.fillStyle='#131c23';c.strokeStyle='#59626a';
   c.beginPath();c.ellipse(h.x,h.y,h.radius*.4,h.radius*.27,0,0,Math.PI*2);c.fill();c.stroke();
   c.fillStyle=h.type==='volcano'?'#ff803e':'#a5e7aa';
   c.globalAlpha=.55+pulse*.33;
   c.beginPath();c.ellipse(h.x,h.y,h.radius*.2,h.radius*.11,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
  }else if(h.type==='tentacle'){
   c.strokeStyle='#783c78';c.lineWidth=12;c.beginPath();c.moveTo(h.x-28,h.y-13);c.lineTo(h.x+24,h.y+13);c.stroke();
  }else if(h.type==='electric'){
   for(let i=-1;i<=1;i+=2){const x=h.x+Math.cos(h.angle)*(h.length*.45*i),y=h.y+Math.sin(h.angle)*(h.length*.45*i);c.fillStyle='#25445b';c.beginPath();c.moveTo(x-13,y+12);c.lineTo(x,y-19);c.lineTo(x+14,y+10);c.closePath();c.fill();}
  }else if(h.type==='vortex'){
   for(let i=0;i<3;i++){c.strokeStyle='rgba(104,169,229,.28)';c.lineWidth=3;c.beginPath();c.arc(h.x,h.y,h.radius*(.26+i*.19),t*.00036+i,t*.00036+i+4);c.stroke();}
  }else if(h.type==='lure'){
   c.fillStyle='#d8ffea';c.shadowColor='#8feeff';c.shadowBlur=14;c.beginPath();c.arc(h.x,h.y,5+pulse*3,0,Math.PI*2);c.fill();c.shadowBlur=0;
  }else if(h.type==='spikes'){
   c.strokeStyle='#a66f78';c.lineWidth=3;for(let i=0;i<9;i++){const a=i*6.283/9;c.beginPath();c.moveTo(h.x+Math.cos(a)*13,h.y+Math.sin(a)*13);c.lineTo(h.x+Math.cos(a)*h.radius*.45,h.y+Math.sin(a)*h.radius*.45);c.stroke();}
  }
  c.restore();
  if(s.phase==='idle')continue;
  c.save();
  const warn=s.phase==='warning';
  c.globalAlpha=warn?.19+.12*s.progress:.56;
  c.fillStyle=warn?'#ff2c49':cfg.color;
  c.strokeStyle=warn?'#ff3448':cfg.color;
  c.lineWidth=warn?4:3;
  c.shadowColor=warn?'#ff2548':cfg.color;c.shadowBlur=warn?14:20;
  paintShape(c,h);c.fill();c.globalAlpha=warn?.92:1;c.stroke();
  if(warn){
   c.strokeStyle='rgba(255,195,202,.94)';c.lineWidth=1.5;c.setLineDash([12,7]);paintShape(c,h);c.stroke();c.setLineDash([]);
  }else if(h.type==='volcano'){
   const g=c.createRadialGradient(h.x,h.y,4,h.x,h.y,h.radius*1.15);
   g.addColorStop(0,'rgba(255,251,164,.95)');g.addColorStop(.25,'rgba(255,138,44,.85)');g.addColorStop(1,'rgba(250,45,10,0)');
   c.fillStyle=g;c.globalAlpha=.82;c.beginPath();c.arc(h.x,h.y,h.radius*1.15,0,Math.PI*2);c.fill();
   // Animated volcanic plume and glowing embers, drawn over the crater warning zone.
   const time=t*.003;
   for(let i=0;i<6;i++){
    const a=i*Math.PI/3+time*.14,xx=h.x+Math.cos(a)*h.radius*.34;
    const high=(60+35*Math.sin(time*1.8+i))*Math.min(1,h.radius/90);
    c.beginPath();c.moveTo(xx-16,h.y+12);
    c.quadraticCurveTo(xx-25,h.y-high*.55,xx+Math.sin(time+i)*12,h.y-high);
    c.quadraticCurveTo(xx+22,h.y-high*.40,xx+17,h.y+12);
    c.closePath();c.fillStyle=i%2?'rgba(255,176,44,.82)':'rgba(255,95,18,.88)';c.shadowColor='#ff8d2b';c.shadowBlur=21;c.fill();
   }
   for(let i=0;i<12;i++){const a=i*2.399+time*.6,r=h.radius*(.24+.67*((i*7%13)/13));c.fillStyle=i%2?'#ffd680':'#ff652b';c.beginPath();c.arc(h.x+Math.cos(a)*r,h.y+Math.sin(a)*r,2+((i+Math.floor(time))%4),0,Math.PI*2);c.fill();}
  }else if(h.type==='fumarole'){
   c.save();c.globalAlpha=.52;c.fillStyle='#b6ef81';c.shadowColor='#a9ed83';c.shadowBlur=24;
   for(let i=0;i<8;i++){const a=i*2.4+t*.0005,r=h.radius*(.18+i*.08);c.beginPath();c.arc(h.x+Math.cos(a)*r,h.y+Math.sin(a)*r,19+i*1.7,0,Math.PI*2);c.fill();}
   c.restore();
  }else if(h.type==='pressure'){
   c.strokeStyle='rgba(220,240,255,.78)';c.lineWidth=4;
   for(let i=0;i<3;i++){const q=(i+.5)/3;c.beginPath();c.ellipse(h.x,h.y,h.radius*q,h.radius*q*.82,0,0,Math.PI*2);c.stroke();}
  }else if(h.type==='tentacle'){
   c.strokeStyle='#bd83ef';c.lineWidth=24;c.lineCap='round';
   c.beginPath();const a=h.angle,l=h.length;c.moveTo(h.x-Math.cos(a)*l*.45,h.y-Math.sin(a)*l*.45);
   c.quadraticCurveTo(h.x-Math.sin(a)*16,h.y+Math.cos(a)*16,h.x+Math.cos(a)*l*.55,h.y+Math.sin(a)*l*.55);c.stroke();
   c.strokeStyle='#e9c4ff';c.lineWidth=5;c.stroke();
  }else if(h.type==='electric'){
   c.strokeStyle='#ebffff';c.lineWidth=4;
   c.beginPath();const a=h.angle,l=h.length;
   for(let i=0;i<=12;i++){const q=i/12,offset=Math.sin(t*.02+i*2.4)*18,px=h.x+Math.cos(a)*(q-.45)*l-Math.sin(a)*offset,py=h.y+Math.sin(a)*(q-.45)*l+Math.cos(a)*offset;if(!i)c.moveTo(px,py);else c.lineTo(px,py);}c.stroke();
  }else if(h.type==='vortex'){
   c.strokeStyle='#e6ffff';c.lineWidth=5;
   for(let i=0;i<4;i++){c.beginPath();c.arc(h.x,h.y,(i+1)*h.radius*.19,t*.002+i,t*.002+i+4.3);c.stroke();}
  }else if(h.type==='spikes'){
   c.fillStyle='#f7c2bd';for(let i=0;i<12;i++){const a=i*Math.PI/6,r=h.radius*.72;c.beginPath();c.moveTo(h.x+Math.cos(a)*r,h.y+Math.sin(a)*r);c.lineTo(h.x+Math.cos(a+.16)*(r+26),h.y+Math.sin(a+.16)*(r+26));c.lineTo(h.x+Math.cos(a-.16)*(r+26),h.y+Math.sin(a-.16)*(r+26));c.closePath();c.fill();}
  }else if(h.type==='rockfall'){
   c.fillStyle='#444751';c.strokeStyle='#e0a0a0';c.lineWidth=5;c.beginPath();for(let j=0;j<9;j++){const a=j*Math.PI*2/9,r=h.radius*(.54+.09*Math.sin(j*8));if(!j)c.moveTo(h.x+Math.cos(a)*r,h.y+Math.sin(a)*r);else c.lineTo(h.x+Math.cos(a)*r,h.y+Math.sin(a)*r);}c.closePath();c.fill();c.stroke();
  }
  c.restore();
 }
}
function bossMark(enemy,players,now){
 const valid=(players||[]).filter(p=>p?.alive!==false&&Number.isFinite(Number(p?.x)));
 if(!valid.length)return null;
 valid.sort((a,b)=>Math.hypot(a.x-enemy.x,a.y-enemy.y)-Math.hypot(b.x-enemy.x,b.y-enemy.y));
 const target=valid[0],angle=Math.atan2(target.y-enemy.y,target.x-enemy.x);
 const stage=enemy.hp/enemy.maxHp,sequence=(enemy.riftAttackSerial||0);
 const shape=sequence%3===0?'circle':sequence%3===1?'line':'arc';
 const warning=stage<.25?800:stage<.6?1000:1350;
 return {id:enemy.id+':'+sequence,x:target.x,y:target.y,angle,shape,
   radius:shape==='circle'?108:shape==='line'?58:150,length:shape==='line'?450:0,
   issuedAt:now,hitAt:now+warning,damage:stage<.25?43:stage<.6?37:30};
}
function bossHit(mark,px,py,pad=0){
 if(!mark)return false;
 if(mark.shape==='circle')return Math.hypot(px-mark.x,py-mark.y)<=mark.radius+pad;
 if(mark.shape==='line'){
  const half=mark.length*.5,a=mark.angle;
  return segmentDistance(px,py,mark.x-Math.cos(a)*half,mark.y-Math.sin(a)*half,mark.x+Math.cos(a)*half,mark.y+Math.sin(a)*half)<=mark.radius+pad;
 }
 const dx=px-mark.x,dy=py-mark.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
 return d<=mark.radius+pad&&Math.abs(Math.atan2(Math.sin(a-mark.angle),Math.cos(a-mark.angle)))<=1.02;
}
function drawBossMark(c,mark,now,active=false){
 if(!mark)return;
 const progress=clamp((now-mark.issuedAt)/Math.max(1,mark.hitAt-mark.issuedAt),0,1);
 c.save();c.fillStyle=active?'rgba(190,92,255,.47)':'rgba(255,28,57,'+(.16+.2*progress)+')';
 c.strokeStyle=active?'#d9a3ff':'#ff334f';c.lineWidth=active?9:4;
 c.shadowBlur=active?24:16;c.shadowColor=active?'#af5aff':'#ff273f';
 c.beginPath();
 if(mark.shape==='circle')c.arc(mark.x,mark.y,mark.radius,0,Math.PI*2);
 else if(mark.shape==='line'){
  c.translate(mark.x,mark.y);c.rotate(mark.angle);c.roundRect(-mark.length*.5,-mark.radius,mark.length,mark.radius*2,mark.radius*.55);
 }else{c.moveTo(mark.x,mark.y);c.arc(mark.x,mark.y,mark.radius,mark.angle-1.02,mark.angle+1.02);c.closePath();}
 c.fill();c.stroke();c.restore();
}
function drawFinalBoss(c,enemy,now){
 const x=enemy.x,y=enemy.y,r=enemy.r||140,t=now*.001,pulse=1+Math.sin(t*1.6)*.035;
 c.save();c.translate(x,y);
 // An almost invisible kraken mantle below the arena: translucent, not a regular swimming monster.
 const halo=c.createRadialGradient(0,0,r*.5,0,0,r*4.4);
 halo.addColorStop(0,'rgba(140,50,227,.30)');halo.addColorStop(.4,'rgba(62,26,122,.16)');halo.addColorStop(1,'rgba(31,9,73,0)');
 c.fillStyle=halo;c.beginPath();c.arc(0,0,r*4.4,0,Math.PI*2);c.fill();
 for(let arm=0;arm<8;arm++){
  const a=arm*Math.PI/4+t*.03,end=r*(2.8+(arm%3)*.4);
  c.beginPath();c.moveTo(Math.cos(a)*r*.68,Math.sin(a)*r*.68);
  c.bezierCurveTo(Math.cos(a+.6)*r*2,Math.sin(a+.6)*r*2,Math.cos(a-.3)*r*2.5,Math.sin(a-.3)*r*2.5,Math.cos(a)*end,Math.sin(a)*end);
  c.strokeStyle='rgba(151,72,223,.13)';c.lineWidth=r*.28;c.lineCap='round';c.stroke();
  c.strokeStyle='rgba(204,144,248,.20)';c.lineWidth=r*.07;c.stroke();
 }
 const skin=c.createRadialGradient(-r*.32,-r*.42,r*.04,0,0,r*1.2);
 skin.addColorStop(0,'rgba(240,187,255,.80)');skin.addColorStop(.38,'rgba(163,77,216,.78)');
 skin.addColorStop(.82,'rgba(84,28,156,.66)');skin.addColorStop(1,'rgba(34,13,77,.57)');
 c.shadowBlur=32;c.shadowColor='#a950f1';c.fillStyle=skin;c.strokeStyle='#c894ff';c.lineWidth=5;
 c.beginPath();c.moveTo(-r*.88,-r*.12);
 c.bezierCurveTo(-r*1.22,-r*.95,r*1.13,-r*1.07,r*.94,-r*.16);
 c.bezierCurveTo(r*1.1,r*.88,r*.48,r*1.16,0,r*.98);
 c.bezierCurveTo(-r*.58,r*1.12,-r*1.16,r*.76,-r*.88,-r*.12);
 c.closePath();c.fill();c.stroke();c.shadowBlur=0;
 for(const sign of [-1,1]){
  c.save();c.translate(sign*r*.43,-r*.22);c.rotate(sign*.17);
  c.fillStyle='#180a32';c.beginPath();c.ellipse(0,0,r*.24,r*.29,0,0,Math.PI*2);c.fill();
  c.shadowColor='#f1adff';c.shadowBlur=19;c.fillStyle='#f8dbff';
  c.beginPath();c.ellipse(-sign*r*.035,-r*.03,r*.085,r*.13,0,0,Math.PI*2);c.fill();
  c.restore();
 }
 // An unsettling, broad smile with individually distinct teeth.
 c.fillStyle='#1c072c';c.strokeStyle='#f1b5ff';c.lineWidth=5;
 c.beginPath();c.moveTo(-r*.65,r*.3);c.quadraticCurveTo(0,r*.7,r*.66,r*.29);
 c.quadraticCurveTo(0,r*1.14,-r*.65,r*.3);c.closePath();c.fill();c.stroke();
 c.fillStyle='#f6e0ff';for(let i=0;i<12;i++){const xx=(i-5.5)*r*.105;
  c.beginPath();c.moveTo(xx-r*.038,r*.53);c.lineTo(xx+r*.045,r*.53);c.lineTo(xx,r*(.63+(i%3)*.055));c.closePath();c.fill();
 }
 c.globalAlpha=.7;c.fillStyle='#e9bdff';c.beginPath();c.ellipse(0,-r*.7,r*.48,r*.12,0,0,Math.PI*2);c.fill();
 c.restore();
}
return {FINAL_TIER,FINAL_KIND,FINAL_CHEST_COINS,TYPES,build,state,hit,checkpoint,draw,bossMark,bossHit,drawBossMark,drawFinalBoss};
});