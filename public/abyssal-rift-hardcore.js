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
function wallMount(room,tag){
 const theta=(idHash(room.id+':wall:'+tag)%6283)/1000;
 const bx=room.x+Math.cos(theta)*room.rx*.94,by=room.y+Math.sin(theta)*room.ry*.94;
 const angle=Math.atan2(room.y-by,room.x-bx);
 return {sourceX:bx,sourceY:by,angle};
}
function hazardAtCycle(h,cycle=0){
 if(h.type!=='tentacle')return h;
 // The rift's arms strike a slightly different place every cycle. The cycle
 // is derived from shared simulation time, so every client sees the SAME mark.
 const jx=(idHash(h.id+':tentacle-x:'+cycle)%1000)/1000-.5;
 const jy=(idHash(h.id+':tentacle-y:'+cycle)%1000)/1000-.5;
 return {...h,x:h.x+jx*62,y:h.y+jy*62,angle:h.angle+jx*.36};
}
function build(layout,tier=0){
 if(!layout||!Array.isArray(layout.rooms))return [];
 const safeTier=clamp(Math.floor(Number(tier)||0),0,100);
 const key=String(layout.seed||layout.mapSeed||layout.id||'')+':'+safeTier+':'+layout.rooms.map(r=>r.id+':'+r.x+':'+r.y).join(',');
 if(layoutCache.has(key))return layoutCache.get(key);
 const hazards=[];
 function add(h,type,roomId,index){
  const cfg=TYPES[type];
  hazards.push({...h,id:roomId+':'+index,type,roomId,
   period:cfg.period,warning:cfg.warning,active:cfg.active,
   offset:(idHash(roomId+':timing:'+index+':'+safeTier)%1000)/1000*cfg.period,
   radius:cfg.radius,length:h.length||cfg.length||0,
   damage:Math.round(cfg.damage*(1+Math.min(.9,safeTier*.07)))});
 }
 for(const room of layout.rooms){
  if(room.id==='start')continue;
  const choices=ALLOCATION[room.id]||['spikes'];
  if(room.id==='boss'&&safeTier<3)continue;
  const count=Math.min(choices.length,safeTier>=4?3:2);
  for(let i=0;i<count;i++){
   const type=choices[(i+Math.floor(safeTier/3))%choices.length],cfg=TYPES[type];
   const theta=(i*2.399963+(idHash(room.id+':'+i)%120)/120)*Math.PI;
   if(type==='volcano'||type==='fumarole'){
    // Rock and toxic anemone are visibly ATTACHED TO a chamber wall.
    const mount=wallMount(room,i);
    const reach=type==='volcano'?155:86;
    add({...mount,x:mount.sourceX+Math.cos(mount.angle)*reach*.5,
     y:mount.sourceY+Math.sin(mount.angle)*reach*.5,
     length:reach,radius:type==='volcano'?cfg.radius:cfg.radius},type,room.id,i);
   }else{
    const radial=room.id==='boss'?.45:room.id==='junction'?.16:.38;
    const x=room.x+Math.cos(theta)*room.rx*radial;
    const y=room.y+Math.sin(theta)*room.ry*radial;
    add({x,y,angle:(idHash(room.id+':angle:'+i)%6283)/1000},type,room.id,i);
   }
  }
 }
 // Wall-mounted volcanic rock along the narrow links between mob rooms.
 // A one-sided jet leaves a navigable lane and has clear rest intervals.
 for(const [i,corridor] of (layout.corridors||[]).entries()){
  if(i===0||i%3!==1||Number(corridor.width)>195)continue;
  const path=Array.isArray(corridor.path)&&corridor.path.length>2?corridor.path:null;
  if(!path)continue;
  const a=path[1],b=path[2],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
  const normalX=-dy/len,normalY=dx/len,side=(idHash('side:'+i+':'+safeTier)%2?1:-1);
  const px=a.x+dx*.5,py=a.y+dy*.5;
  const sourceX=px+normalX*side*Number(corridor.width)*.92;
  const sourceY=py+normalY*side*Number(corridor.width)*.92;
  const angle=Math.atan2(-normalY*side,-normalX*side),reach=165;
  add({x:sourceX+Math.cos(angle)*reach*.5,y:sourceY+Math.sin(angle)*reach*.5,
    sourceX,sourceY,angle,length:reach,radius:76},'volcano','passage:'+corridor.a+'-'+corridor.b,i);
 }
 if(layoutCache.size>16)layoutCache.clear();
 layoutCache.set(key,hazards);
 return hazards;
}
function state(hazard,seconds){
 const period=hazard.period||10;
 const total=Number(seconds||0)+hazard.offset;
 const p=((total%period)+period)%period,cycle=Math.floor(total/period);
 if(p>=period-hazard.active)return {phase:'active',progress:clamp((p-(period-hazard.active))/hazard.active,0,1),cycle};
 if(p>=period-hazard.active-hazard.warning)return {phase:'warning',progress:clamp((p-(period-hazard.active-hazard.warning))/hazard.warning,0,1),cycle};
 return {phase:'idle',progress:0,cycle};
}
function segmentDistance(px,py,ax,ay,bx,by){
 const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
 const t=den>0?clamp(((px-ax)*dx+(py-ay)*dy)/den,0,1):0;
 return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
}
function dangerRadius(h,s){
 if(h.type==='fumarole'&&s?.phase==='active')return Math.max(19,h.radius*Math.sqrt(Math.min(1,(s.progress+.04)*1.35)));
 if(h.type==='vortex'&&s?.phase==='active')return Math.max(36,h.radius*Math.min(1,(s.progress+.12)*2.1));
 return h.radius;
}
function hit(hazard,px,py,pad=0,phase=null){
 const h=hazardAtCycle(hazard,phase?.cycle||0),r=dangerRadius(h,phase)+pad;
 if(h.type==='volcano'&&Number.isFinite(h.sourceX)){
  const ax=h.sourceX+Math.cos(h.angle)*8,ay=h.sourceY+Math.sin(h.angle)*8;
  const bx=h.sourceX+Math.cos(h.angle)*h.length,by=h.sourceY+Math.sin(h.angle)*h.length;
  return segmentDistance(px,py,ax,ay,bx,by)<=h.radius*.5+pad;
 }
 if(h.type==='tentacle'||h.type==='electric'){
  const length=h.length||300,a=h.angle||0;
  return segmentDistance(px,py,h.x-Math.cos(a)*length*.45,h.y-Math.sin(a)*length*.45,
   h.x+Math.cos(a)*length*.55,h.y+Math.sin(a)*length*.55)<=h.radius*.5+pad;
 }
 return Math.hypot(px-h.x,py-h.y)<=r;
}
function checkpoint(layout,x,y,previous='start'){
 const room=layout?.rooms?.find(r=>r.id===previous);
 const found=layout?.rooms?.find(r=>((x-r.x)/Math.max(1,r.rx))**2+((y-r.y)/Math.max(1,r.ry))**2<.86);
 const target=found||room||layout?.rooms?.find(r=>r.id==='start');
 if(!target)return {roomId:'start',x,y};
 const offset=target.id==='boss'?Math.min(290,target.ry*.62):Math.min(105,target.ry*.23);
 return {roomId:target.id,x:target.x,y:target.y-offset};
}
// Organic, readable hazard illustrations: only tentacles use red filled damage marks.
function paintedCircle(c,x,y,r,fill,stroke=null,w=1){
 c.beginPath();c.arc(x,y,Math.max(.1,r),0,Math.PI*2);
 if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke();}
}
function ventRock(c,h,s,t){
 const phase=s.phase,warm=phase==='warning',live=phase==='active';
 c.save();c.translate(h.sourceX,h.sourceY);c.rotate(h.angle);
 c.shadowBlur=live?19:5;c.shadowColor=live?'#f16a26':'#1a3034';
 const rock=c.createRadialGradient(-7,-17,4,0,0,68);
 rock.addColorStop(0,'#68727a');rock.addColorStop(.38,'#394851');rock.addColorStop(.78,'#1d2931');rock.addColorStop(1,'#0b131d');
 c.fillStyle=rock;c.strokeStyle='#6a777d';c.lineWidth=3;
 c.beginPath();c.moveTo(-32,-51);c.lineTo(-17,-69);c.lineTo(7,-58);
 c.lineTo(30,-41);c.lineTo(35,-15);c.lineTo(28,4);c.lineTo(33,36);
 c.lineTo(10,52);c.lineTo(-13,44);c.lineTo(-28,59);c.lineTo(-38,27);c.closePath();c.fill();c.stroke();c.shadowBlur=0;
 c.strokeStyle='#132029';c.lineWidth=4;c.beginPath();c.moveTo(-23,-39);c.lineTo(-9,-18);c.lineTo(-15,6);
 c.moveTo(10,-53);c.lineTo(4,-24);c.lineTo(22,-3);c.stroke();
 for(let i=0;i<8;i++){const a=i*Math.PI/4,cx=Math.cos(a)*26,cy=Math.sin(a)*27;
  c.strokeStyle=i%2?'#5e6264':'#28323a';c.lineWidth=1.5;c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+9*Math.sin(a+1),cy-10*Math.cos(a+1));c.stroke();}
 const glow=live?1:warm?.65+.32*s.progress:.2;
 const ember=c.createRadialGradient(6,0,1,6,0,24);
 ember.addColorStop(0,'rgba(255,237,159,'+glow+')');
 ember.addColorStop(.48,'rgba(255,102,34,'+Math.min(1,glow*.91)+')');
 ember.addColorStop(1,'rgba(75,18,17,0)');
 c.fillStyle=ember;c.beginPath();c.ellipse(6,0,24,18,0,0,Math.PI*2);c.fill();
 c.fillStyle='#100c14';c.strokeStyle=warm||live?'#f49153':'#765448';c.lineWidth=3;
 c.beginPath();c.ellipse(7,0,12,17,0,0,Math.PI*2);c.fill();c.stroke();
 if(warm||live)for(let i=0;i<6;i++){
  const p=(i*.187+t*.00033)%1;
  const x=20+p*(live?Math.min(h.length,170):37),y=Math.sin(i*2.2+t*.008)*16;
  paintedCircle(c,x,y,1.4+(i%3),i%2?'#ffb461':'#ffd6a1');
 }
 if(live){
  // Jet starts at the wall vent and never comes from a floating floor circle.
  const length=h.length,half=h.radius*.45,beat=Math.sin(t*.015)*3;
  const fire=c.createLinearGradient(5,0,length,0);
  fire.addColorStop(0,'rgba(255,248,199,.99)');
  fire.addColorStop(.20,'rgba(255,184,66,.94)');
  fire.addColorStop(.65,'rgba(255,93,31,.74)');
  fire.addColorStop(1,'rgba(231,69,25,.06)');
  c.fillStyle=fire;c.shadowBlur=24;c.shadowColor='#f97029';
  c.beginPath();c.moveTo(8,-16);
  c.bezierCurveTo(length*.3,-half*.85,length*.75,-half*.62,length+beat,-8);
  c.quadraticCurveTo(length+10,0,length+beat,8);
  c.bezierCurveTo(length*.77,half*.61,length*.35,half*.85,8,16);
  c.closePath();c.fill();
  c.shadowBlur=9;c.shadowColor='#ffe3a3';c.fillStyle='rgba(255,222,145,.88)';
  c.beginPath();c.moveTo(15,-5);c.quadraticCurveTo(length*.68,-half*.22,length*.91,0);c.quadraticCurveTo(length*.6,half*.23,15,5);c.closePath();c.fill();c.shadowBlur=0;
  for(let i=0;i<11;i++){
   const q=(i*.117+t*.00049)%1,px=length*q,py=Math.sin(i*2.7+t*.008)*half*(.23+q*.5);
   paintedCircle(c,px,py,2+3*(1-q),i%2?'rgba(255,206,121,.93)':'rgba(255,123,47,.78)');
  }
 }
 c.restore();
}
function poisonousAnemone(c,h,s,t){
 c.save();c.translate(h.sourceX,h.sourceY);c.rotate(h.angle);
 const pulse=Math.sin(t*.0037),active=s.phase==='active';
 // Brown-green anchor, firmly rooted in the rock wall.
 c.fillStyle='#1a372c';c.strokeStyle='#587c58';c.lineWidth=2.5;
 c.beginPath();c.ellipse(-10,0,27,33,0,0,Math.PI*2);c.fill();c.stroke();
 c.fillStyle='#3e6947';c.beginPath();c.ellipse(-3,0,15,19,0,0,Math.PI*2);c.fill();
 for(let i=0;i<15;i++){
  const a=-1.4+i*2.8/14,ext=(35+i%4*7)*(1+.07*pulse),side=Math.sin(i*.9+t*.003)*6;
  const px=ext*Math.cos(a),py=ext*Math.sin(a);
  c.beginPath();c.moveTo(-4,0);c.quadraticCurveTo(18,py*.45+side,px,py+side);
  c.strokeStyle=i%3===0?'#d5ff82':i%2?'#8ee05f':'#2b946b';
  c.lineWidth=i%4===0?6:3.9;c.lineCap='round';c.shadowBlur=active?8:3;c.shadowColor='#93ff6f';c.stroke();
  paintedCircle(c,px,py+side,2.5,'#caff9a');
 }
 c.shadowBlur=0;paintedCircle(c,6,0,11,'#163928','#a9eb63',2);
 c.restore();
 if(s.phase==='idle')return;
 if(s.phase==='warning'){
  // The poison glands light up, no generic red danger circle.
  c.save();c.globalAlpha=.35+s.progress*.4;
  for(let i=0;i<8;i++){
   const a=i*2.4+t*.00045;
   paintedCircle(c,h.sourceX+Math.cos(a)*32,h.sourceY+Math.sin(a)*32,3+i%3,
    i%2?'#dbff8f':'#8eff64');
  }
  c.restore();return;
 }
 const radius=dangerRadius(h,s),p=s.progress;
 c.save();
 // Organic cloud blooming outwards, same lime rings and green particles as the
 // Anêmona Tóxica's existing poison-cloud skill, with additional soft smoke.
 const cloud=c.createRadialGradient(h.x,h.y,radius*.12,h.x,h.y,radius);
 cloud.addColorStop(0,'rgba(162,255,109,.24)');
 cloud.addColorStop(.45,'rgba(91,215,85,.23)');
 cloud.addColorStop(.75,'rgba(68,178,91,.14)');
 cloud.addColorStop(1,'rgba(67,167,87,0)');
 c.fillStyle=cloud;c.beginPath();c.arc(h.x,h.y,radius,0,Math.PI*2);c.fill();
 for(let i=0;i<7;i++){
  const a=i*2.399+t*.00018,q=(i+1)/9,rr=radius*(.15+q*.64);
  c.globalAlpha=.16+.07*Math.sin(t*.003+i);
  const xx=h.x+Math.cos(a)*rr,yy=h.y+Math.sin(a)*rr;
  c.fillStyle=i%2?'#a0f38c':'#58bb82';
  c.beginPath();c.arc(xx,yy,radius*(.19+.025*(i%3)),0,Math.PI*2);c.fill();
 }
 c.globalAlpha=.54;
 for(const [index,k] of [[0,1],[1,.68]]){
  c.strokeStyle=index?'#e0ff74':'#75ff68';c.lineWidth=index?2.8:3.6;
  c.beginPath();c.arc(h.x,h.y,radius*k,-Math.PI*.8,Math.PI*.85);c.stroke();
 }
 for(let i=0;i<22;i++){
  const a=i*2.399+t*.00025,rr=radius*(.17+(i%7)/9);
  c.globalAlpha=.22+(i%4)*.14;
  paintedCircle(c,h.x+Math.cos(a)*rr,h.y+Math.sin(a)*rr,1.4+i%3,
   i%3?'#75ff68':'#dfff83');
 }
 c.restore();
}
function deepCurrentPit(c,h,s,t){
 const x=h.x,y=h.y,r=h.radius,active=s.phase==='active',warning=s.phase==='warning';
 c.save();
 // Permanent dark depression on the floor, even when the current is dormant.
 const pit=c.createRadialGradient(x-r*.17,y-r*.12,3,x,y,r*.9);
 pit.addColorStop(0,'#01060e');pit.addColorStop(.38,'#02111d');
 pit.addColorStop(.73,'#0b2940');pit.addColorStop(.93,'rgba(36,76,95,.66)');
 pit.addColorStop(1,'rgba(6,31,48,0)');
 c.fillStyle=pit;c.beginPath();c.ellipse(x,y,r,r*.78,0,0,Math.PI*2);c.fill();
 c.lineWidth=3;c.strokeStyle='rgba(90,153,182,.26)';
 for(let i=0;i<3;i++){c.beginPath();c.ellipse(x,y,r*(.39+i*.18),r*(.25+i*.15),0,0,Math.PI*2);c.stroke();}
 if(warning){
  // Rising bubbles visibly expand and pop BEFORE the suction begins.
  for(let i=0;i<16;i++){
   const q=(i*.19+s.progress*.92)%1;
   const a=i*2.399+t*.0002,rr=r*(.18+.55*(1-q));
   const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr-q*21;
   const radius=2.5+7*q;
   c.globalAlpha=(1-q)*.83;c.lineWidth=1.8;
   c.strokeStyle=i%3?'#98dff4':'#d9ffff';
   c.beginPath();c.arc(px,py,radius,0,Math.PI*2);c.stroke();
   if(q>.78){c.beginPath();for(let b=0;b<4;b++){
    const ba=b*Math.PI/2+a;c.moveTo(px+Math.cos(ba)*radius,py+Math.sin(ba)*radius);
    c.lineTo(px+Math.cos(ba)*(radius+5*q),py+Math.sin(ba)*(radius+5*q));
   }c.stroke();}
  }
 }
 if(active){
  const size=dangerRadius(h,s);
  c.globalAlpha=.23;c.fillStyle='#0d5579';
  c.beginPath();c.ellipse(x,y,size,size*.85,0,0,Math.PI*2);c.fill();
  c.globalAlpha=.85;c.lineCap='round';
  for(let i=0;i<4;i++){
   const start=t*.0026+i*Math.PI/2,rad=size*(.32+i*.2);
   c.beginPath();c.arc(x,y,rad,start,start+Math.PI*1.34);
   c.strokeStyle=i%2?'#6db7d8':'#b8eeff';c.lineWidth=3.5-i*.48;c.stroke();
  }
  for(let i=0;i<15;i++){
   const q=i/15,a=i*2.399+t*.0035,rad=size*(.15+.79*((i*5%17)/17));
   paintedCircle(c,x+Math.cos(a)*rad,y+Math.sin(a)*rad*.79,1.8+(i%4),i%3?'#93d7f4':'#e3fbff');
  }
  const eye=c.createRadialGradient(x,y,1,x,y,size*.24);
  eye.addColorStop(0,'#01050e');eye.addColorStop(.7,'#041d30');eye.addColorStop(1,'rgba(19,75,104,0)');
  c.fillStyle=eye;c.beginPath();c.arc(x,y,size*.25,0,Math.PI*2);c.fill();
 }
 c.restore();
}
function tentacleTrap(c,original,s,t){
 const h=hazardAtCycle(original,s.cycle);
 c.save();
 c.strokeStyle='rgba(110,66,130,.65)';c.lineWidth=11;c.lineCap='round';
 c.beginPath();c.moveTo(h.x-20,h.y-16);c.lineTo(h.x+24,h.y+15);c.stroke();
 if(s.phase==='warning'||s.phase==='active'){
  // This is the ONLY hazard with a red translucent attack footprint.
  c.save();c.translate(h.x,h.y);c.rotate(h.angle);c.beginPath();
  c.roundRect(-h.length*.45,-h.radius*.5,h.length,h.radius,h.radius*.42);
  c.fillStyle=s.phase==='warning'?'rgba(255,34,60,'+(.18+.18*s.progress)+')':'rgba(211,73,128,.35)';
  c.strokeStyle=s.phase==='warning'?'rgba(255,62,79,.98)':'#e3a1f9';
  c.lineWidth=s.phase==='warning'?4:3;c.shadowColor='#fc395b';c.shadowBlur=13;c.fill();c.stroke();c.restore();
 }
 if(s.phase==='active'){
  c.save();c.translate(h.x,h.y);c.rotate(h.angle);
  c.strokeStyle='#4c1b6e';c.lineWidth=h.radius*.70;c.lineCap='round';c.shadowColor='#9d4ac5';c.shadowBlur=14;
  c.beginPath();c.moveTo(-h.length*.45,0);c.bezierCurveTo(-h.length*.08,-6,h.length*.3,8,h.length*.55,0);c.stroke();
  c.strokeStyle='#bc77e9';c.lineWidth=h.radius*.29;c.shadowBlur=0;c.stroke();
  for(let i=0;i<12;i++){
   const q=i/12,xx=(q-.45)*h.length,yy=Math.sin(i*.5+t*.002)*h.radius*.16;
   paintedCircle(c,xx,yy,3+i%3,'rgba(226,175,246,.73)');
  }c.restore();
 }
 c.restore();
}
function rockfallTrap(c,h,s,t){
 if(s.phase==='idle')return;
 c.save();const x=h.x,y=h.y,r=h.radius;
 const n=s.phase==='active'?7:10;
 for(let i=0;i<n;i++){
  const a=i*2.399+Math.sin(t*.001+i)*.1,rr=r*(.2+.58*((i*3%11)/11));
  const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;
  const size=s.phase==='active'?(16+i%4*4):(3+i%4*2);
  c.globalAlpha=s.phase==='active'?.95:.35+s.progress*.4;
  c.fillStyle=s.phase==='active'?'#55606b':'#8c8b86';c.strokeStyle='#9fa0a0';c.lineWidth=2;
  c.beginPath();c.moveTo(px-size,py);c.lineTo(px-size*.45,py-size);
  c.lineTo(px+size*.43,py-size*.68);c.lineTo(px+size,py+size*.38);
  c.lineTo(px-size*.2,py+size*.76);c.closePath();c.fill();c.stroke();
 }
 if(s.phase==='warning'){
  c.strokeStyle='rgba(183,187,179,.5)';c.lineWidth=1.7;
  for(let i=0;i<5;i++){const a=i*2.4;c.beginPath();c.moveTo(x+Math.cos(a)*r*.2,y+Math.sin(a)*r*.2);
   c.lineTo(x+Math.cos(a+.4)*r*.62,y+Math.sin(a+.4)*r*.64);c.stroke();}
 }
 c.restore();
}
function supplementalTrap(c,h,s,t){
 const x=h.x,y=h.y,r=h.radius,live=s.phase==='active',warning=s.phase==='warning';
 c.save();
 if(h.type==='spikes'){
  // Fossilized coral colony grows out of floor cracks.
  c.strokeStyle='#526367';c.lineWidth=2;
  for(let i=0;i<10;i++){
   const a=i*2.399,rr=r*(.2+.6*(i%5)/5);
   c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);c.stroke();
   const height=live?22:warning?6+12*s.progress:4,px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;
   c.fillStyle=live?'#bd9aab':'#6c8184';c.strokeStyle=live?'#e5bacb':'#819c9b';
   c.beginPath();c.moveTo(px-8,py+5);c.lineTo(px,py-height);c.lineTo(px+8,py+5);c.closePath();c.fill();c.stroke();
  }
 }else if(h.type==='pressure'){
  if(s.phase==='idle'){c.globalAlpha=.14;paintedCircle(c,x,y,r*.28,'#74a7c5');}
  else{
   c.strokeStyle=live?'rgba(206,232,255,.92)':'rgba(139,186,230,.53)';
   c.lineWidth=live?3:2;
   for(let i=0;i<4;i++){let rr=r*(live?(1-(i+s.progress*.8)%4/4):.22+i*.18);
    c.beginPath();c.ellipse(x,y,rr,rr*.88,0,0,Math.PI*2);c.stroke();}
   c.fillStyle='rgba(103,164,218,'+(live?.17:.07)+')';
   c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
  }
 }else if(h.type==='lure'){
  const p=.5+.5*Math.sin(t*.005),shine=live?.12:.6+p*.23;
  c.shadowBlur=15;c.shadowColor='#8ef5fc';
  paintedCircle(c,x,y,4+p*4,'rgba(196,255,243,'+shine+')');
  c.shadowBlur=0;
  if(warning){c.strokeStyle='rgba(133,244,252,.56)';c.lineWidth=2;
   c.beginPath();c.arc(x,y,18+s.progress*32,0,Math.PI*2);c.stroke();}
  if(live){
   const gr=c.createRadialGradient(x,y,4,x,y,r);
   gr.addColorStop(0,'rgba(1,4,16,.93)');gr.addColorStop(.65,'rgba(13,20,46,.65)');gr.addColorStop(1,'rgba(8,22,45,0)');
   c.fillStyle=gr;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
   c.strokeStyle='#a8daef';c.lineWidth=3;
   for(let i=0;i<10;i++){const a=i*Math.PI/5;let sx=x+Math.cos(a)*r*.75,sy=y+Math.sin(a)*r*.75;
    c.beginPath();c.moveTo(sx,sy);c.lineTo(x+Math.cos(a+.2)*r*.38,y+Math.sin(a+.2)*r*.38);c.stroke();}
  }
 }else if(h.type==='electric'){
  const a=h.angle,l=h.length;
  for(const dir of [-1,1]){const sx=x+Math.cos(a)*l*.45*dir,sy=y+Math.sin(a)*l*.45*dir;
   c.fillStyle='#1a3d4b';c.strokeStyle='#438896';c.lineWidth=2;
   c.beginPath();c.moveTo(sx-16,sy+11);c.lineTo(sx,sy-20);c.lineTo(sx+15,sy+13);c.closePath();c.fill();c.stroke();}
  if(warning||live){c.save();c.translate(x,y);c.rotate(a);
   c.lineCap='round';c.strokeStyle=live?'#cbf9ff':'rgba(90,223,238,.56)';c.lineWidth=live?4:1.8;
   c.beginPath();for(let i=0;i<=15;i++){
    const q=i/15,bend=Math.sin(t*.019+i*2.24)*h.radius*(live?.34:.10)*(1-Math.abs(q-.5));
    const px=(q-.45)*l;if(!i)c.moveTo(px,bend);else c.lineTo(px,bend);
   }c.stroke();c.restore();}
 }
 c.restore();
}
function draw(c,hazards,seconds,view){
 if(!Array.isArray(hazards))return;
 for(const original of hazards){
  if(view&&(original.x<view.x-440||original.x>view.x+view.w+440||
    original.y<view.y-440||original.y>view.y+view.h+440))continue;
  const s=state(original,seconds),h=original;
  if(h.type==='volcano')ventRock(c,h,s,seconds*1000);
  else if(h.type==='fumarole')poisonousAnemone(c,h,s,seconds*1000);
  else if(h.type==='vortex')deepCurrentPit(c,h,s,seconds*1000);
  else if(h.type==='tentacle')tentacleTrap(c,h,s,seconds*1000);
  else if(h.type==='rockfall')rockfallTrap(c,h,s,seconds*1000);
  else supplementalTrap(c,h,s,seconds*1000);
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