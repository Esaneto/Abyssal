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
// Rock and navigable water share the geometry in abyssal-map.js and ocean-terrain.js.
// All hazards except underwater vortexes are physically attached to the cave boundary.
const MapGeometry=(typeof module==='object'&&module.exports)?require('./abyssal-map.js'):globalThis.AbyssalMap;
const WALL_TYPES=new Set(['volcano','fumarole','rockfall','tentacle','pressure','spikes','lure','electric']);
const WALL_REACH=Object.freeze({volcano:136,fumarole:54,rockfall:62,tentacle:240,pressure:59,spikes:44,lure:37,electric:182});
function water(layout,x,y,pad=0){return Boolean(MapGeometry?.isWalkable(layout,x,y,pad));}
function wallMount(layout,room,tag,blocked=[]){
 // Ellipse boundary is only a candidate. The cave is the UNION of rooms and
 // winding corridors. Reject any point that is inside an overlapping corridor.
 const phase=(idHash(room.id+':wall:'+tag)%6283)/1000;
 for(let j=0;j<40;j++){
  const theta=phase+j*2.399963229728653,cs=Math.cos(theta),sn=Math.sin(theta);
  const bx=room.x+cs*room.rx,by=room.y+sn*room.ry;
  const xx=cs/room.rx,yy=sn/room.ry,norm=Math.hypot(xx,yy)||1;
  const ox=xx/norm,oy=yy/norm;
  const sourceX=bx-ox*4,sourceY=by-oy*4;
  const innerX=bx-ox*42,innerY=by-oy*42;
  const outerX=bx+ox*28,outerY=by+oy*28;
  if(!water(layout,sourceX,sourceY)||!water(layout,innerX,innerY)||water(layout,outerX,outerY))continue;
  if(blocked.some(p=>Math.hypot(sourceX-p.x,sourceY-p.y)<p.r))continue;
  return {sourceX,sourceY,angle:Math.atan2(-oy,-ox),wallKind:'chamber'};
 }
 return null;
}
function corridorMount(layout,corridor,index,blocked=[]){
 // Use the actual piecewise curved corridor, never the center of its chord.
 const path=corridor.path||[];
 if(path.length<3)return null;
 const segment=1;
 const a=path[segment],b=path[segment+1];
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
 const nx=-dy/len,ny=dx/len,midX=(a.x+b.x)*.5,midY=(a.y+b.y)*.5;
 const side=idHash('side:'+index+':'+layout.tier)%2?1:-1;
 for(const sign of [side,-side]){
  const ox=nx*sign,oy=ny*sign,w=corridor.width;
  const sx=midX+ox*(w-4),sy=midY+oy*(w-4);
  if(!water(layout,sx,sy)||!water(layout,midX+ox*(w-44),midY+oy*(w-44))||water(layout,midX+ox*(w+28),midY+oy*(w+28)))continue;
  if(blocked.some(p=>Math.hypot(sx-p.x,sy-p.y)<p.r))continue;
  return {sourceX:sx,sourceY:sy,angle:Math.atan2(-oy,-ox),wallKind:'corridor'};
 }
 return null;
}
function hazardAtCycle(h,cycle=0){
 if(h.type!=='tentacle')return h;
 const jitter=(idHash(h.id+':sweep:'+cycle)%1000)/1000-.5;
 if(Number.isFinite(h.sourceX)){
  const angle=h.angle+jitter*.42,l=h.length||240;
  return {...h,angle,x:h.sourceX+Math.cos(angle)*l*.5,y:h.sourceY+Math.sin(angle)*l*.5};
 }
 return {...h,x:h.x+jitter*40,y:h.y+jitter*22,angle:h.angle+jitter*.3};
}
function build(layout,tier=0){
 if(!layout||!Array.isArray(layout.rooms))return [];
 const safeTier=clamp(Math.floor(Number(tier)||0),0,100);
 const key=String(layout.seed||layout.mapSeed||layout.id||'')+':'+safeTier+':'+layout.rooms.map(r=>r.id+':'+r.x+':'+r.y).join(',')+
   ':'+(layout.corridors||[]).map(c=>c.a+':'+c.b+':'+c.width).join(',');
 if(layoutCache.has(key))return layoutCache.get(key);
 const hazards=[],blocked=[];
 for(const p of Object.values(layout.portals||{}))if(p)blocked.push({x:p.x,y:p.y,r:(Number(p.r)||0)+145});
 const start=layout.rooms.find(r=>r.id==='start');
 if(start)blocked.push({x:start.x,y:start.y,r:260});
 function add(h,type,roomId,index){
  const cfg=TYPES[type],reach=WALL_REACH[type]||0;
  const point=Number.isFinite(h.sourceX)?
   {x:h.sourceX+Math.cos(h.angle)*(reach*.5),y:h.sourceY+Math.sin(h.angle)*(reach*.5)}:{x:h.x,y:h.y};
  hazards.push({...h,...point,id:roomId+':'+index,type,roomId,
   period:cfg.period,warning:cfg.warning,active:cfg.active,
   offset:(idHash(roomId+':timing:'+index+':'+safeTier)%1000)/1000*cfg.period,
   radius:type==='volcano'?(h.wallKind==='corridor'?62:82):
    type==='tentacle'?64:type==='fumarole'?100:type==='electric'?46:
    type==='spikes'?74:type==='rockfall'?77:type==='lure'?67:type==='pressure'?95:cfg.radius,
   length:type==='volcano'&&h.wallKind==='corridor'?126:reach||h.length||cfg.length||0,
   damage:Math.round(cfg.damage*(1+Math.min(.9,safeTier*.07)))});
  if(Number.isFinite(h.sourceX))blocked.push({x:h.sourceX,y:h.sourceY,r:180});
 }
 for(const room of layout.rooms){
  if(room.id==='start')continue;
  const choices=ALLOCATION[room.id]||['spikes'];
  if(room.id==='boss'&&safeTier<3)continue;
  // Two embedded threats per room at the deepest levels; their dormant roots
  // should read as cave detail rather than a field of floating obstacles.
  const count=Math.min(choices.length,safeTier>=4?2:1);
  for(let i=0;i<count;i++){
   const type=choices[(i+Math.floor(safeTier/3))%choices.length];
   if(type==='vortex'){
    const a=(idHash(room.id+':pit')%6283)/1000,scale=room.id==='boss'?.19:.14;
    add({x:room.x+Math.cos(a)*room.rx*scale,y:room.y+Math.sin(a)*room.ry*scale,angle:a},type,room.id,i);
    continue;
   }
   const mount=wallMount(layout,room,i+safeTier*.13,blocked);
   if(mount)add(mount,type,room.id,i);
  }
 }
 // Narrow-path volcanic vents are placed only where corridor walls are real.
 // The hot stream leaves a wide traversable strip and never blocks entrances.
 for(const [i,passage]of (layout.corridors||[]).entries()){
  if(i===0||i%3!==1||Number(passage.width)>195)continue;
  const anchor=corridorMount(layout,passage,i,blocked);
  if(anchor)add(anchor,'volcano','passage:'+passage.a+'-'+passage.b,i);
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
 const h=hazardAtCycle(hazard,phase?.cycle||0);
 const r=dangerRadius(h,phase)+pad;
 if(Number.isFinite(h.sourceX)&&['volcano','tentacle','electric'].includes(h.type)){
  const len=h.length||130,ax=h.sourceX+Math.cos(h.angle)*8,ay=h.sourceY+Math.sin(h.angle)*8;
  const bx=h.sourceX+Math.cos(h.angle)*len,by=h.sourceY+Math.sin(h.angle)*len;
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
// The floor uses #031119 / #0b202c / #25434b. These surfaces borrow exactly
// those tones: dormant traps must be almost indistinguishable from the cave.
function wallSeam(c,h,t,accent,s,scale=1){
 c.save();c.translate(h.sourceX,h.sourceY);c.rotate(h.angle);
 const intensity=s.phase==='active'?.82:s.phase==='warning'?.27+.37*s.progress:.12;
 c.globalAlpha=.67;
 const rock=c.createRadialGradient(-19,-8,1,0,0,61*scale);
 rock.addColorStop(0,'rgba(2,8,15,.95)');
 rock.addColorStop(.43,'rgba(5,18,27,.91)');
 rock.addColorStop(.73,'rgba(11,32,44,.65)');
 rock.addColorStop(1,'rgba(21,53,62,0)');
 c.fillStyle=rock;
 c.beginPath();c.ellipse(-13,0,51*scale,35*scale,0,0,Math.PI*2);c.fill();
 // Two fracture lines disappear into the geological strata.
 c.strokeStyle='rgba(45,85,94,.38)';c.lineWidth=2.4;c.lineCap='round';
 for(const side of [-1,1]){
  c.beginPath();c.moveTo(-51,side*14);
  c.bezierCurveTo(-24,side*23,-17,side*16,4,side*18);
  c.quadraticCurveTo(19,side*15,29,side*6);c.stroke();
 }
 const hole=c.createRadialGradient(4,0,2,4,0,29);
 hole.addColorStop(0,'rgba(0,3,9,.98)');hole.addColorStop(.58,'rgba(4,14,24,.95)');
 hole.addColorStop(1,'rgba(9,29,41,0)');
 c.fillStyle=hole;c.beginPath();c.ellipse(0,0,35*scale,22*scale,0,0,Math.PI*2);c.fill();
 // Barely visible when asleep, localized neon only where the living rock opens.
 c.globalAlpha=intensity;
 c.strokeStyle=accent;c.shadowColor=accent;c.shadowBlur=s.phase==='active'?11:5;
 c.lineWidth=1.2+(s.phase==='active'?1.3:0);
 c.beginPath();c.moveTo(-13,-14*scale);c.quadraticCurveTo(18,-11*scale,25,0);
 c.quadraticCurveTo(18,11*scale,-13,14*scale);c.stroke();
 c.shadowBlur=0;c.restore();
}
function ventRock(c,h,s,t){
 const warm=s.phase==='warning',live=s.phase==='active';
 wallSeam(c,h,t,'#d77a45',s,.86);
 c.save();c.translate(h.sourceX,h.sourceY);c.rotate(h.angle);
 const pulse=Math.sin(t*.011),intensity=live?1:warm?.24+s.progress*.65:.09;
 // Molten veins run THROUGH the wall, not around a freestanding boulder.
 c.strokeStyle='rgba(149,83,49,'+(.22+intensity*.56)+')';
 c.shadowColor='#ff9851';c.shadowBlur=warm||live?8:0;c.lineWidth=1.2+intensity*1.4;
 for(const sign of [-1,1]){
  c.beginPath();c.moveTo(-31,sign*22);
  c.bezierCurveTo(-14,sign*13,4,sign*(8+pulse*2),12,sign*5);c.stroke();
 }
 c.shadowBlur=0;
 for(let i=0;i<5;i++){
  const q=(i*.213+t*.0003)%1;
  if(!warm&&!live)break;
  paintedCircle(c,9+q*(warm?29:h.length*.9),
    Math.sin(i*2.4+t*.006)*9*(1+q),1.5+(i%3),
    i%2?'rgba(255,186,116,.64)':'rgba(255,132,71,.58)');
 }
 if(live){
  // A narrow feathered hydrothermal flare. The translucent outer envelope
  // conveys its hit corridor without creating a solid orange cone.
  const length=h.length,half=h.radius*.49;
  c.lineCap='round';
  const flame=c.createLinearGradient(0,0,length,0);
  flame.addColorStop(0,'rgba(255,195,126,.68)');
  flame.addColorStop(.22,'rgba(246,126,71,.46)');
  flame.addColorStop(.74,'rgba(199,78,51,.25)');
  flame.addColorStop(1,'rgba(198,77,46,0)');
  c.strokeStyle=flame;c.lineWidth=half*1.35;c.shadowColor='#d77340';c.shadowBlur=10;
  c.beginPath();c.moveTo(13,0);
  c.bezierCurveTo(length*.27,-6+4*pulse,length*.73,5*pulse,length,0);c.stroke();
  c.lineWidth=half*.56;c.strokeStyle='rgba(255,181,101,.52)';c.shadowBlur=3;c.stroke();
  c.shadowBlur=0;
  for(let i=0;i<8;i++){
   const q=(i*.131+t*.00042)%1,xx=length*q;
   c.strokeStyle=i%2?'rgba(255,199,129,.6)':'rgba(246,142,69,.49)';
   c.lineWidth=1.4+i%2;c.beginPath();
   c.moveTo(xx,-half*(.18+.55*q));
   c.quadraticCurveTo(xx+12,Math.sin(t*.004+i)*5,xx+19,half*(.13+.40*q));c.stroke();
  }
 }
 c.restore();
}
function poisonousAnemone(c,h,s,t){
 wallSeam(c,h,t,'#8fe58c',s,.84);
 const active=s.phase==='active',warm=s.phase==='warning';
 c.save();c.translate(h.sourceX,h.sourceY);c.rotate(h.angle);
 const pulse=Math.sin(t*.0045);
 // Small anemone colony grown into the wall: no oval pot or disconnected leaves.
 for(let i=0;i<11;i++){
  const side=i%2?-1:1,rank=Math.floor(i/2),len=22+rank*4;
  const y=side*(3+rank*3),end=18+len*.7;
  c.beginPath();c.moveTo(-12,y*.4);
  c.bezierCurveTo(2,side*(14+rank*1.7),end*.66,side*(20+rank*3)+pulse*2,end,side*(20+rank*3)+pulse*3);
  c.lineWidth=i%3===0?2.8:2.1;c.lineCap='round';
  c.strokeStyle=i%3===0?'rgba(111,182,132,.62)':'rgba(48,130,120,.62)';
  c.stroke();if(warm||active){
   c.globalAlpha=warm?.25+s.progress*.42:.68;
   c.strokeStyle=i%3===0?'#a7ff78':'#78dba2';
   c.lineWidth=.8;c.stroke();c.globalAlpha=1;
  }
  paintedCircle(c,end,side*(20+rank*3)+pulse*3,1.3+(i%2)*.4,
   warm||active?'rgba(156,247,134,.78)':'rgba(64,142,135,.36)');
 }
 c.restore();
 if(!active)return;
 const radius=dangerRadius(h,s),coreX=h.x,coreY=h.y;
 c.save();c.globalAlpha=.9;
 const cloud=c.createRadialGradient(coreX,coreY,radius*.08,coreX,coreY,radius);
 cloud.addColorStop(0,'rgba(116,226,107,.23)');
 cloud.addColorStop(.36,'rgba(83,198,116,.16)');
 cloud.addColorStop(.77,'rgba(49,151,128,.08)');
 cloud.addColorStop(1,'rgba(45,134,127,0)');
 c.fillStyle=cloud;c.beginPath();c.arc(coreX,coreY,radius,0,Math.PI*2);c.fill();
 // Separate soft smoke ribbons and sparse Anêmona Tóxica green spores.
 for(let i=0;i<7;i++){
  const a=i*2.399+t*.00015,rr=radius*(.18+(i%4)*.17);
  const x=coreX+Math.cos(a)*rr,y=coreY+Math.sin(a)*rr;
  c.globalAlpha=.12+(i%3)*.035;c.fillStyle=i%2?'#98f297':'#67bcab';
  c.beginPath();c.ellipse(x,y,radius*.21,radius*.12,a,0,Math.PI*2);c.fill();
 }
 c.globalAlpha=.35;c.lineWidth=1.2;c.strokeStyle='#a7ff78';
 c.beginPath();c.arc(coreX,coreY,radius*.75,-2.8,.54);c.stroke();
 for(let i=0;i<15;i++){
  const a=i*2.399+t*.00023,q=.16+(i%6)*.13;
  c.globalAlpha=.28+(i%4)*.09;
  paintedCircle(c,coreX+Math.cos(a)*radius*q,coreY+Math.sin(a)*radius*q,
    1.1+(i%3)*.5,i%3?'#81de83':'#d1ff9a');
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