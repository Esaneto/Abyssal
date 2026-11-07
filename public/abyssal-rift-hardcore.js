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
const hazardGeometry=new WeakMap();
const tentacleCycleCache=new WeakMap();
const TYPES=Object.freeze({
  volcano:{name:'VULCÃO ABISSAL',period:10.5,warning:1.65,active:2.15,radius:100,damage:24,color:'#ff7341'},
  fumarole:{name:'FUMAROLA TÓXICA',period:11.8,warning:0,active:5.3,radius:120,damage:12,color:'#8feb78'},
  rockfall:{name:'DESMORONAMENTO',period:10.6,warning:.85,active:3.1,radius:37,damage:31,color:'#d2a3a3'},
  tentacle:{name:'TENTÁCULO DA FENDA',period:18.8,warning:3.2,active:9.4,radius:82,length:320,damage:29,color:'#b873ff'},
  pressure:{name:'PRESSÃO ESMAGADORA',period:11.6,warning:1.7,active:2.2,radius:140,damage:20,color:'#8bb7ff'},
  spikes:{name:'CORAL FOSSILIZADO',period:10.8,warning:.75,active:3.7,radius:108,damage:20,color:'#e48b82'},
  vortex:{name:'VÓRTICE DE SUCÇÃO',period:14.5,warning:2.3,active:4.2,radius:155,damage:10,color:'#68a9e5'},
  lure:{name:'ISCA DA MORTE',period:13,warning:.75,active:3.4,radius:132,damage:25,color:'#71eaff'},
  electric:{name:'ARCO BIOELÉTRICO',period:10.2,warning:.9,active:1.4,radius:59,length:300,damage:24,color:'#8bdfff'}
});
// Hazards unlock gradually; tentacles exist only in the Nightmare boss chamber.
const HAZARD_UNLOCK_TIER=Object.freeze({volcano:0,fumarole:1,pressure:2,rockfall:2,spikes:3,electric:4,lure:5,vortex:6,tentacle:FINAL_TIER});
const ALLOCATION=Object.freeze({
  shoal:['volcano','spikes'],trench:['fumarole','rockfall'],lantern:['lure','electric'],
  junction:['pressure','electric'],event:['rockfall','tentacle'],hub:['volcano','pressure'],
  landing:['tentacle','volcano','spikes'],elite:['electric','spikes','tentacle'],
  boss:['tentacle']
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
 if(type==='volcano'||type==='spikes'||type==='tentacle'||type==='rockfall'||type==='electric'){
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
 if(h.type==='tentacle')return q<.33?Math.sin(q/.33*Math.PI*.5):q<.38?1:clamp(1-(q-.38)/.62,0,1);
 return 1;
}

// Top-edge falling rocks only: the cavern must have walkable water beneath the
// chosen ceiling point, and the opposite collision edge is found by raycast.
function ceilingMount(layout,room,index,blocked){
 const offsets=[-.55,.37,-.16,.61,-.36,.14];
 for(let k=0;k<offsets.length;k++){
  const f=offsets[(index+k)%offsets.length],dx=room.rx*f;
  const roofY=room.y-room.ry*Math.sqrt(Math.max(.05,1-f*f));
  const x=room.x+dx,y=roofY+4;
  if(!water(layout,x,y)||!water(layout,x,y+78)||water(layout,x,y-28))continue;
  if(blocked.some(p=>Math.hypot(p.x-x,p.y-y)<p.r))continue;
  const length=traceToWall(layout,x,y,Math.PI*.5,1600);
  if(length<200)continue;
  return {sourceX:x,sourceY:y,angle:Math.PI*.5,wallKind:'ceiling',length};
 }
 return null;
}
function passageCeilingMount(layout,corridor,index,blocked=[]){
  const path=corridor?.path||[];
  if(path.length<3)return null;
  const p=path[Math.min(path.length-2,Math.max(1,Math.floor(path.length*.5)))];
  for(const shift of [0,-28,28,-48,48]){
   const x=p.x+shift,y=p.y;
   if(!water(layout,x,y,12)||blocked.some(q=>Math.hypot(x-q.x,y-q.y)<q.r))continue;
   let roof=y;
   for(let d=12;d<Math.max(80,Number(corridor.width)||180)+190;d+=12)
    if(!water(layout,x,y-d,3)){roof=y-d+12;break;}
   if(roof===y||!water(layout,x,roof+24,10)||!water(layout,x,roof+95,10))continue;
   const length=traceToWall(layout,x,roof,Math.PI*.5,1500);
   if(length<175)continue;
   return {sourceX:x,sourceY:roof,angle:Math.PI*.5,wallKind:'passage-ceiling',length};
  }
  // Most Fossas corridors are vertical shafts and have no horizontal roof
  // across the swim lane. An embedded upper side ledge can shed rocks diagonally
  // downward into that shaft without inventing a floating ceiling.
  const ledge=corridorMount(layout,corridor,index+2700,blocked);
  if(!ledge)return null;
  const horizontal=Math.cos(ledge.angle),vertical=Math.sin(ledge.angle);
  const angle=Math.atan2(.79+Math.max(-.08,vertical*.13),horizontal*.62);
  const reach=traceToWall(layout,ledge.sourceX,ledge.sourceY,angle,1600);
  if(reach<180)return null;
  return {...ledge,angle,length:reach,wallKind:'passage-overhang'};
 }
 function nightmareWallMount(layout,room,index){
 const offsets=[0,.12,-.12,.26,-.26,.41];
 for(const offset of offsets){
  const theta=(index+.50)/8*Math.PI*2+offset;
  const cs=Math.cos(theta),sn=Math.sin(theta),normal=Math.hypot(cs/room.rx,sn/room.ry)||1;
  const sx=room.x+cs*room.rx-cs/room.rx/normal*4;
  const sy=room.y+sn*room.ry-sn/room.ry/normal*4;
  const angle=Math.atan2(room.y-sy,room.x-sx);
  if(!water(layout,sx,sy)||water(layout,sx-Math.cos(angle)*32,sy-Math.sin(angle)*32))continue;
  const reach=traceToWall(layout,sx,sy,angle,2600);
  if(reach<350)continue;
  return {sourceX:sx,sourceY:sy,angle,wallKind:'nightmare',length:reach,nightmare:true};
 }
 return wallMount(layout,room,'nightmare:'+index,[]);
}
function tentaclePath(h,phase=null){
 const full=phase?hazardAtCycle(h,phase.cycle||0):h;
 if(full.curvedPath)return full.curvedPath;
 if(!Number.isFinite(full.sourceX))return [];
 const layout=hazardGeometry.get(full)||hazardGeometry.get(h);
 const angle=full.angle,cs=Math.cos(angle),sn=Math.sin(angle),nx=-sn,ny=cs,len=full.length||260;
 const seed=idHash(full.id+':shape:'+(phase?.cycle||0));
  const shake=((seed%1000)/1000-.5)*2;
  const frequency=2.8+((seed>>>11)%160)/100;
  const amplitude=.60+((seed>>>19)%100)/125;
  const twist=((seed>>>7)%2)?1:-1;
 const focusX=Number.isFinite(full.aimX)?full.aimX:null;
 const focusY=Number.isFinite(full.aimY)?full.aimY:null;
 const targetProjection=focusX===null?0:((focusX-full.sourceX)*nx+(focusY-full.sourceY)*ny);
 const focus=clamp(targetProjection,-Math.min(220,len*.38),Math.min(220,len*.38));
 const points=[];
 for(let j=0;j<=32;j++){
  const t=j/32,along=t*len;
  // Three supple bends plus a late-curve bias toward the player's position.
  const wave=(Math.sin(t*Math.PI*frequency*twist+shake)*.58+Math.sin(t*Math.PI*(frequency*.53+1.2)-shake*1.8)*.42)
     *Math.sin(Math.PI*t)*Math.min(130,len*.18)*amplitude;
  const attraction=focus*Math.exp(-Math.pow((t-.71)/.19,2))*.84;
  let lateral=wave+attraction,x=full.sourceX+cs*along+nx*lateral,y=full.sourceY+sn*along+ny*lateral;
  if(layout&&!water(layout,x,y,3)){
   let scale=.72;
   for(let k=0;k<9;k++,scale*=.7){
    x=full.sourceX+cs*along+nx*lateral*scale;y=full.sourceY+sn*along+ny*lateral*scale;
    if(water(layout,x,y,3))break;
   }
   if(!water(layout,x,y,3)){x=full.sourceX+cs*along;y=full.sourceY+sn*along;}
  }
  points.push({x,y,t});
 }
 full.curvedPath=points;
 return points;
}
function aimTentacle(h,cycle,targetX,targetY){
 if(!h||h.type!=='tentacle')return null;
 const derived=hazardAtCycle(h,cycle);
 if(derived.aimed)return {id:h.id,cycle,aimX:derived.aimX,aimY:derived.aimY};
 derived.aimX=targetX!=null&&Number.isFinite(Number(targetX))?Number(targetX):null;
 derived.aimY=targetY!=null&&Number.isFinite(Number(targetY))?Number(targetY):null;
 derived.aimed=true;derived.curvedPath=null;
 tentaclePath(h,{cycle});
 return {id:h.id,cycle,aimX:derived.aimX,aimY:derived.aimY};
}
function suctionRadius(h,t){
 return Math.max(4,h.radius*(.82*Math.pow(1-clamp(t,0,1),.76)+.075));
}
function rockfallState(h,phase){
 const seconds=phase.phase==='active'?phase.progress*h.active:0;
 const fallDuration=Math.max(.38,(h.length||520)/280);
 const progress=clamp(seconds/fallDuration,0,1),impact=seconds>=fallDuration;
 return {x:h.sourceX+Math.cos(h.angle)*h.length*progress,
  y:h.sourceY+Math.sin(h.angle)*h.length*progress,
  impact,fade:impact?clamp(1-(seconds-fallDuration)/.65,0,1):1,progress};
}
function targetNearest(h,players,layout=null){
 const pool=(players||[]).filter(p=>p?.alive!==false&&Number.isFinite(Number(p?.x))&&
  (!layout||!h.nightmare||MapGeometry?.roomAt(layout,Number(p.x),Number(p.y))?.id==='boss'));
 if(!pool.length)return null;
 let best=null,dist=Infinity;
 for(const p of pool){
  const d=Math.hypot(p.x-h.x,p.y-h.y);
  if(d<dist){dist=d;best=p;}
 }
 return best;
}
function hazardAtCycle(h,cycle=0){
 if(h.type!=='tentacle')return h;
 const map=hazardGeometry.get(h);
 const epoch=Math.floor(Number(cycle)||0);
 let entries=tentacleCycleCache.get(h);
 if(!entries){entries=new Map();tentacleCycleCache.set(h,entries);}
 if(entries.has(epoch))return entries.get(epoch);
 const jitter=(idHash(h.id+':sweep:'+epoch)%1000)/1000-.5;
 let result;
 if(Number.isFinite(h.sourceX)){
  const angle=h.angle+jitter*.42;
  const length=map?traceToWall(map,h.sourceX,h.sourceY,angle,2600):h.length||240;
  result={...h,angle,length,x:h.sourceX+Math.cos(angle)*length*.5,y:h.sourceY+Math.sin(angle)*length*.5};
 }else result={...h,x:h.x+jitter*40,y:h.y+jitter*22,angle:h.angle+jitter*.3};
 if(entries.size>12)entries.clear();
 entries.set(epoch,result);if(map)hazardGeometry.set(result,map);
 return result;
}
function build(layout,tier=0){
 if(!layout||!Array.isArray(layout.rooms))return [];
 const safeTier=clamp(Math.floor(Number(tier)||0),0,100);
 const key=String(layout.seed||layout.mapSeed||layout.id||'')+':'+safeTier+':'+layout.rooms.map(r=>r.id+':'+r.x+':'+r.y).join(',')+
   ':'+(layout.corridors||[]).map(c=>c.a+':'+c.b+':'+c.width).join(',');
 if(layoutCache.has(key))return layoutCache.get(key);
 const hazards=[],blocked=[];
 const unlocked=type=>type!=='tentacle'&&safeTier>=(HAZARD_UNLOCK_TIER[type]??99);
 for(const p of Object.values(layout.portals||{}))if(p)blocked.push({x:p.x,y:p.y,r:(Number(p.r)||0)+145});
 const start=layout.rooms.find(r=>r.id==='start');
 if(start)blocked.push({x:start.x,y:start.y,r:260});
 function add(h,type,roomId,index){
  const cfg=TYPES[type],reach=Number(h.length)>0?Number(h.length):(WALL_REACH[type]||0);
  const point=Number.isFinite(h.sourceX)?
   {x:h.sourceX+Math.cos(h.angle)*(reach*.5),y:h.sourceY+Math.sin(h.angle)*(reach*.5)}:{x:h.x,y:h.y};
  const hazard={...h,...point,id:roomId+':'+index,type,roomId,
   period:cfg.period,warning:cfg.warning,active:cfg.active,
   offset:h.nightmare?((index%8)/8)*cfg.period:(idHash(roomId+':timing:'+index+':'+safeTier)%1000)/1000*cfg.period,
   radius:type==='volcano'?(h.wallKind==='corridor'?49:64):
    type==='tentacle'?78:type==='fumarole'?120:type==='electric'?46:
    type==='spikes'?56:type==='rockfall'?77:type==='lure'?116:type==='pressure'?95:cfg.radius,
   length:reach||cfg.length||0,
   active:type==='rockfall'?Math.min(cfg.period-cfg.warning-.7,Math.max(1.2,reach/265+.65)):cfg.active,
   damage:Math.round(cfg.damage*(1+Math.min(.9,safeTier*.07)))};
  hazards.push(hazard);hazardGeometry.set(hazard,layout);
  if(Number.isFinite(h.sourceX))blocked.push({x:h.sourceX,y:h.sourceY,r:180});
 }
 for(const room of layout.rooms){
  if(room.id==='start')continue;
  const choices=(ALLOCATION[room.id]||['volcano']).filter(unlocked);
  if(!choices.length)choices.push('volcano');
  if(room.id==='boss'&&safeTier<3)continue;
  if(room.id==='boss'&&safeTier>=FINAL_TIER){
   for(let i=0;i<8;i++){const mount=nightmareWallMount(layout,room,i);if(mount)add(wallGeometry(layout,mount,'tentacle'),'tentacle',room.id,i);}
   continue;
  }
  // Two embedded threats per room at the deepest levels; their dormant roots
  // should read as cave detail rather than a field of floating obstacles.
  const count=Math.min(choices.length,safeTier>=4?2:1);
  for(let i=0;i<count;i++){
   const type=choices[(i+Math.floor(safeTier/3))%choices.length];
   const mount=type==='rockfall'?ceilingMount(layout,room,i,blocked):wallMount(layout,room,i+safeTier*.13,blocked);
   if(mount)add(wallGeometry(layout,mount,type),type,room.id,i);
  }
 }
 // The vortex is reserved first. Corridor traps cannot displace it.
 // The only unattached threat lives ACROSS a corridor, exactly where players
 // travel. It spans both sides of the narrow passage instead of a mob room.
 if(unlocked('vortex'))for(const i of [2,5]){
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
 // Collapsing roofs and electric fissures intercept actual narrow passages.
 for(const [i,passage] of (layout.corridors||[]).entries()){
  if(!unlocked('rockfall')||i===0||i%5!==3||Number(passage.width)>215)continue;
  const anchor=passageCeilingMount(layout,passage,i,blocked);
  if(anchor)add(wallGeometry(layout,anchor,'rockfall'),'rockfall','passage:'+passage.a+'-'+passage.b,i+350);
 }
 for(const [i,passage] of (layout.corridors||[]).entries()){
  if(!unlocked('electric')||i===0||i%4!==3||Number(passage.width)>205)continue;
  const anchor=corridorMount(layout,passage,i+1700,blocked);
  if(anchor)add(wallGeometry(layout,anchor,'electric'),'electric','passage:'+passage.a+'-'+passage.b,i+600);
 }
 // A deceptive bioluminescent lure sits inside real transit corridors, not
 // only on distant decorative walls. It briefly glows before pulling the player
 // into a hidden pocket; no floating platform or glowing base gives it away.
 for(const [i,passage] of (layout.corridors||[]).entries()){
  if(!unlocked('lure')||i===0||i%4!==2||Number(passage.width)>220)continue;
  const anchor=corridorMount(layout,passage,i+2600,blocked);
  if(anchor)add(wallGeometry(layout,anchor,'lure'),'lure','passage:'+passage.a+'-'+passage.b,i+720);
 }
 // Narrow-path volcanic vents are placed only where corridor walls are real.
 // The hot stream leaves a wide traversable strip and never blocks entrances.
 for(const [i,passage]of (layout.corridors||[]).entries()){
  if(!unlocked('volcano')||i===0||i%3!==1||Number(passage.width)>195)continue;
  const anchor=corridorMount(layout,passage,i,blocked);
  if(anchor)add(wallGeometry(layout,anchor,'volcano'),'volcano','passage:'+passage.a+'-'+passage.b,i);
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
 if(h.type==='vortex'&&s?.phase==='active')return Math.max(24,(h.acrossRadius||h.radius)*Math.min(1.08,(s.progress+.16)*2.4));
 return h.radius;
}
function hit(hazard,px,py,pad=0,phase=null){
 const h=phase?hazardAtCycle(hazard,phase.cycle||0):hazard,r=dangerRadius(h,phase)+pad;
 if(phase?.phase==='idle'||phase?.phase==='warning')return false;
 if(h.type==='rockfall'&&Number.isFinite(h.sourceX)){
  if(!phase)return Math.hypot(px-h.x,py-h.y)<=r; // static shape queries
  const fall=rockfallState(h,phase);
  return !fall.impact&&Math.hypot(px-fall.x,py-fall.y)<=Math.min(43,h.radius)+pad;
 }
 if(h.type==='tentacle'&&Number.isFinite(h.sourceX)&&phase){
  const extent=extension(h,phase);
  if(extent<=.02)return false;
  const points=tentaclePath(hazard,phase),end=Math.min(32,Math.max(1,Math.ceil(extent*32)));
  for(let i=1;i<=end;i++){
   const a=points[i-1],b=points[i],radius=suctionRadius(h,(i-.5)/32);
   if(segmentDistance(px,py,a.x,a.y,b.x,b.y)<=radius+pad)return true;
  }
  return false;
 }
 if(h.type==='vortex'){
  const cs=Math.cos(h.angle),sn=Math.sin(h.angle),dx=px-h.x,dy=py-h.y;
  const along=dx*cs+dy*sn,across=-dx*sn+dy*cs;
  const scale=phase?Math.min(1.08,(phase.progress+.16)*2.4):1;
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
  const safeLen=Math.min(h.poisonRays[lo].length,h.poisonRays[hi].length);
  const fraction=phase?(.04+.96*clamp(phase.progress,0,1)):1;
  return dist<=safeLen*fraction*.92+pad;
 }
 if(Number.isFinite(h.sourceX)&&['volcano','tentacle','spikes','electric'].includes(h.type)){
  const extent=h.type==='spikes'?extension(h,phase):1,len=(h.length||130)*extent;
  if(len<1)return false;
  const ax=h.sourceX+Math.cos(h.angle)*6,ay=h.sourceY+Math.sin(h.angle)*6;
  const bx=h.sourceX+Math.cos(h.angle)*len,by=h.sourceY+Math.sin(h.angle)*len;
  return segmentDistance(px,py,ax,ay,bx,by)<=h.radius*(h.type==='spikes'?.40:h.type==='electric'?.30:.5)+pad;
 }
 if(h.type==='tentacle'||h.type==='electric'){
  const len=h.length||300,a=h.angle||0;
  return segmentDistance(px,py,h.x-Math.cos(a)*len*.45,h.y-Math.sin(a)*len*.45,
    h.x+Math.cos(a)*len*.55,h.y+Math.sin(a)*len*.55)<=h.radius*.5+pad;
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
// Traps have geological signatures, never the same circular glowing pedestal.
function wallSeam(c,h,t,accent,s,scale=1){
 c.save();c.translate(h.sourceX,h.sourceY);c.rotate(h.angle);
 const live=s.phase==='active',warning=s.phase==='warning',strength=live?.72:warning?.12+.37*s.progress:.035;
 c.lineCap='round';c.lineJoin='round';c.globalAlpha=.84;
 if(h.type==='fumarole'){
  // Fumaroles seep from multiple thin pores among dark, branching mineral veins.
  for(let j=0;j<7;j++){
   const off=(j-3)*11,wave=Math.sin(j*1.88+t*.00018)*3;
   c.strokeStyle='rgba(38,85,78,.55)';c.lineWidth=1.6+j%3*.5;
   c.beginPath();c.moveTo(-43,off+wave);c.bezierCurveTo(-21,off-7,1,off+13,21,off*.45);c.stroke();
   c.fillStyle='rgba(7,32,31,.65)';c.beginPath();c.ellipse(16,off*.45,4+j%2*2,2.2,0,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=strength*.5;c.fillStyle='#81e5a1';
  for(let j=0;j<7;j++)paintedCircle(c,16,(j-3)*4,1.4+j%2,accent);
 }else if(h.type==='spikes'){
  // Fossil ribs are embedded teeth and longitudinal striations, not a vent.
  c.strokeStyle='rgba(93,130,126,.41)';c.lineWidth=3.2;
  for(let k=-3;k<=3;k++){
   const y=k*10;
   c.beginPath();c.moveTo(-48,y*.73);c.lineTo(-19,y*1.11);
   c.lineTo(3,y*.65);c.lineTo(17,y*.55);c.stroke();
  }
  c.fillStyle='rgba(39,70,75,.7)';
  for(let j=0;j<5;j++){const y=(j-2)*12;c.beginPath();
   c.moveTo(-8,y+5);c.lineTo(12,y);c.lineTo(-8,y-5);c.closePath();c.fill();}
  c.globalAlpha=strength;c.strokeStyle=accent;c.lineWidth=1;
  c.beginPath();c.moveTo(-28,-20);c.lineTo(5,-11);c.lineTo(17,-5);c.stroke();
 }else if(h.type==='electric'){
  // Dendritic electrical fractures fork into the darker sediment.
  c.strokeStyle='rgba(55,109,115,.49)';c.lineWidth=2.7;
  for(let j=0;j<5;j++){
   const y=(j-2)*14;
   c.beginPath();c.moveTo(-45,y*1.6);c.lineTo(-27,y*.8);
   c.lineTo(-13,y*1.22);c.lineTo(4,y*.29);
   c.lineTo(16,y*.45);c.stroke();
  }
  c.globalAlpha=strength*.8;c.strokeStyle='#b3edf0';c.lineWidth=1.3;
  c.beginPath();c.moveTo(-27,-24);c.lineTo(-13,-12);c.lineTo(-3,-16);c.lineTo(20,3);c.stroke();
 }else if(h.type==='pressure'){
  // Compression scars, stacked like geological strata, bend toward the fissure.
  for(let j=-3;j<=3;j++){
   c.strokeStyle='rgba(69,109,129,.53)';c.lineWidth=2.3;
   c.beginPath();c.moveTo(-48,j*12);
   c.bezierCurveTo(-23,j*12+5,-7,j*7,14,j*9);c.stroke();
  }
  c.globalAlpha=strength;c.strokeStyle=accent;c.lineWidth=1.2;
  c.beginPath();c.moveTo(-22,-19);c.quadraticCurveTo(13,-26,24,0);c.quadraticCurveTo(13,26,-22,19);c.stroke();
 }else if(h.type==='lure'){
  // Barely perceptible biofilm dots; no dark hole/ring revealing the ambush.
  c.globalAlpha=.33;
  for(let j=0;j<9;j++){
   const px=-29+(j%4)*13,py=(Math.floor(j/4)-1)*15+Math.sin(j*2.1)*4;
   paintedCircle(c,px,py,1.6+j%3*.6,'#375d60');
  }
  c.globalAlpha=strength*.48;
  paintedCircle(c,12,-9,1.7,'#a8e6d7');
 }
 c.restore();
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
  // Hot filaments spiral around the central jet without widening damage.
  for(const side of [-1,1]){
   c.beginPath();c.moveTo(12,side*5);
   for(let i=1;i<=18;i++){
    const q=i/18,xx=12+q*(len-20),yy=side*(11+half*.26*Math.sin(q*16-t*.010))*(.5+.5*q);
    c.lineTo(xx,yy);
   }
   c.strokeStyle=side>0?'rgba(255,188,92,.60)':'rgba(250,106,45,.58)';
   c.lineWidth=2.3;c.stroke();
  }
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
 // One rooted, leathery anemone torso; the poison stalks share a real origin.
 c.fillStyle='rgba(13,44,40,.93)';c.strokeStyle='rgba(83,149,119,.47)';c.lineWidth=2.2;
 c.beginPath();c.moveTo(-29,-23);c.bezierCurveTo(-14,-36,7,-26,17,-8);
 c.quadraticCurveTo(31,1,17,11);c.bezierCurveTo(3,28,-16,33,-30,20);
 c.quadraticCurveTo(-17,3,-29,-23);c.closePath();c.fill();c.stroke();
 c.fillStyle='rgba(71,156,94,.42)';c.beginPath();c.ellipse(11,0,10,19,0,0,Math.PI*2);c.fill();
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
 for(let i=0;i<h.poisonRays.length;i++){
    const ray=h.poisonRays[i],len=ray.length*fraction*(.92+.08*Math.sin(t*.0018+i*.59)**2);
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
 c.strokeStyle='rgba(145,244,122,.07)';c.lineWidth=1.9;c.stroke();
 // Anêmona Tóxica spores and translucent smoke, strictly inside the traced fan.
 for(let i=0;i<30;i++){
  const ray=h.poisonRays[(i*11)%h.poisonRays.length];
  const q=.13+((i*7)%17)/19,reach=ray.length*fraction*q;
  const x=ox+Math.cos(ray.angle)*reach,y=oy+Math.sin(ray.angle)*reach;
  c.globalAlpha=.16+(i%5)*.08;c.fillStyle=i%3?'#75db95':'#c3fc8c';
  c.beginPath();c.ellipse(x+Math.sin(t*.0007+i)*9,y+Math.cos(t*.0009+i*2)*7,6+(i%5)*2,4+(i%4)*2,ray.angle+t*.00015,0,Math.PI*2);c.fill();
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
 pit.addColorStop(.97,'rgba(20,57,66,.35)');
 pit.addColorStop(1,'rgba(12,34,48,0)');
 c.fillStyle=pit;c.beginPath();c.ellipse(0,0,rx*1.24,ry*1.16,0,0,Math.PI*2);c.fill();
 c.strokeStyle='rgba(72,133,150,.10)';c.lineWidth=1.5;
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
  const scale=Math.min(1.08,(s.progress+.16)*2.4);
  c.globalAlpha=.23;c.fillStyle='#0c5e80';
  c.beginPath();c.ellipse(0,0,rx*scale,ry*scale,0,0,Math.PI*2);c.fill();
  c.globalAlpha=.66;c.lineCap='round';
  // A three-arm pressure spiral funnels toward the central void. The old
  // concentric rings looked like an ordinary UI target rather than suction.
  for(let arm=0;arm<3;arm++){
   c.beginPath();
   for(let j=0;j<=52;j++){
    const q=j/52,theta=t*.0011+arm*Math.PI*2/3+q*Math.PI*2.4;
    const radius=(.96-.78*q)*scale;
    const xx=Math.cos(theta)*rx*radius,yy=Math.sin(theta)*ry*radius;
    if(!j)c.moveTo(xx,yy);else c.lineTo(xx,yy);
   }
   c.strokeStyle=arm===0?'#c2e9f2':arm===1?'#6cb1c7':'#8dbbd7';
   c.lineWidth=4-arm*.75;c.stroke();
  }
  for(let j=0;j<16;j++){
   const a=t*.0014+j*.77,dist=(.92-(j%8)*.102)*scale;
   c.strokeStyle='rgba(159,222,233,.35)';c.lineWidth=1.5;
   c.beginPath();c.moveTo(Math.cos(a)*rx*dist,Math.sin(a)*ry*dist);
   c.lineTo(Math.cos(a+.19)*rx*(dist-.11),Math.sin(a+.19)*ry*(dist-.11));c.stroke();
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
// Shared material/ventosa geometry: wall tentacles and Nightmare backdrop.
function drawNightmareArm(c,points,r,last,opacity=1){
 if(last<1||points.length<2)return;
 c.save();c.globalAlpha*=opacity;c.lineCap='round';c.lineJoin='round';
 // Reuse one continuous material gradient for all 32 tapered sections. Building
 // hundreds of per-segment gradients each frame caused avoidable mobile GPU work.
 const base=points[0],tip=points[Math.min(last,points.length-1)];
 const g=c.createLinearGradient(base.x-r*.3,base.y-r*.3,tip.x+r*.3,tip.y+r*.3);
 g.addColorStop(0,'rgba(86,28,135,.75)');g.addColorStop(.54,'rgba(157,82,203,.80)');g.addColorStop(1,'rgba(195,125,221,.61)');
 // One continuous flexible skin. Segment-by-segment strokes formerly left
 // seams between curved body sections and made submerged arms look disjointed.
 const rim=[];
 for(let i=0;i<=last;i++){
  const prev=points[Math.max(0,i-1)],next=points[Math.min(last,i+1)],p=points[i];
  const dx=next.x-prev.x,dy=next.y-prev.y,norm=Math.hypot(dx,dy)||1;
  const thick=suctionRadius({radius:r},i/32);
  rim.push({x:p.x,y:p.y,nx:-dy/norm,ny:dx/norm,thick});
 }
 c.beginPath();
 for(let i=0;i<rim.length;i++){
  const p=rim[i];if(!i)c.moveTo(p.x+p.nx*p.thick,p.y+p.ny*p.thick);
  else c.lineTo(p.x+p.nx*p.thick,p.y+p.ny*p.thick);
 }
 // The moving tip needs a rounded muscular cap, especially at partial
 // extension; otherwise it ends in a conspicuous flat rectangular cut.
 const endCap=rim[rim.length-1],normalAngle=Math.atan2(endCap.ny,endCap.nx);
 c.arc(endCap.x,endCap.y,endCap.thick,normalAngle,normalAngle-Math.PI,true);
 for(let i=rim.length-2;i>=0;i--){const p=rim[i];c.lineTo(p.x-p.nx*p.thick,p.y-p.ny*p.thick);}
 c.closePath();
 c.fillStyle=g;c.strokeStyle='rgba(17,4,37,.87)';c.lineWidth=4;
 c.shadowColor='#a451d6';c.shadowBlur=6;c.fill();c.shadowBlur=0;c.stroke();
 // Bilateral muscular fibres and restrained bioluminescent veins are attached
 // to the SAME curvature and taper as the body.
 for(const sign of [-1,1]){
  c.beginPath();
  for(let i=0;i<rim.length;i++){
   const p=rim[i],xx=p.x+p.nx*p.thick*.49*sign,yy=p.y+p.ny*p.thick*.49*sign;
   if(!i)c.moveTo(xx,yy);else c.lineTo(xx,yy);
  }
  c.strokeStyle=sign===1?'rgba(237,174,252,.34)':'rgba(92,35,144,.61)';
  c.lineWidth=Math.max(1.5,r*.021);c.stroke();
 }
 for(let i=2;i<=last;i+=2){
  const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,den=Math.hypot(dx,dy)||1;
  const nx=-dy/den,ny=dx/den,p=i/32,thick=suctionRadius({radius:r},p);
  for(const sign of [-1,1]){
   const sx=b.x+nx*thick*.63*sign,sy=b.y+ny*thick*.63*sign,rr=Math.max(1.7,thick*.19);
   c.fillStyle='#c69dde';c.strokeStyle='#40145b';c.lineWidth=Math.max(.9,rr*.22);
   c.beginPath();c.ellipse(sx,sy,rr,rr*.79,Math.atan2(dy,dx),0,Math.PI*2);c.fill();c.stroke();
   c.strokeStyle='rgba(238,195,251,.84)';c.lineWidth=Math.max(.8,rr*.15);c.beginPath();c.ellipse(sx,sy,rr*.75,rr*.5,Math.atan2(dy,dx),0,Math.PI*2);c.stroke();
   c.fillStyle='#280a45';c.beginPath();c.ellipse(sx,sy,rr*.42,rr*.36,Math.atan2(dy,dx),0,Math.PI*2);c.fill();
  }
 }
 c.restore();
}
function tentacleTrap(c,original,s,t){
 const h=hazardAtCycle(original,s.cycle),r=h.radius,points=tentaclePath(original,s);
 if(!Number.isFinite(h.sourceX)||points.length<2)return;
 // Dark tear in the cavern; this is where the purple arm is attached.
 const x=h.sourceX,y=h.sourceY;
 c.save();
 const mouth=c.createRadialGradient(x,y,2,x,y,r*.7);
 mouth.addColorStop(0,'rgba(0,0,6,.99)');mouth.addColorStop(.58,'rgba(2,6,15,.93)');
 mouth.addColorStop(1,'rgba(7,26,34,0)');
 c.fillStyle=mouth;c.beginPath();c.ellipse(x,y,r*.72,r*.54,h.angle,0,Math.PI*2);c.fill();
 // Organic collar is embedded in the basalt; radially folded tissue connects
 // the root of the moving arm to the wall instead of a floating oval.
 for(let i=0;i<9;i++){
  const a=h.angle+(i-4)*.27,reach=r*(.51+.10*Math.sin(i*2.4+t*.0007));
  c.strokeStyle=i%2?'rgba(73,36,105,.33)':'rgba(121,62,142,.29)';
  c.lineCap='round';c.lineWidth=2.2+(i%3);
  c.beginPath();c.moveTo(x+Math.cos(a)*r*.09,y+Math.sin(a)*r*.09);
  c.quadraticCurveTo(x+Math.cos(a+.22)*reach*.65,y+Math.sin(a+.22)*reach*.65,
   x+Math.cos(a)*reach,y+Math.sin(a)*reach);c.stroke();
 }
 c.strokeStyle='rgba(117,65,139,.42)';c.lineWidth=2;c.beginPath();
 c.ellipse(x,y,r*.53,r*.34,h.angle,-2.7,2.7);c.stroke();
 if(s.phase==='warning'){
  // Curved translucent red route, shaped by the position of the closest
  // player during the warning; it is NOT a straight rectangular hitbox.
  c.strokeStyle='rgba(255,54,82,'+(.035+.73*s.progress*s.progress)+')';c.shadowColor='#e8386b';c.shadowBlur=9;
  c.lineCap='round';c.lineJoin='round';c.beginPath();
  for(let i=0;i<points.length;i++){
   if(!i)c.moveTo(points[i].x,points[i].y);else c.lineTo(points[i].x,points[i].y);
  }
  c.lineWidth=r*.17;c.stroke();
  c.strokeStyle='rgba(235,38,74,'+(.008+.19*s.progress*s.progress)+')';c.lineWidth=r*.98;c.shadowBlur=0;c.stroke();
 }
 if(s.phase==='active'){
  const last=Math.min(32,Math.ceil(extension(h,s)*32));
  drawNightmareArm(c,points,r,last);
 }
 c.restore();
}
function rockfallTrap(c,h,s,t){
 if(!Number.isFinite(h.sourceX))return;
 // Rockfall originates only from a high overhang with water below.
 c.save();
 // A natural rock lip is recognizable only as part of the cave. In vertical
 // shafts, rotate it with the slanted fall path instead of drawing a fake roof.
 c.save();c.translate(h.sourceX,h.sourceY);c.rotate((h.angle||Math.PI*.5)-Math.PI*.5);
 c.fillStyle='rgba(11,30,38,.91)';c.strokeStyle='rgba(47,80,86,.43)';c.lineWidth=2.4;c.lineCap='round';
 c.beginPath();c.moveTo(-48,-16);c.lineTo(-29,-25);c.lineTo(-12,-17);
 c.lineTo(13,-22);c.lineTo(35,-14);c.quadraticCurveTo(11,-1,-7,5);
 c.quadraticCurveTo(-31,-4,-48,-16);c.closePath();c.fill();c.stroke();
 // Fractures belong to the overhang itself and signal unstable slate.
 c.strokeStyle=s.phase==='warning'?'rgba(160,199,201,.62)':'rgba(60,98,106,.40)';
 c.lineWidth=2.0;c.beginPath();c.moveTo(-30,-20);c.lineTo(-18,-7);
 c.lineTo(-5,-14);c.lineTo(8,-5);c.lineTo(18,-17);
 c.moveTo(-7,-13);c.lineTo(-11,-24);c.stroke();
 c.restore();
 if(s.phase==='idle'){c.restore();return;}
 if(s.phase==='warning'){
  c.globalAlpha=.26+.48*s.progress;
  for(let i=0;i<13;i++){
   const drift=Math.sin(i*2.77+t*.003)*20,fall=s.progress*(17+i%5*13);
   paintedCircle(c,h.sourceX+Math.cos(h.angle)*fall+(i-6)*3+drift*.22,h.sourceY+Math.sin(h.angle)*fall,1.2+(i%3),'#8da9a8');
  }
  c.restore();return;
 }
 const fall=rockfallState(h,s),fade=fall.fade;
 if(fade<=0){c.restore();return;}
 if(!fall.impact){
  c.save();c.translate(fall.x,fall.y);c.rotate(fall.progress*.8);
  c.fillStyle='#243c49';c.strokeStyle='#a0abb4';c.lineWidth=2.8;
  c.shadowColor='#7591a0';c.shadowBlur=7;
  c.beginPath();c.moveTo(-36,-27);c.lineTo(-10,-42);c.lineTo(25,-28);
  c.lineTo(39,2);c.lineTo(19,34);c.lineTo(-18,39);c.lineTo(-40,12);c.closePath();
  c.fill();c.stroke();c.shadowBlur=0;
  c.strokeStyle='#63818d';c.lineWidth=2;
  c.beginPath();c.moveTo(-32,-23);c.lineTo(3,-5);c.lineTo(22,-26);c.moveTo(3,-5);
  c.lineTo(-12,23);c.lineTo(18,31);c.stroke();
  // Slate facets and embedded minerals make this recognisably abyssal rock.
  c.fillStyle='rgba(129,167,178,.18)';c.beginPath();
  c.moveTo(-28,-18);c.lineTo(-3,-31);c.lineTo(5,-8);c.lineTo(-16,8);c.closePath();c.fill();
  c.strokeStyle='rgba(161,225,208,.50)';c.lineWidth=1.7;
  c.beginPath();c.moveTo(-4,-28);c.lineTo(6,-11);c.lineTo(15,-4);
  c.lineTo(10,12);c.stroke();
  for(let j=0;j<7;j++)paintedCircle(c,-22+j*7,10+Math.sin(j*2.1)*15,1.3+(j%3)*.6,'rgba(133,189,185,.54)');
  c.restore();
 }else{
  // The impact breaks the boulder into shards that fade out instead of
  // stopping at the floor as an indestructible solid prop.
  c.globalAlpha=fade;
  for(let i=0;i<14;i++){
   const angle=i*2.399,rad=(1-fade)*(28+(i%5)*13);
   const xx=fall.x+Math.cos(angle)*rad,yy=fall.y+Math.sin(angle)*rad;
   const scale=(3+i%4*2)*(.4+fade);
   c.fillStyle=i%2?'#466474':'#263f4d';c.strokeStyle='rgba(137,165,166,.61)';c.lineWidth=1;
   c.beginPath();c.moveTo(xx-scale,yy-scale*.5);
   c.lineTo(xx+scale*.35,yy-scale*1.25);c.lineTo(xx+scale,yy+scale*.52);
   c.lineTo(xx-scale*.4,yy+scale);c.closePath();c.fill();c.stroke();
  }
  c.strokeStyle='rgba(155,184,189,'+fade*.45+')';c.lineWidth=2;
  c.beginPath();c.arc(fall.x,fall.y,25+(1-fade)*39,0,Math.PI*2);c.stroke();
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
   // Coral ribs branch from one common mineral plate, never float beside it.
   c.strokeStyle='rgba(122,185,174,.51)';c.lineWidth=2;
   for(let i=1;i<Math.min(10,Math.floor(11*reach));i++){
    const xx=long*i/12;
    for(const side of [-1,1]){
     c.beginPath();c.moveTo(xx,side*9);c.quadraticCurveTo(xx+9,side*18,xx-2,side*(28+(i%3)*3));c.stroke();
    }
   }
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
   // Compression folds converge toward the fissure as refracted layers.
   for(let i=-3;i<=3;i++){
    const y=i*10,spread=warm?11+8*s.progress:live?24:0;
    c.beginPath();c.moveTo(-21,y);
    c.bezierCurveTo(5,y+spread*.6,25,y-spread*.35,48,y*(1+(live?.2:0)));
    c.strokeStyle='rgba(156,223,238,'+(live?.44:.19+s.progress*.18)+')';
    c.lineWidth=1.8;c.stroke();
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
  // A stalk and two tiny sensory branches originate from the same crevice.
  for(const side of [-1,1]){
   c.strokeStyle='rgba(88,172,160,.47)';c.lineWidth=1.4;c.beginPath();
   c.moveTo(9,-20);c.quadraticCurveTo(18,side*13-24,24+side*4,side*15-23);c.stroke();
   paintedCircle(c,24+side*4,side*15-23,1.8,'rgba(92,193,175,.42)');
  }
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
   if(live){
    // Bioluminescent forks grow from the actual electrical path, not from
    // an unrelated glowing rectangle above the cave.
    c.strokeStyle='rgba(211,254,250,.73)';c.lineWidth=1.6;
    for(let j=2;j<16;j+=3){
     const q=j/16,xx=q*len,yy=Math.sin(t*.012+j*2.47)*h.radius*.25*(1-Math.abs(q-.5));
     const side=(j%2)?1:-1;
     c.beginPath();c.moveTo(xx,yy);
     c.lineTo(xx+len*.04,yy+side*(8+(j%3)*4));
     c.lineTo(xx+len*.07,yy+side*(4+(j%3)*5));c.stroke();
    }
   }
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
function drawNightmareKrakenHead(c,r,pulse=0){
 c.save();
 // Broad paired squid fins and short bony antennae root the face in a
 // recognizable cephalopod mantle, rather than a floating theatrical mask.
 for(const side of [-1,1]){
  c.save();c.scale(side,1);
  c.fillStyle='rgba(48,17,96,.95)';c.strokeStyle='rgba(202,115,244,.84)';
  c.lineWidth=Math.max(1.6,r*.036);
  c.beginPath();c.moveTo(r*.71,-r*.92);
  c.bezierCurveTo(r*1.16,-r*1.50,r*1.62,-r*1.29,r*1.90,-r*.94);
  c.bezierCurveTo(r*1.48,-r*1.11,r*1.33,-r*.52,r*1.08,-r*.30);
  c.closePath();c.fill();c.stroke();
  c.beginPath();c.moveTo(r*.72,-r*.82);
  c.bezierCurveTo(r*.98,-r*1.38,r*1.18,-r*1.63,r*1.02,-r*1.86);
  c.quadraticCurveTo(r*1.40,-r*1.61,r*.96,-r*.74);
  c.closePath();c.fill();c.stroke();
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
 // An oversized pear-shaped Kraken mantle, narrowing into a distinct
 // eight-armed oral crown. The original eyes and toothed grin are unchanged.
 c.beginPath();c.moveTo(-r*.90,r*.59);
 c.bezierCurveTo(-r*1.40,r*.22,-r*1.48,-r*.74,-r*.94,-r*1.35);
 c.bezierCurveTo(-r*.54,-r*1.80,r*.54,-r*1.80,r*.94,-r*1.35);
 c.bezierCurveTo(r*1.48,-r*.74,r*1.40,r*.22,r*.90,r*.59);
 c.bezierCurveTo(r*.83,r*.87,r*.47,r*1.19,r*.20,r*1.23);
 c.quadraticCurveTo(0,r*1.38,-r*.20,r*1.23);
 c.bezierCurveTo(-r*.47,r*1.19,-r*.83,r*.87,-r*.90,r*.59);
 c.closePath();c.fill();c.stroke();c.shadowBlur=0;
 // The same forehead and predatory expression appear on boss and playable relic.
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
 // Segmented muscular collar indicates the root of eight true tentacles.
 c.strokeStyle='rgba(226,148,255,.48)';c.lineWidth=Math.max(1.1,r*.025);
 for(const side of [-1,1]){
  for(let j=0;j<3;j++){
   c.beginPath();c.moveTo(side*r*(.70+j*.07),r*(.61+j*.12));
   c.quadraticCurveTo(side*r*(.92+j*.09),r*(.80+j*.12),side*r*(.55+j*.08),r*(1.01+j*.06));c.stroke();
  }
 }
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
function drawFinalBoss(c,enemy,now){
 // PES ADELO ROXO: the same true cephalopod mantle, face and eight-arm
 // anatomy as the playable relic, with cavern-scale scenic tentacles.
 const x=enemy.x,y=enemy.y,r=enemy.r||154,t=now*.001,pulse=Math.sin(t*1.8);
 c.save();c.translate(x,y);
 const fog=c.createRadialGradient(-r*.14,r*.23,r*.16,0,0,r*4.3);
 fog.addColorStop(0,'rgba(188,73,255,.23)');
 fog.addColorStop(.32,'rgba(77,22,139,.19)');
 fog.addColorStop(.72,'rgba(31,6,67,.11)');
 fog.addColorStop(1,'rgba(16,4,44,0)');
 c.fillStyle=fog;c.beginPath();c.arc(0,0,r*4.3,0,Math.PI*2);c.fill();
 // The same material and ventosas are used in the submerged guardian limbs.
 // These arms are scenic and never damage players.
 for(let i=0;i<8;i++){
  const a=(i+.5)*Math.PI/4,cs=Math.cos(a),sn=Math.sin(a),normalX=-sn,normalY=cs;
  const roomRx=Math.max(900,r*7.1),roomRy=Math.max(410,r*3.1);
  const reach=1/Math.sqrt((cs/roomRx)**2+(sn/roomRy)**2);
  const wave=Math.sin(t*.35+i*1.8),curveScale=Math.min(180,reach*.22),points=[];
  for(let k=0;k<=32;k++){
   const p=k/32,along=r*.56+(reach-r*.56)*p;
   const lateral=(Math.sin(p*Math.PI*(3.1+(i%3)*.7)+wave)*.66+
     Math.sin(p*Math.PI*(5.3+(i%4)*.48)-wave)*.34)*Math.sin(p*Math.PI)*curveScale;
   points.push({x:cs*along+normalX*lateral,y:sn*along+normalY*lateral});
  }
  drawNightmareArm(c,points,r*.76,32,.23);
 }
 drawNightmareKrakenHead(c,r,pulse);
 c.restore();
}
// Small, playable relic form; unmistakable Nightmare ancestry without drawing
// the boss's cavern-wide non-colliding background over each player or store tile.
function drawNightmareRelic(c,x,y,r,t=0){
 c.save();c.translate(x,y);const q=Math.sin(t*.003),size=r;
 for(let arm=0;arm<8;arm++){
  const a=(arm+.5)*Math.PI/4,cs=Math.cos(a),sn=Math.sin(a),nx=-sn,ny=cs;
  const points=[];
  for(let k=0;k<=32;k++){
   const p=k/32,along=r*.46+r*(1.65+.19*(arm%3))*p;
   const lateral=(Math.sin(p*Math.PI*(2.7+(arm%4)*.47)+q+arm)*.66+
      Math.sin(p*Math.PI*4.4-q)*.34)*Math.sin(p*Math.PI)*r*.40;
   points.push({x:cs*along+nx*lateral,y:sn*along+ny*lateral});
  }
  drawNightmareArm(c,points,r*.24,32,.8);
 }
 drawNightmareKrakenHead(c,r,q);
 c.restore();
}
return {FINAL_TIER,FINAL_KIND,FINAL_CHEST_COINS,TYPES,build,state,hit,extension,hazardAtCycle,tentaclePath,aimTentacle,targetNearest,suctionRadius,rockfallState,checkpoint,draw,bossMark,bossHit,drawBossMark,drawFinalBoss,drawNightmareRelic};
});