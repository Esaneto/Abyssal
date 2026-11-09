/* Abyssal open sea side-section. Shared deterministic solid geometry for client,
 * authoritative server, ecology and sector generation. No world-sized bitmap.
 * World coordinates use y increasing towards the seabed.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalOceanGeography=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const WIDTH=24000,HEIGHT=9000,VERSION=1;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // Distinct continental shelves, escarpments and broad abyssal basins.
 const KNOTS=Object.freeze([
  [0,2450],[1200,2610],[2400,2330],[3400,3900],[4400,6350],
  [5600,6870],[6800,6500],[7900,7400],[8800,8150],[9800,8250],
  [10800,8750],[11900,8070],[13000,7500],[14100,8300],
  [15100,8640],[16200,8060],[17400,8470],[18600,7220],
  [19800,6850],[20800,7690],[21800,8460],[23000,8360],[24000,8720]
 ]);
 function floorAt(x){
  x=clamp(Number(x)||0,0,WIDTH);
  let lo=0,hi=KNOTS.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(KNOTS[mid][0]<=x)lo=mid;else hi=mid;}
  const a=KNOTS[lo],b=KNOTS[Math.min(lo+1,KNOTS.length-1)];
  const q=clamp((x-a[0])/Math.max(1,b[0]-a[0]),0,1);
  const smooth=q*q*(3-2*q);
  return clamp(a[1]+(b[1]-a[1])*smooth+Math.sin(x*.0041)*64+Math.sin(x*.0093+1.5)*28,1650,8850);
 }
 // Rock spires and natural suspended shelves. They never form a full-width wall.
 // Coordinates use floor-relative elevation, preserving large swim passages.
 const ROCK_DATA=[
  [2900,510,235,670,'spire'],[4100,380,320,570,'spire'],
  [6350,1260,790,210,'arch'],[7500,470,295,820,'spire'],
  [9450,850,480,330,'shelf'],[10850,450,260,790,'spire'],
  [12450,1220,690,220,'arch'],[14380,460,285,740,'spire'],
  [15800,1040,550,285,'shelf'],[17600,440,250,710,'spire'],
  [19380,1100,780,240,'arch'],[21150,410,300,640,'spire'],
  [22750,890,580,300,'shelf']
 ];
 const ROCKS=Object.freeze(ROCK_DATA.map((r,i)=>Object.freeze({
  id:'rock-'+i,x:r[0],y:Math.min(HEIGHT-260,floorAt(r[0])-r[1]),
  rx:r[2],ry:r[3],type:r[4]
 })));
 // Cave systems pierce the seabed, with wide surface entrances and multiple
 // chambers. They are actual water voids in collision, not painted dark holes.
 const CAVE_CENTERS=[3650,8600,11750,15150,20500,23000];
 const CAVES=Object.freeze(CAVE_CENTERS.map((x,i)=>{
  const offset=i%2===0?1:-1;
  const nodes=[
   {x:x-300*offset,y:floorAt(x-300*offset)-175,r:165},
   {x:x,y:floorAt(x)+115,r:180},
   {x:x+255*offset,y:floorAt(x)+345,r:225},
   {x:x+570*offset,y:floorAt(x+570*offset)-160,r:175}
  ].map(n=>Object.freeze({x:clamp(n.x,100,WIDTH-100),y:clamp(n.y,130,HEIGHT-160),r:n.r}));
  return Object.freeze({id:'cave-'+i,nodes:Object.freeze(nodes),type:i%2?'basalt':'limestone'});
 }));
 const ARCH_TUNNELS=Object.freeze(ROCKS.filter(r=>r.type==='arch').map(r=>Object.freeze({
  ax:r.x-r.rx-55,ay:r.y+16,bx:r.x+r.rx+55,by:r.y-18,r:118
 })));
 function capsuleSigned(x,y,ax,ay,bx,by,r){
  const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/Math.max(1,dx*dx+dy*dy),0,1);
  return Math.hypot(x-ax-dx*t,y-ay-dy*t)-r;
 }
 function isCaveWater(x,y,padding=0){
  for(const cave of CAVES){
   const nodes=cave.nodes;
   // Coarse bounding box before capsule checks.
   let near=false;
   for(const n of nodes)if(Math.abs(x-n.x)<680&&Math.abs(y-n.y)<690){near=true;break;}
   if(!near)continue;
   for(let i=1;i<nodes.length;i++){
    const a=nodes[i-1],b=nodes[i],r=Math.min(a.r,b.r)-padding;
    if(r>0&&capsuleSigned(x,y,a.x,a.y,b.x,b.y,r)<0)return true;
   }
  }
  for(const tunnel of ARCH_TUNNELS)
   if(Math.abs(y-tunnel.ay)<160&&x>Math.min(tunnel.ax,tunnel.bx)-140&&x<Math.max(tunnel.ax,tunnel.bx)+140
    &&capsuleSigned(x,y,tunnel.ax,tunnel.ay,tunnel.bx,tunnel.by,tunnel.r-padding)<0)return true;
  return false;
 }
 function isSolid(x,y,padding=0){
  if(!Number.isFinite(x)||!Number.isFinite(y))return true;
  padding=Math.max(0,Number(padding)||0);
  if(x<0||x>WIDTH||y<0||y>HEIGHT)return true;
  let solid=y>=floorAt(x)-padding;
  if(!solid)for(const rock of ROCKS){
   const dx=x-rock.x,dy=y-rock.y;
   if(Math.abs(dx)>rock.rx+padding||Math.abs(dy)>rock.ry+padding)continue;
   const a=(dx/(rock.rx+padding))**2+(dy/(rock.ry+padding))**2;
   if(a<=1){solid=true;break;}
  }
  return solid&&!isCaveWater(x,y,padding);
 }
 function segmentClear(x1,y1,x2,y2,padding=0){
  if(![x1,y1,x2,y2].every(Number.isFinite))return false;
  const steps=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)/36));
  // Bounded trace. Callers should not request trans-ocean raycasts.
  if(steps>320)return false;
  for(let i=0;i<=steps;i++){const t=i/steps;if(isSolid(x1+(x2-x1)*t,y1+(y2-y1)*t,padding))return false;}
  return true;
 }
 function nearestWater(x,y,r=18){
  x=clamp(x,r,WIDTH-r);y=clamp(y,r,HEIGHT-r);
  if(!isSolid(x,y,r))return {x,y};
  for(let range=36;range<=720;range+=36){
   for(let k=0;k<24;k++){
    const a=k*Math.PI/12,px=clamp(x+Math.cos(a)*range,r,WIDTH-r),py=clamp(y+Math.sin(a)*range,r,HEIGHT-r);
    if(!isSolid(px,py,r))return {x:px,y:py};
   }
  }
  return null;
 }
 function resolveMove(x1,y1,x2,y2,r=18){
  const radius=clamp(Number(r)||18,0,90);
  x2=clamp(x2,radius,WIDTH-radius);y2=clamp(y2,radius,HEIGHT-radius);
  if(segmentClear(x1,y1,x2,y2,radius))return {x:x2,y:y2,blocked:false};
  // Sliding preserves free swimming along reefs and floors without teleporting.
  const horizontal=segmentClear(x1,y1,x2,y1,radius);
  const hx=horizontal?x2:x1;
  const vertical=segmentClear(hx,y1,hx,y2,radius);
  if(horizontal||vertical)return {x:hx,y:vertical?y2:y1,blocked:true};
  const vy=segmentClear(x1,y1,x1,y2,radius)?y2:y1;
  const vx=segmentClear(x1,vy,x2,vy,radius)?x2:x1;
  if(vx!==x1||vy!==y1)return {x:vx,y:vy,blocked:true};
  return {x:x1,y:y1,blocked:true};
 }
 function classify(x,y){
  const floor=floorAt(x),clearance=floor-y;
  if(x<1900&&clearance<650&&y<3500)return 'reef';
  if(x>=1900&&x<3500&&clearance<650&&y<4600)return 'kelp';
  if(y>7300)return 'abyss';
  if(y>5100)return clearance<750?'canyon':'deep';
  if(clearance<480)return 'rocks';
  if(y<3400)return 'open';
  return 'twilight';
 }
 function lightAt(y){return clamp(1-Math.pow(clamp(y/HEIGHT,0,1),.72)*.94,.06,1);}
 return Object.freeze({WIDTH,HEIGHT,VERSION,KNOTS,ROCKS,CAVES,ARCH_TUNNELS,floorAt,isSolid,isCaveWater,segmentClear,nearestWater,resolveMove,classify,lightAt});
});