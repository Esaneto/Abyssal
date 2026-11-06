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
  volcano:{name:'VULCÃO ABISSAL',period:10.5,warning:1.65,active:2.15,radius:100,damage:24,color:'#ff7341'},
  fumarole:{name:'FUMAROLA TÓXICA',period:13.5,warning:1.55,active:4.2,radius:120,damage:12,color:'#8feb78'},
  rockfall:{name:'DESMORONAMENTO',period:10,warning:1.45,active:.8,radius:95,damage:31,color:'#d2a3a3'},
  tentacle:{name:'TENTÁCULO DA FENDA',period:11.5,warning:.8,active:3.6,radius:82,length:320,damage:29,color:'#b873ff'},
  pressure:{name:'PRESSÃO ESMAGADORA',period:11.6,warning:1.7,active:2.2,radius:140,damage:20,color:'#8bb7ff'},
  spikes:{name:'CORAL FOSSILIZADO',period:10.8,warning:.75,active:3.7,radius:108,damage:20,color:'#e48b82'},
  vortex:{name:'VÓRTICE DE SUCÇÃO',period:14.5,warning:2.3,active:4.2,radius:155,damage:10,color:'#68a9e5'},
  lure:{name:'ISCA DA MORTE',period:14,warning:1.1,active:1.4,radius:82,damage:25,color:'#71eaff'},
  electric:{name:'ARCO BIOELÉTRICO',period:10.2,warning:1.2,active:1,radius:59,length:300,damage:24,color:'#8bdfff'}
});
const ALLOCATION=Object.freeze({
  shoal:['volcano','spikes'],trench:['fumarole','rockfall'],lantern:['lure','electric'],
  junction:['pressure','electric'],event:['rockfall','tentacle'],hub:['volcano','pressure'],
  landing:['tentacle','volcano','spikes'],elite:['electric','spikes','tentacle'],
  boss:['tentacle','fumarole','pressure']
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

// The ray ends at the FIRST solid wall, not at an arbitrary radius.
// Per-hazard rays are precomputed at build time; the online tick only reads geometry.
function traceToWall(layout,x,y,angle,limit=2600){
 const ux=Math.cos(angle),uy=Math.sin(angle),step=14;
 let previous=0;
 for(let d=step;d<=limit+step;d+=step){
  const current=Math.min(d,limit);
  if(!water(layout,x+ux*current,y+uy*current,3)){
   let lo=previous,hi=current;
   for(let k=0;k<7;k++){
    const mid=(lo+hi)*.5;
    if(water(layout,x+ux*mid,y+uy*mid,3))lo=mid;else hi=mid;
   }
   return Math.max(12,lo-3);
  }
  previous=current;
  if(current===limit)break;
 }
 return limit;
}
function wallGeometry(layout,anchor,type){
 const angle=anchor.angle,sourceX=anchor.sourceX,sourceY=anchor.sourceY;
 if(type==='volcano'||type==='spikes'||type==='tentacle'||type==='electric'){
  const reach=traceToWall(layout,sourceX,sourceY,angle,2450);
  // Entire chamber for fire and retracting spikes; the tentacle uses the
  // opposite wall as well, but does not reveal itself while dormant.
  return {...anchor,length:Math.max(40,reach)};
 }
 if(type==='fumarole'){
  const originX=sourceX+Math.cos(angle)*11,originY=sourceY+Math.sin(angle)*11;
  const rays=Array.from({length:41},(_,i)=>{
   const a=angle+(-.495+i/40*.99)*Math.PI;
   return {angle:a,length:traceToWall(layout,originX,originY,a,2700)};
  });
  return {...anchor,poisonRays:rays,maxReach:Math.max(...rays.map(r=>r.length)),poisonOriginX:originX,poisonOriginY:originY};
 }
 return anchor;
}
// Rapid extension and visibly slower retraction. Collision uses the SAME
// timeline, not the fully extended theoretical hitbox while retracting.
function extension(h,phase){
 if(!phase)return 1; // static geometry/introspection remains available
 if(phase.phase==='idle')return 0;
 if(phase.phase==='warning')return 0;
 const q=clamp(phase.progress,0,1);
 if(h.type==='spikes')return q<.13?Math.sin(q/.13*Math.PI*.5):clamp(1-(q-.13)/.87,0,1);
 if(h.type==='tentacle')return q<.18?Math.sin(q/.18*Math.PI*.5):q<.28?1:clamp(1-(q-.28)/.72,0,1);
 return 1;
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
  const cfg=TYPES[type],reach=Number(h.length)>0?Number(h.length):(WALL_REACH[type]||0);
  const point=Number.isFinite(h.sourceX)?
   {x:h.sourceX+Math.cos(h.angle)*(reach*.5),y:h.sourceY+Math.sin(h.angle)*(reach*.5)}:{x:h.x,y:h.y};
  hazards.push({...h,...point,id:roomId+':'+index,type,roomId,
   period:cfg.period,warning:cfg.warning,active:cfg.active,
   offset:(idHash(roomId+':timing:'+index+':'+safeTier)%1000)/1000*cfg.period,
   radius:type==='volcano'?(h.wallKind==='corridor'?49:64):
    type==='tentacle'?78:type==='fumarole'?120:type==='electric'?46:
    type==='spikes'?56:type==='rockfall'?77:type==='lure'?67:type==='pressure'?95:cfg.radius,
   length:reach||cfg.length||0,
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
   const mount=wallMount(layout,room,i+safeTier*.13,blocked);
   if(mount)add(wallGeometry(layout,mount,type),type,room.id,i);
  }
 }
 // Narrow-path volcanic vents are placed only where corridor walls are real.
 // The hot stream leaves a wide traversable strip and never blocks entrances.
 for(const [i,passage]of (layout.corridors||[]).entries()){
  if(i===0||i%3!==1||Number(passage.width)>195)continue;
  const anchor=corridorMount(layout,passage,i,blocked);
  if(anchor)add(wallGeometry(layout,anchor,'volcano'),'volcano','passage:'+passage.a+'-'+passage.b,i);
 }
 // The only unattached threat lives ACROSS a corridor, exactly where players
 // travel. It spans both sides of the narrow passage instead of a mob room.
 for(const i of [2,5]){
  const corridor=layout.corridors?.[i],path=corridor?.path;
  if(!path||path.length<4)continue;
  const a=path[1],b=path[2],vx=b.x-a.x,vy=b.y-a.y,
    x=(a.x+b.x)*.5,y=(a.y+b.y)*.5,angle=Math.atan2(vy,vx);
  if(blocked.some(p=>Math.hypot(p.x-x,p.y-y)<p.r+120))continue;
  const halfWidth=Math.max(110,Number(corridor.width)||150);
  add({x,y,angle,passageWidth:halfWidth,axialRadius:Math.min(165,Math.hypot(vx,vy)*.48),
    acrossRadius:halfWidth*.985,wallKind:'passage-floor'},
    'vortex','passage:'+corridor.a+'-'+corridor.b,i+1000);
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
 if(h.type==='fumarole'&&s?.phase==='active')return Math.max(20,(h.maxReach||h.radius)*(s.progress*.98+.02));
 if(h.type==='vortex'&&s?.phase==='active')return Math.max(24,(h.acrossRadius||h.radius)*Math.min(1,(s.progress+.10)*2.15));
 return h.radius;
}
function hit(hazard,px,py,pad=0,phase=null){
 const h=hazardAtCycle(hazard,phase?.cycle||0),r=dangerRadius(h,phase)+pad;
 if(phase?.phase==='idle'||phase?.phase==='warning')return false;
 if(h.type==='vortex'){
  const cs=Math.cos(h.angle),sn=Math.sin(h.angle),dx=px-h.x,dy=py-h.y;
  const along=dx*cs+dy*sn,across=-dx*sn+dy*cs;
  const scale=phase?Math.min(1,(phase.progress+.10)*2.15):1;
  return (along/(Math.max(22,(h.axialRadius||h.radius)*scale)+pad))**2+
    (across/(Math.max(22,(h.acrossRadius||h.radius)*scale)+pad))**2<=1;
 }
 if(h.type==='fumarole'&&h.poisonRays?.length){
  const ox=h.poisonOriginX,oy=h.poisonOriginY,dx=px-ox,dy=py-oy,dist=Math.hypot(dx,dy);
  if(dist<=pad+10)return true;
  const da=Math.atan2(Math.sin(Math.atan2(dy,dx)-h.angle),Math.cos(Math.atan2(dy,dx)-h.angle));
  if(Math.abs(da)>Math.PI*.495)return false;
  const index=(da/Math.PI+.495)/.99*(h.poisonRays.length-1);
  const lo=Math.max(0,Math.floor(index)),hi=Math.min(h.poisonRays.length-1,lo+1);
  // Conservative interpolation avoids the visual cloud crossing stone corners.
  const safeLen=Math.min(h.poisonRays[lo].length,h.poisonRays[hi].length);
  const fraction=phase?(.04+.96*clamp(phase.progress,0,1)):1;
  return dist<=safeLen*fraction+pad;
 }
 if(Number.isFinite(h.sourceX)&&['volcano','tentacle','spikes','electric'].includes(h.type)){
  if(h.type==='tentacle'&&phase&&(phase.progress<.175||phase.progress>.31))return false;
  const extent=(h.type==='spikes'||h.type==='tentacle')?extension(h,phase):1;
  const length=(h.length||130)*extent;
  if(length<1)return false;
  const ax=h.sourceX+Math.cos(h.angle)*6,ay=h.sourceY+Math.sin(h.angle)*6;
  const bx=h.sourceX+Math.cos(h.angle)*length,by=h.sourceY+Math.sin(h.angle)*length;
  return segmentDistance(px,py,ax,ay,bx,by)<=h.radius*(h.type==='spikes'?.40:.5)+pad;
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
 // Volcano is not a separate boulder: it is a hot fracture INSIDE the cave wall.
 const live=s.phase==='active',warm=s.phase==='warning';
 c.save();c.translate(h.sourceX,h.sourceY);c.rotate(h.angle);
 const glow=live?.85:warm?.15+.54*s.progress:.06;
 const fissure=c.createRadialGradient(-8,0,2,-9,0,65);
 fissure.addColorStop(0,'rgba(1,5,10,.96)');
 fissure.addColorStop(.52,'rgba(6,18,25,.66)');
 fissure.addColorStop(1,'rgba(12,36,43,0)');
 c.fillStyle=fissure;c.beginPath();c.ellipse(-13,0,42,32,0,0,Math.PI*2);c.fill();
 // Black mineral cracks run out into the geology with NO enclosing silhouette.
 c.lineWidth=3;c.lineCap='round';c.strokeStyle='rgba(1,8,14,.83)';
 for(const sign of [-1,1]){
  c.beginPath();c.moveTo(-44,sign*37);c.bezierCurveTo(-31,sign*27,-9,sign*24,6,sign*11);
  c.quadraticCurveTo(11,sign*8,17,sign*3);c.stroke();
  c.strokeStyle='rgba(220,111,66,'+(glow*.58)+')';c.lineWidth=1.7;c.stroke();
 }
 // An irregular slit is recessed in the wall; its edge is unoutlined.
 c.fillStyle='rgba(0,3,9,.94)';c.beginPath();
 c.moveTo(-17,-9);c.quadraticCurveTo(13,-20,23,-3);
 c.lineTo(13,6);c.quadraticCurveTo(-12,17,-17,-9);c.fill();
 if(warm||live){
  const light=c.createRadialGradient(0,0,1,0,0,29);
  light.addColorStop(0,'rgba(255,211,137,'+glow+')');
  light.addColorStop(.45,'rgba(249,124,62,'+(glow*.65)+')');
  light.addColorStop(1,'rgba(255,84,32,0)');
  c.fillStyle=light;c.beginPath();c.ellipse(3,0,30,21,0,0,Math.PI*2);c.fill();
 }
 if(live){
  const len=h.length,half=h.radius*.5;
  const jet=c.createLinearGradient(0,0,len,0);
  jet.addColorStop(0,'rgba(255,235,177,.95)');
  jet.addColorStop(.09,'rgba(255,160,74,.86)');
  jet.addColorStop(.53,'rgba(251,111,44,.72)');
  jet.addColorStop(.88,'rgba(234,85,31,.59)');
  jet.addColorStop(1,'rgba(255,162,82,.37)');
  c.strokeStyle=jet;c.lineWidth=half*1.5;c.lineCap='round';
  c.shadowColor='#ef6b2b';c.shadowBlur=12;c.beginPath();c.moveTo(12,0);
  const wave=Math.sin(t*.013)*5;
  c.bezierCurveTo(len*.25,-7+wave,len*.7,6-wave*.8,len-7,0);c.stroke();
  c.shadowBlur=0;c.strokeStyle='rgba(255,217,153,.79)';c.lineWidth=half*.50;c.stroke();
  // Spitting pressure jets, not a static flat orange rectangle.
  for(let i=0;i<16;i++){
   const q=(i*.136+t*.0006)%1,xx=14+q*(len-18);
   const yy=Math.sin(i*2.57+t*.009)*half*(.12+.65*q);
   c.globalAlpha=.3+.53*(1-q*.5);
   paintedCircle(c,xx,yy,1.5+i%4,i%3?'#ffb672':'#fff0bd');
  }
  // Fire splashes on the far wall: particles fan out along the rock face.
  c.globalAlpha=.8;c.lineCap='round';
  for(let i=0;i<24;i++){
   const a=-1.23+i/23*2.46,spread=(7+(i%7)*6)*( .64+.36*Math.sin(t*.012+i));
   const bx=len-8,by=0,px=bx+Math.cos(a)*spread*.34,py=by+Math.sin(a)*spread;
   c.strokeStyle=i%3?'rgba(255,162,85,.75)':'rgba(255,231,166,.78)';
   c.lineWidth=1.3+i%3;c.beginPath();c.moveTo(bx,by);c.lineTo(px,py);c.stroke();
   paintedCircle(c,px,py,1.5+i%3,'rgba(255,184,95,.66)');
  }
 }
 c.restore();
}
function poisonousAnemone(c,h,s,t){
 wallSeam(c,h,t,'#8fe58c',s,.76);
 const active=s.phase==='active',warm=s.phase==='warning';
 c.save();c.translate(h.sourceX,h.sourceY);c.rotate(h.angle);
 const pulse=Math.sin(t*.0045);
 for(let i=0;i<11;i++){
  const side=i%2?-1:1,rank=Math.floor(i/2),len=18+rank*4;
  const y=side*(3+rank*3),end=10+len*.7;
  c.beginPath();c.moveTo(-12,y*.4);
  c.bezierCurveTo(2,side*(14+rank*1.7),end*.66,side*(20+rank*3)+pulse*2,end,side*(20+rank*3)+pulse*3);
  c.lineWidth=i%3===0?2.8:2.1;c.lineCap='round';
  c.strokeStyle=i%3===0?'rgba(111,182,132,.62)':'rgba(48,130,120,.62)';c.stroke();
  if(warm||active){c.globalAlpha=warm?.25+s.progress*.42:.68;c.strokeStyle=i%3===0?'#a7ff78':'#78dba2';c.lineWidth=.8;c.stroke();c.globalAlpha=1;}
  paintedCircle(c,end,side*(20+rank*3)+pulse*3,1.3+(i%2)*.4,warm||active?'rgba(156,247,134,.78)':'rgba(64,142,135,.36)');
 }
 c.restore();
 if(!active||!h.poisonRays?.length)return;
 const ox=h.poisonOriginX,oy=h.poisonOriginY,fraction=.04+.96*clamp(s.progress,0,1);
 const radius=(h.maxReach||320)*fraction;
 c.save();
 // Fill the entire open, connected water fan. The far contour follows actual
 // raycasts against cave walls, so no cloud is painted through solid rock.
 c.beginPath();c.moveTo(ox,oy);
 for(const ray of h.poisonRays){
  const len=ray.length*fraction;
  c.lineTo(ox+Math.cos(ray.angle)*len,oy+Math.sin(ray.angle)*len);
 }
 c.closePath();
 const cloud=c.createRadialGradient(ox,oy,3,ox,oy,Math.max(8,radius));
 cloud.addColorStop(0,'rgba(116,226,107,.29)');
 cloud.addColorStop(.33,'rgba(83,198,116,.22)');
 cloud.addColorStop(.76,'rgba(49,151,128,.17)');
 cloud.addColorStop(1,'rgba(45,134,127,.08)');
 c.fillStyle=cloud;c.fill();
 // A visible irregular advancing frontier travels until it reaches stone.
 c.strokeStyle='rgba(145,244,122,.30)';c.lineWidth=1.9;c.stroke();
 // Anêmona Tóxica spores and translucent smoke, strictly inside the traced fan.
 for(let i=0;i<30;i++){
  const ray=h.poisonRays[(i*11)%h.poisonRays.length];
  const q=.13+((i*7)%17)/19,reach=ray.length*fraction*q;
  const x=ox+Math.cos(ray.angle)*reach,y=oy+Math.sin(ray.angle)*reach;
  c.globalAlpha=.16+(i%5)*.08;c.fillStyle=i%3?'#75db95':'#c3fc8c';
  c.beginPath();c.ellipse(x,y,1.5+(i%4),1+(i%3),ray.angle,0,Math.PI*2);c.fill();
 }
 c.restore();
}
function deepCurrentPit(c,h,s,t){
 // A cross-passage hydraulic sink. Its outer ellipse touches both rock walls
 // while its central void follows the corridor direction.
 const rx=h.axialRadius||165,ry=h.acrossRadius||h.radius;
 c.save();c.translate(h.x,h.y);c.rotate(h.angle||0);
 const pit=c.createRadialGradient(-rx*.14,-ry*.09,3,0,0,Math.max(rx,ry)*1.05);
 pit.addColorStop(0,'rgba(0,3,10,.98)');
 pit.addColorStop(.4,'rgba(1,13,24,.96)');
 pit.addColorStop(.78,'rgba(6,30,43,.87)');
 pit.addColorStop(.97,'rgba(24,66,77,.61)');
 pit.addColorStop(1,'rgba(12,34,48,.04)');
 c.fillStyle=pit;c.beginPath();c.ellipse(0,0,rx,ry,0,0,Math.PI*2);c.fill();
 c.strokeStyle='rgba(72,133,150,.28)';c.lineWidth=2;
 for(let i=0;i<3;i++){
  const q=.43+i*.21;c.beginPath();c.ellipse(0,0,rx*q,ry*q,0,0,Math.PI*2);c.stroke();
 }
 if(s.phase==='warning'){
  // The bubbles wake first, then pop: the siphon does not activate instantly.
  for(let i=0;i<22;i++){
   const q=(i*.17+s.progress*.96)%1,a=i*2.399+t*.00016;
   const px=Math.cos(a)*rx*(.19+.60*(1-q)),py=Math.sin(a)*ry*(.19+.60*(1-q));
   const bubbleR=3+8*q;
   c.globalAlpha=(1-q)*.77;
   c.strokeStyle=i%3?'#8ad2de':'#d9eff4';c.lineWidth=1.4;
   c.beginPath();c.arc(px,py,bubbleR,0,Math.PI*2);c.stroke();
   if(q>.82)for(let j=0;j<4;j++){
    const theta=j*Math.PI*.5;
    c.beginPath();c.moveTo(px+Math.cos(theta)*bubbleR,py+Math.sin(theta)*bubbleR);
    c.lineTo(px+Math.cos(theta)*(bubbleR+5),py+Math.sin(theta)*(bubbleR+5));c.stroke();
   }
  }
 }else if(s.phase==='active'){
  const scale=Math.min(1,(s.progress+.10)*2.15);
  c.globalAlpha=.23;c.fillStyle='#0c5e80';
  c.beginPath();c.ellipse(0,0,rx*scale,ry*scale,0,0,Math.PI*2);c.fill();
  c.globalAlpha=.84;c.lineCap='round';
  for(let i=0;i<5;i++){
   const q=.2+i*.16;
   c.beginPath();c.ellipse(0,0,rx*q*scale,ry*q*scale,t*.0015+i*.4,-2.7,2.3);
   c.strokeStyle=i%2?'#7cbcca':'#c3e8ef';c.lineWidth=3-i*.35;c.stroke();
  }
  for(let i=0;i<18;i++){
   const angle=i*2.399+t*.0027,q=.18+(i%8)*.098;
   paintedCircle(c,Math.cos(angle)*rx*q*scale,Math.sin(angle)*ry*q*scale,
    1.5+(i%4),'rgba(170,223,232,.73)');
  }
  c.fillStyle='#01050e';c.beginPath();c.ellipse(0,0,rx*.22*scale,ry*.23*scale,0,0,Math.PI*2);c.fill();
 }
 c.restore();
}
function tentacleTrap(c,original,s,t){
 const h=hazardAtCycle(original,s.cycle),length=h.length||240,r=h.radius;
 if(!Number.isFinite(h.sourceX))return;
 c.save();c.translate(h.sourceX,h.sourceY);c.rotate(h.angle);
 // It lives in a recessed DARK opening. No purple spawn icon or warning halo.
 const mouth=c.createRadialGradient(-11,0,2,-11,0,42);
 mouth.addColorStop(0,'rgba(0,0,6,.98)');
 mouth.addColorStop(.45,'rgba(1,7,15,.95)');
 mouth.addColorStop(.84,'rgba(5,22,32,.5)');
 mouth.addColorStop(1,'rgba(4,22,30,0)');
 c.fillStyle=mouth;c.beginPath();c.ellipse(-12,0,47,38,0,0,Math.PI*2);c.fill();
 c.strokeStyle='rgba(32,70,82,.42)';c.lineWidth=2;c.beginPath();
 c.ellipse(-9,0,26,22,0,-2.4,2.4);c.stroke();
 // Keep red localized to the impact warning, not to the origin of the tentacle.
 if(s.phase==='warning'&&s.progress>.65){
  c.globalAlpha=.18+.20*(s.progress-.65)/.35;c.fillStyle='#ff2b51';
  c.strokeStyle='rgba(255,65,92,.77)';c.lineWidth=2.2;
  c.beginPath();c.roundRect(8,-r*.47,length-8,r*.94,r*.43);c.fill();c.stroke();
 }
 if(s.phase==='active'){
  const reach=extension(h,s),tip=Math.max(2,reach*length);
  const sway=Math.sin(t*.006)*r*.14;
  if(reach>.025){
   // Downstroke comes forward out of the hole, then retracts in a slow
   // continuous animation. A tapered translucent body and suckers belong
   // to the same root, not a sprite that blinks into the middle of the map.
   const grad=c.createLinearGradient(0,-r*.37,0,r*.37);
   grad.addColorStop(0,'rgba(198,143,240,.61)');
   grad.addColorStop(.23,'rgba(116,51,165,.82)');
   grad.addColorStop(.73,'rgba(61,24,105,.86)');
   grad.addColorStop(1,'rgba(190,125,227,.65)');
   c.lineCap='round';c.strokeStyle='rgba(15,4,40,.70)';
   c.lineWidth=r*.84;c.beginPath();c.moveTo(-1,0);
   c.bezierCurveTo(tip*.34,-r*.17,tip*.66,sway,tip,0);c.stroke();
   c.strokeStyle=grad;c.lineWidth=r*.69;c.shadowColor='#8e3cba';c.shadowBlur=9;c.stroke();
   c.shadowBlur=0;
   c.strokeStyle='rgba(232,181,250,.43)';c.lineWidth=r*.11;
   c.beginPath();c.moveTo(7,-r*.2);
   c.bezierCurveTo(tip*.34,-r*.35,tip*.68,sway-r*.15,tip,-r*.06);c.stroke();
   // Double lines of translucent suckers, tapering near the tip.
   for(let i=1;i<Math.max(2,Math.floor(17*reach));i++){
    const q=i/18,x=q*tip,base=Math.sin(q*Math.PI)*r*.32;
    for(const sign of [-1,1]){
     c.beginPath();c.ellipse(x,sign*base+sway*q*.34,Math.max(1,3.7*(1-q)),Math.max(1,2.1*(1-q)),0,0,Math.PI*2);
     c.fillStyle='rgba(235,178,244,.58)';c.fill();
     c.strokeStyle='rgba(66,23,99,.46)';c.lineWidth=.8;c.stroke();
    }
   }
  }
 }
 c.restore();
}
function rockfallTrap(c,h,s,t){
 wallSeam(c,h,t,'#7a9da8',s,.92);
 if(s.phase==='idle')return;
 const x=h.x,y=h.y,r=h.radius;
 c.save();
 if(s.phase==='warning'){
  // Fine loose silt and hairline cracks in the wall warn of rock fragments.
  c.globalAlpha=.24+.32*s.progress;
  for(let i=0;i<11;i++){
   const a=i*2.399,rr=r*(.2+.65*((i*3%11)/11));
   paintedCircle(c,x+Math.cos(a)*rr,y+Math.sin(a)*rr,
    1.5+(i%3)*.9,'#79989e');
  }
 }else{
  for(let i=0;i<8;i++){
   const a=i*2.399+t*.0002,rr=r*(.16+.63*(i%7)/7);
   const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;
   const size=5+(i%4)*3;
   c.globalAlpha=.48+(i%3)*.12;c.fillStyle=i%3?'#1b3643':'#294c57';
   c.strokeStyle='rgba(95,151,163,.58)';c.lineWidth=1.1;
   c.beginPath();c.moveTo(px-size,py);c.lineTo(px-size*.3,py-size*.7);
   c.lineTo(px+size*.55,py-size*.35);c.lineTo(px+size*.9,py+size*.44);
   c.lineTo(px-size*.35,py+size*.7);c.closePath();c.fill();c.stroke();
  }
 }
 c.restore();
}
function supplementalTrap(c,h,s,t){
 if(!Number.isFinite(h.sourceX))return;
 const warm=s.phase==='warning',live=s.phase==='active';
 const color=h.type==='spikes'?'#8caaa9':h.type==='pressure'?'#74bfd5':
   h.type==='electric'?'#80d6dc':'#80d5c0';
 wallSeam(c,h,t,color,s,.84);
 c.save();c.translate(h.sourceX,h.sourceY);c.rotate(h.angle);
 if(h.type==='spikes'){
  // Wall-to-wall fossil spikes: fast lunge, then retreat slowly.
  const reach=extension(h,s),long=h.length*reach;
  // Dormant wall hole and serrated roots remain small and subtle.
  c.strokeStyle='rgba(61,114,123,.48)';c.lineCap='round';
  for(let i=0;i<5;i++){
   const y=(i-2)*10;c.lineWidth=1.8;c.beginPath();c.moveTo(-16,y);
   c.lineTo(10,y+(i%2?3:-3));c.stroke();
  }
  if(s.phase==='warning'){
   c.strokeStyle='rgba(153,200,194,.48)';c.lineWidth=1.5;
   for(let i=-2;i<=2;i++){const y=i*10;c.beginPath();c.moveTo(0,y);
    c.lineTo(22+s.progress*16,y+Math.sin(i)*3);c.stroke();}
  }
  if(reach>.01&&s.phase==='active'){
   // Three parallel sharp ribs share one anchored body and one collision lane.
   for(let row=-1;row<=1;row++){
    const off=row*14,tip=Math.max(1,long-(Math.abs(row)*12));
    const g=c.createLinearGradient(0,off,tip,off);
    g.addColorStop(0,'rgba(34,74,81,.95)');
    g.addColorStop(.55,'rgba(81,148,151,.87)');
    g.addColorStop(1,'rgba(193,222,212,.89)');
    c.fillStyle=g;c.strokeStyle='rgba(127,196,192,.66)';c.lineWidth=1.4;
    c.beginPath();c.moveTo(-7,off-5);
    c.lineTo(tip*.64,off-4);c.lineTo(tip,off);
    c.lineTo(tip*.64,off+4);c.lineTo(-7,off+5);
    c.closePath();c.fill();c.stroke();
    for(let i=1;i<=Math.floor(12*reach);i++){
     const x=tip*i/13,y=off,spur=7+3*(i%3);
     for(const side of [-1,1]){
      c.beginPath();c.moveTo(x-4,y);c.lineTo(x-13,y+side*spur);
      c.lineTo(x+4,y+side*.5);c.closePath();
      c.fillStyle='rgba(102,159,157,.62)';c.fill();
     }
    }
   }
   c.shadowBlur=5;c.shadowColor='#8ed4cb';
   c.lineWidth=2;c.strokeStyle='rgba(200,234,227,.51)';
   c.beginPath();c.moveTo(5,0);c.lineTo(long,0);c.stroke();c.shadowBlur=0;
  }
 }else if(h.type==='pressure'){
  // Pressure bulges out of a veined vent, not a floor-sized blue indicator.
  for(let i=0;i<6;i++){
   const a=-1.15+i*.46,xx=18+Math.cos(a)*19,yy=Math.sin(a)*27;
   c.strokeStyle='rgba(74,144,161,.37)';c.lineWidth=2;
   c.beginPath();c.moveTo(-5,yy*.3);c.quadraticCurveTo(9,yy*.6,xx,yy);c.stroke();
  }
  if(warm||live){
   c.save();c.globalAlpha=live?.4:.18+.1*s.progress;
   c.lineWidth=live?2.4:1.1;c.strokeStyle=live?'#b1e3ef':'#7faebc';
   for(let i=0;i<3;i++){
    const rr=h.radius*(.26+i*.2);
    c.beginPath();c.arc(h.length*.52,0,rr,-Math.PI*.56,Math.PI*.56);c.stroke();
   }
   c.restore();
  }
 }else if(h.type==='lure'){
  // A little anemone-like angler lure projecting from a crevice.
  const pulse=Math.sin(t*.0043),px=24+Math.sin(t*.0018)*3,py=-15+pulse*4;
  c.lineCap='round';c.strokeStyle='rgba(74,152,155,.55)';c.lineWidth=2;
  c.beginPath();c.moveTo(-8,0);c.quadraticCurveTo(16,-34,px,py);c.stroke();
  c.shadowColor='#8de5d6';c.shadowBlur=warm?12:6;
  paintedCircle(c,px,py,3.2,live?'rgba(124,225,204,.1)':'rgba(127,229,212,.76)');
  c.shadowBlur=0;
  if(warm){
   c.globalAlpha=.4;c.strokeStyle='#8de5d6';c.lineWidth=1;
   c.beginPath();c.arc(px,py,13+s.progress*17,0,Math.PI*2);c.stroke();
  }
  if(live){
   const core=c.createRadialGradient(h.length*.5,0,3,h.length*.5,0,h.radius);
   core.addColorStop(0,'rgba(2,6,17,.66)');
   core.addColorStop(.55,'rgba(23,57,68,.25)');
   core.addColorStop(1,'rgba(4,23,30,0)');
   c.fillStyle=core;c.beginPath();c.arc(h.length*.5,0,h.radius,0,Math.PI*2);c.fill();
   c.globalAlpha=.48;c.strokeStyle='#91c0c5';c.lineWidth=1.6;
   for(let i=0;i<6;i++){
    const a=-1.2+i*.48;
    c.beginPath();c.moveTo(18,Math.sin(a)*9);
    c.quadraticCurveTo(45,Math.sin(a)*29,62,Math.sin(a)*41);c.stroke();
   }
  }
 }else if(h.type==='electric'){
  // Thin bioluminescent filaments on a fissure rather than two loose pylons.
  for(let i=0;i<5;i++){
   const side=i%2?-1:1,out=15+i*3,dy=side*(7+i*5);
   c.strokeStyle='rgba(68,146,155,.46)';c.lineWidth=1.4;
   c.beginPath();c.moveTo(-8,dy*.6);c.quadraticCurveTo(out*.35,dy*.8,out,dy);c.stroke();
  }
  if(warm||live){
   const len=h.length;
   c.strokeStyle=live?'rgba(182,240,240,.82)':'rgba(94,180,195,.44)';
   c.lineWidth=live?2.4:1.1;c.lineCap='round';
   c.shadowColor='#8bddde';c.shadowBlur=live?11:3;
   c.beginPath();for(let i=0;i<=16;i++){
    const q=i/16,bend=Math.sin(t*.012+i*2.47)*h.radius*(live?.25:.08)*(1-Math.abs(q-.5));
    if(i===0)c.moveTo(q*len,bend);else c.lineTo(q*len,bend);
   }c.stroke();c.shadowBlur=0;
  }
 }
 c.restore();
}
function draw(c,hazards,seconds,view){
 if(!Array.isArray(hazards))return;
 for(const original of hazards){
  if(view){
   const extent=Math.max(original.maxReach||0,original.length||0,original.radius||0,160);
   const anchorX=Number.isFinite(original.sourceX)?original.sourceX:original.x;
   const anchorY=Number.isFinite(original.sourceY)?original.sourceY:original.y;
   const endX=original.x,endY=original.y;
   const xmin=Math.min(anchorX,endX)-extent,xmax=Math.max(anchorX,endX)+extent;
   const ymin=Math.min(anchorY,endY)-extent,ymax=Math.max(anchorY,endY)+extent;
   if(xmax<view.x||xmin>view.x+view.w||ymax<view.y||ymin>view.y+view.h)continue;
  }
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
 // PES ADELO ROXO: a monstrous translucent kraken face with a giant body
 // behind the cavern. The former rounded smile is replaced by an angular
 // mantle, predatory eyelids, asymmetric scars and two rows of hooked teeth.
 const x=enemy.x,y=enemy.y,r=enemy.r||154,t=now*.001,pulse=Math.sin(t*1.8);
 c.save();c.translate(x,y);
 const fog=c.createRadialGradient(-r*.14,r*.23,r*.16,0,0,r*4.3);
 fog.addColorStop(0,'rgba(188,73,255,.23)');
 fog.addColorStop(.32,'rgba(77,22,139,.19)');
 fog.addColorStop(.72,'rgba(31,6,67,.11)');
 fog.addColorStop(1,'rgba(16,4,44,0)');
 c.fillStyle=fog;c.beginPath();c.arc(0,0,r*4.3,0,Math.PI*2);c.fill();
 // The obscured torso blends into the sea floor; every arm grows from it.
 for(let i=0;i<10;i++){
  const a=i*Math.PI/5+t*.025,end=r*(2.9+(i%4)*.34),sway=Math.sin(t*.7+i*1.7)*r*.14;
  const rootX=Math.cos(a)*r*.72,rootY=Math.sin(a)*r*.67;
  const tipX=Math.cos(a)*end,tipY=Math.sin(a)*end+sway;
  c.beginPath();c.moveTo(rootX,rootY);
  c.bezierCurveTo(Math.cos(a+.32)*r*1.42,Math.sin(a+.32)*r*1.74,
   Math.cos(a-.38)*r*2.43,Math.sin(a-.38)*r*2.21+sway*.4,tipX,tipY);
  c.strokeStyle='rgba(48,16,97,.28)';c.lineWidth=r*.32;c.lineCap='round';c.stroke();
  c.strokeStyle='rgba(164,80,225,.25)';c.lineWidth=r*.18;c.stroke();
  c.strokeStyle='rgba(228,153,255,.11)';c.lineWidth=r*.034;c.stroke();
 }
 // Jagged cranial horns, visible against the darker purple background.
 for(const side of [-1,1]){
  c.save();c.scale(side,1);
  c.fillStyle='rgba(78,27,122,.91)';c.strokeStyle='rgba(205,124,253,.65)';c.lineWidth=3;
  c.beginPath();c.moveTo(r*.54,-r*.46);c.bezierCurveTo(r*.99,-r*.93,r*1.43,-r*1.35,r*.83,-r*1.64);
  c.quadraticCurveTo(r*.99,-r*1.21,r*.34,-r*.82);c.closePath();c.fill();c.stroke();
  c.beginPath();c.moveTo(r*.71,-r*.05);c.quadraticCurveTo(r*1.36,-r*.44,r*1.38,-r*.13);
  c.quadraticCurveTo(r*1.32,-r*.34,r*.9,r*.47);c.closePath();
  c.fillStyle='rgba(82,28,126,.68)';c.fill();c.stroke();
  c.restore();
 }
 const skin=c.createRadialGradient(-r*.29,-r*.42,r*.10,0,0,r*1.35);
 skin.addColorStop(0,'rgba(233,158,253,.89)');
 skin.addColorStop(.26,'rgba(145,72,213,.83)');
 skin.addColorStop(.62,'rgba(75,32,147,.88)');
 skin.addColorStop(.91,'rgba(36,12,84,.92)');
 skin.addColorStop(1,'rgba(18,6,47,.85)');
 c.shadowColor='#aa50db';c.shadowBlur=22;c.fillStyle=skin;
 c.strokeStyle='rgba(199,128,242,.82)';c.lineWidth=4;
 c.beginPath();c.moveTo(-r*.97,r*.16);
 c.bezierCurveTo(-r*1.20,-r*.4,-r*.93,-r*1.15,-r*.15,-r*1.04);
 c.quadraticCurveTo(0,-r*1.24,r*.25,-r*1.09);
 c.bezierCurveTo(r*.98,-r*1.18,r*1.24,-r*.37,r*.96,r*.20);
 c.bezierCurveTo(r*1.03,r*.84,r*.53,r*1.10,0,r*1.15);
 c.bezierCurveTo(-r*.69,r*1.09,-r*1.23,r*.72,-r*.97,r*.16);
 c.closePath();c.fill();c.stroke();c.shadowBlur=0;
 // Large faceted forehead and deep creases, a different species from Kraken.
 c.fillStyle='rgba(202,116,244,.22)';c.beginPath();
 c.moveTo(-r*.71,-r*.48);c.quadraticCurveTo(0,-r*1.12,r*.65,-r*.47);
 c.quadraticCurveTo(.0,-r*.69,-r*.71,-r*.48);c.fill();
 for(const side of [-1,1]){
  c.save();c.scale(side,1);
  c.strokeStyle='rgba(34,10,77,.70)';c.lineWidth=6;c.lineCap='round';
  c.beginPath();c.moveTo(r*.18,-r*.89);c.quadraticCurveTo(r*.29,-r*.60,r*.86,-r*.46);c.stroke();
  c.beginPath();c.moveTo(r*.30,-r*.69);c.quadraticCurveTo(r*.50,-r*.60,r*.81,-r*.22);c.stroke();
  // Angled eye cavity gives it a frightening expression, not a cheerful cartoon.
  c.fillStyle='#110522';c.beginPath();
  c.moveTo(r*.11,-r*.35);c.quadraticCurveTo(r*.40,-r*.65,r*.82,-r*.39);
  c.quadraticCurveTo(r*.71,-r*.02,r*.37,-r*.07);c.closePath();c.fill();
  c.fillStyle='#f4c4ff';c.shadowColor='#db7cff';c.shadowBlur=14;
  c.beginPath();c.ellipse(r*.47,-r*.29,r*.14,r*.17,side*.18,0,Math.PI*2);c.fill();
  c.fillStyle='#2e0a56';c.shadowBlur=0;c.beginPath();
  c.ellipse(r*.50,-r*.29,r*.055,r*.112,side*.18,0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(248,179,255,.78)';c.lineWidth=3;
  c.beginPath();c.moveTo(r*.15,-r*.47);c.quadraticCurveTo(r*.46,-r*.66,r*.84,-r*.41);c.stroke();
  c.restore();
 }
 // Irregular scars and runic bioluminescent fissures across the upper mantle.
 c.strokeStyle='rgba(238,161,255,.60)';c.lineWidth=2.7;
 c.beginPath();c.moveTo(-r*.13,-r*.92);c.lineTo(-r*.24,-r*.66);
 c.lineTo(-r*.06,-r*.55);c.lineTo(-r*.19,-r*.25);c.stroke();
 c.strokeStyle='rgba(96,38,160,.62)';c.lineWidth=5;
 c.beginPath();c.moveTo(r*.14,-r*.87);c.lineTo(r*.10,-r*.61);c.lineTo(r*.27,-r*.51);c.stroke();
 // A gaping predatory rictus, not a happy crescent. Ivory fangs have staggered
 // lengths and dark pockets between them, supported by a distinct lower jaw.
 c.fillStyle='#080316';c.strokeStyle='#b25de0';c.lineWidth=4.4;
 c.beginPath();c.moveTo(-r*.82,r*.21);
 c.bezierCurveTo(-r*.58,r*.43,-r*.37,r*.35,0,r*.45);
 c.bezierCurveTo(r*.36,r*.36,r*.63,r*.32,r*.81,r*.18);
 c.bezierCurveTo(r*.75,r*.70,r*.36,r*1.02,0,r*.99);
 c.bezierCurveTo(-r*.43,r*1.02,-r*.76,r*.74,-r*.82,r*.21);
 c.closePath();c.fill();c.stroke();
 c.fillStyle='rgba(114,25,130,.56)';c.beginPath();c.ellipse(0,r*.78,r*.45,r*.17,0,0,Math.PI*2);c.fill();
 for(let i=0;i<15;i++){
  const x=(-.71+i*.101)*r,edge=Math.abs(i-7)/7,topY=(.39+.10*edge)*r;
  const toothLength=(.15+(i%4)*.064+(1-edge)*.045)*r;
  c.fillStyle=i%3?'#f1e3ff':'#fef4ff';
  c.beginPath();c.moveTo(x-r*.044,topY);
  c.lineTo(x+r*.041,topY+r*.008);c.lineTo(x-r*.015,topY+toothLength);
  c.closePath();c.fill();
 }
 for(let i=0;i<13;i++){
  const x=(-.64+i*.107)*r,edge=Math.abs(i-6)/6,bottomY=(.91-.12*edge)*r;
  const toothLength=(.10+(i%4)*.042)*r;
  c.fillStyle='#f4daff';c.beginPath();c.moveTo(x-r*.042,bottomY);
  c.lineTo(x+r*.043,bottomY);c.lineTo(x+.011*r,bottomY-toothLength);
  c.closePath();c.fill();
 }
 // Breathing and flickering cheek veins are subtle; the silhouette remains crisp.
 c.globalAlpha=.45+.16*pulse;c.strokeStyle='#d896f7';c.lineWidth=2;
 for(const side of [-1,1]){
  c.beginPath();c.moveTo(side*r*.76,r*.13);
  c.quadraticCurveTo(side*r*.93,r*.48,side*r*.66,r*.71);c.stroke();
 }
 c.restore();
}
return {FINAL_TIER,FINAL_KIND,FINAL_CHEST_COINS,TYPES,build,state,hit,checkpoint,draw,bossMark,bossHit,drawBossMark,drawFinalBoss};
});