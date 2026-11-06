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
 const h=hazardAtCycle(original,s.cycle),length=h.length||240,r=h.radius;
 wallSeam(c,h,t,'#a679c3',s,1.0);
 if(!Number.isFinite(h.sourceX))return;
 c.save();c.translate(h.sourceX,h.sourceY);c.rotate(h.angle);
 if(s.phase==='warning'||s.phase==='active'){
  // Only tentacles use the red footprint. It begins at the fissure and
  // precisely shares the same axis and width as the server-side hit segment.
  c.beginPath();c.roundRect(0,-r*.5,length,r,Math.max(10,r*.30));
  c.fillStyle=s.phase==='warning'?'rgba(255,34,60,'+(.09+.13*s.progress)+')':'rgba(211,73,128,.24)';
  c.strokeStyle=s.phase==='warning'?'rgba(255,62,79,.88)':'rgba(233,152,201,.64)';
  c.lineWidth=s.phase==='warning'?2.2:1.5;
  c.shadowColor='#ff4665';c.shadowBlur=6;c.fill();c.stroke();c.shadowBlur=0;
 }
 if(s.phase==='active'){
  // A translucent serpent arm slides out of the crack. Tip stays inside the mark.
  const sway=Math.sin(t*.007)*r*.10;
  c.lineCap='round';c.strokeStyle='rgba(71,25,97,.89)';c.lineWidth=r*.53;
  c.shadowColor='#a35cbe';c.shadowBlur=10;
  c.beginPath();c.moveTo(0,0);c.bezierCurveTo(length*.3,sway,length*.63,-sway*.6,length-7,0);c.stroke();
  c.strokeStyle='rgba(174,117,204,.76)';c.lineWidth=r*.17;c.shadowBlur=2;c.stroke();c.shadowBlur=0;
  for(let i=1;i<=11;i++){
   const xx=length*i/12,yy=Math.sin(i*.6+t*.006)*r*.08;
   c.fillStyle='rgba(197,162,214,.56)';c.beginPath();c.ellipse(xx,yy,2.1,1.5,0,0,Math.PI*2);c.fill();
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
  // Fossilized coral is a woven, low-profile growth in the wall.
  for(let i=0;i<9;i++){
   const side=i%2?-1:1,rank=Math.floor(i/2),out=16+rank*9,spread=side*(7+rank*6);
   c.strokeStyle=live?'rgba(176,212,204,.86)':'rgba(60,121,127,.52)';
   c.lineWidth=1.8+(i%3)*.5;c.lineCap='round';c.beginPath();
   c.moveTo(-6,spread*.45);c.quadraticCurveTo(out*.6,spread*.4,out,spread*(live?1.4:warm?1.1:1));c.stroke();
   c.strokeStyle=live?'rgba(173,227,212,.59)':'rgba(61,121,120,.42)';
   c.beginPath();c.moveTo(out-7,spread*.73);
   c.lineTo(out+(live?22:warm?10:2),spread*(live?1.52:1.15));c.stroke();
  }
  if(warm||live){
   c.globalAlpha=live?.37:.11+.15*s.progress;c.fillStyle='#b0dcd3';
   c.beginPath();c.ellipse(37,0,h.radius*.64,h.radius*.58,0,0,Math.PI*2);c.fill();
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