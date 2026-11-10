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
 const WIDTH=24000,HEIGHT=21000,VERSION=5,DEPTH_SCALE=HEIGHT/9000;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // Distinct continental shelves, escarpments and broad abyssal basins.
 const SHOALS=Object.freeze([[6250,980,.83],[14200,1320,.77],[18600,1150,.82],[22400,850,.67]]);
 const KNOTS=Object.freeze([
  [0,180],[1200,280],[2400,340],[3400,1200],[4400,4000],
  [5600,6250],[6800,6500],[7900,7400],[8800,8150],[9800,8250],
  [10800,8750],[11900,8070],[13000,7500],[14100,8300],
  [15100,8640],[16200,8060],[17400,8470],[18600,7220],
  [19800,6850],[20800,7690],[21800,8460],[23000,8360],[24000,8720]
 ].map(([x,y])=>Object.freeze([x,Math.round(y*DEPTH_SCALE)])));
 function floorAt(x){
  x=clamp(Number(x)||0,0,WIDTH);
  let lo=0,hi=KNOTS.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(KNOTS[mid][0]<=x)lo=mid;else hi=mid;}
  const a=KNOTS[lo],b=KNOTS[Math.min(lo+1,KNOTS.length-1)];
  const q=clamp((x-a[0])/Math.max(1,b[0]-a[0]),0,1);
  const smooth=q*q*(3-2*q);
  const base=a[1]+(b[1]-a[1])*smooth+Math.sin(x*.0041)*64+Math.sin(x*.0093+1.5)*28;
  // Smooth submerged seamounts periodically reconnect the eastern water column
  // to shallow reefs, without rectangular transitions between biomes.
  let lift=0;for(const [center,spread,strength] of SHOALS){const q=(x-center)/spread;lift=Math.max(lift,Math.exp(-q*q*.72)*strength);}
  return clamp(base*(1-lift),120*DEPTH_SCALE,8850*DEPTH_SCALE);
 }
 // Only grounded outcrops and spaced cliffs are solid. The old suspended
 // plates across the coastal spawning corridor were impassable and are removed.
 const ROCK_DATA=[
  [1550,128,210,95,'boulder'],[1980,144,155,110,'boulder'],[2560,158,185,105,'boulder'],
  [2900,510,235,540,'spire'],[4100,380,320,510,'spire'],
  [6350,1260,620,190,'arch'],[7500,470,295,750,'spire'],
  [9450,850,460,290,'shelf'],[10850,450,260,700,'spire'],
  [12450,1220,650,200,'arch'],[14380,460,285,690,'spire'],
  [15800,1040,500,245,'shelf'],[17600,440,250,650,'spire'],
  [19380,1100,700,220,'arch'],[21150,410,300,590,'spire'],
  [22750,890,550,270,'shelf'],
  [3360,820,250,400,'spire'],[5230,780,480,210,'shelf'],
  [8750,1160,600,215,'arch'],[11380,1570,505,220,'shelf'],
  [13660,990,355,360,'spire'],[16700,1450,660,205,'arch'],
  [20100,1030,520,240,'shelf']
 ];
 // Seamount outcrops: grounded, separated, organically shaped rock towers.
 // Sparse spatial buckets preserve cheap collision checks over the huge map.
 const rockRandom=i=>((Math.imul(i+913,1103515245)+12345)>>>0)/4294967296;
 const EXTRA_ROCKS=[];
 for(let i=0;i<29;i++){
  const x=Math.round(4750+i*665+(rockRandom(i*7)-.5)*250);
  if(x>WIDTH-260)break;
  const floor=floorAt(x),r=rockRandom(i*11+3),longSpire=i%5===2;
  const ry=Math.min(Math.max(170,floor*.12+(longSpire?floor*.20:0)),longSpire?4400:1900);
  const rx=Math.round(180+r*220+(longSpire?40:0));
  const y=Math.max(ry+320,floor-ry*.76);
  if(y+ry>floor+270||y-ry<270)continue;
  EXTRA_ROCKS.push([x,y,rx,ry,i%6===0?'arch':longSpire?'spire':i%3===0?'shelf':'boulder']);
  if(i%2===0){
   const side=x+(i%4===0?-1:1)*(rx*.7+120),sr=100+rockRandom(i*17+5)*130;
   EXTRA_ROCKS.push([Math.round(side),Math.max(270+sr,floorAt(side)-sr*.86),sr*1.5,sr,'boulder']);
  }
 }
 const ROCKS=Object.freeze(ROCK_DATA.map((r,i)=>Object.freeze({
  id:'rock-'+i,x:r[0],y:Math.min(HEIGHT-260,floorAt(r[0])-r[1]),
  rx:r[2],ry:r[3],type:r[4]
 })).concat(EXTRA_ROCKS.map((r,i)=>Object.freeze({id:'ridge-'+i,x:r[0],y:r[1],rx:r[2],ry:r[3],type:r[4]}))));
 const ROCK_GRID_SIZE=900,ROCK_GRID=new Map();
 for(const rock of ROCKS){
  for(let bx=Math.floor((rock.x-rock.rx-95)/ROCK_GRID_SIZE);bx<=Math.floor((rock.x+rock.rx+95)/ROCK_GRID_SIZE);bx++)
   for(let by=Math.floor((rock.y-rock.ry-95)/ROCK_GRID_SIZE);by<=Math.floor((rock.y+rock.ry+95)/ROCK_GRID_SIZE);by++){
    const key=bx+':'+by;if(!ROCK_GRID.has(key))ROCK_GRID.set(key,[]);
    ROCK_GRID.get(key).push(rock);
   }
 }
 function rocksNear(x,y){return ROCK_GRID.get(Math.floor(x/ROCK_GRID_SIZE)+':'+Math.floor(y/ROCK_GRID_SIZE))||[];}
 function rockRelief(rock,angle){
  const seed=rock.x*.00039+rock.y*.00017;
  // Multiscale weathering, deterministic and shared by collisions and paint.
  return clamp(.924+.032*Math.sin(angle*5.0+seed)
    +.021*Math.sin(angle*9.0-seed*.8)+.014*Math.cos(angle*13+seed*2.3),.84,.994);
 }
 function rockSurfaceAt(rock,angle,offset=0){
  const relief=rockRelief(rock,angle);
  return {x:rock.x+Math.cos(angle)*(rock.rx*relief+offset),
          y:rock.y+Math.sin(angle)*(rock.ry*relief+offset)};
 }
 function rockContains(rock,x,y,padding=0){
  const dx=x-rock.x,dy=y-rock.y;
  if(Math.abs(dx)>rock.rx+padding||Math.abs(dy)>rock.ry+padding)return false;
  const u=dx/rock.rx,v=dy/rock.ry;
  const q=Math.hypot(u,v),angle=Math.atan2(v,u);
  return q<=rockRelief(rock,angle)+Math.max(0,padding)/Math.max(50,Math.min(rock.rx,rock.ry));
 }
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
 const BRANCH_TUNNELS=Object.freeze(CAVES.flatMap((c,i)=>{
  const a=c.nodes[1],b=c.nodes[2],dir=i%2?-1:1;
  return [{ax:a.x,ay:a.y,bx:a.x+dir*470,by:a.y+170,r:118},
          {ax:b.x,ay:b.y,bx:b.x-dir*390,by:b.y+250,r:112}].map(t=>Object.freeze(t));
 }));
 function caveRadiusAt(a,b,t,r){
  // A narrow geological irregularity shared by navigable tunnel collision and paint.
  const seed=(a.x+b.x)*.0017+(a.y+b.y)*.0009;
  return r*clamp(.935+.030*Math.sin(t*11+seed)+.021*Math.cos(t*23-seed*.5),.855,.995);
 }
 function capsuleSigned(x,y,ax,ay,bx,by,r){
  const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/Math.max(1,dx*dx+dy*dy),0,1);
  const a={x:ax,y:ay},b={x:bx,y:by};
  return Math.hypot(x-ax-dx*t,y-ay-dy*t)-caveRadiusAt(a,b,t,r);
 }
 function isCaveWater(x,y,padding=0){
  for(const cave of CAVES){
   const nodes=cave.nodes;
   // Segment bounds remain correct after the deeper floor stretches cave slopes.
   for(let i=1;i<nodes.length;i++){
    const a=nodes[i-1],b=nodes[i],r=Math.min(a.r,b.r)-padding;
    if(r<=0||x<Math.min(a.x,b.x)-r||x>Math.max(a.x,b.x)+r||
       y<Math.min(a.y,b.y)-r||y>Math.max(a.y,b.y)+r)continue;
    if(capsuleSigned(x,y,a.x,a.y,b.x,b.y,r)<0)return true;
   }
  }
  for(const tunnel of [...ARCH_TUNNELS,...BRANCH_TUNNELS]
   if(Math.abs(y-tunnel.ay)<160&&x>Math.min(tunnel.ax,tunnel.bx)-140&&x<Math.max(tunnel.ax,tunnel.bx)+140
    &&capsuleSigned(x,y,tunnel.ax,tunnel.ay,tunnel.bx,tunnel.by,tunnel.r-padding)<0)return true;
  return false;
 }
 function isSolid(x,y,padding=0){
  if(!Number.isFinite(x)||!Number.isFinite(y))return true;
  padding=Math.max(0,Number(padding)||0);
  if(x<0||x>WIDTH||y<0||y>HEIGHT)return true;
  let solid=y>=floorAt(x)-padding;
  if(!solid)for(const rock of rocksNear(x,y)){
   if(rockContains(rock,x,y,padding)){solid=true;break;}
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
 // Local obstacle avoidance for active marine fauna. It performs short probes
 // only when a wall is immediately ahead; no global pathfinder or map search.
 function steer(x,y,targetX,targetY,padding=24,key=0){
  const dx=targetX-x,dy=targetY-y,d=Math.hypot(dx,dy);
  if(!Number.isFinite(d)||d<1)return {x,y,direct:true};
  const ux=dx/d,uy=dy/d,probe=Math.min(225,d);
  if(!isSolid(x+ux*Math.min(105,probe),y+uy*Math.min(105,probe),padding)
   &&!isSolid(x+ux*probe,y+uy*probe,padding))return {x:targetX,y:targetY,direct:true};
  const angle=Math.atan2(uy,ux);
  const preference=(Number(key)||0)%2===0?1:-1;
  let best=null,bestScore=-Infinity;
  for(const side of [preference,-preference]){
   for(const bend of [.48,.9,1.35,1.75]){
    const a=angle+side*bend,px=x+Math.cos(a)*190,py=y+Math.sin(a)*190;
    if(isSolid(px,py,padding)||!segmentClear(x,y,px,py,padding))continue;
    const progress=(px-x)*ux+(py-y)*uy;
    const score=progress*.7+bend*2+(side===preference?4:0);
    if(score>bestScore){best={x:px,y:py,direct:false};bestScore=score;}
   }
  }
  return best||{x,y,direct:false};
 }
 function classify(x,y){
  const clearance=floorAt(x)-y,depth=metersAt(y);
  // Habitat follows the same 2,200 m scale as oxygen, HUD and illumination.
  if(clearance<650&&depth<=210){
   if(x<1900||x>4500&&Math.sin(x*.0019)>.30)return 'reef';
   if(x<3500||Math.cos(x*.0011)>.05)return 'kelp';
   return 'rocks';
  }
  if(depth>1850)return 'abyss';
  if(depth>1100)return clearance<750?'canyon':'deep';
  if(clearance<480)return 'rocks';
  if(depth<220)return 'open';
  return 'twilight';
 }
 // The gameplay world spans 2,200 meters; biological light boundaries must use
 // real depth, not the older 9,000 m terrain-generation scale.
 function metersAt(y){return clamp(Number(y)||0,0,HEIGHT)/HEIGHT*2200;}
 function lightAt(y){
  const depth=metersAt(y);
  // Strong extinction in the euphotic zone, thin residual twilight, none after 1 km.
  if(depth<=200)return Math.exp(-depth/33);
  if(depth<1000)return Math.exp(-200/33)*Math.pow((1000-depth)/800,1.65);
  return 0;
 }
 return Object.freeze({WIDTH,HEIGHT,VERSION,DEPTH_SCALE,KNOTS,ROCKS,CAVES,ARCH_TUNNELS,BRANCH_TUNNELS,caveRadiusAt,rockRelief,rockSurfaceAt,rockContains,floorAt,isSolid,isCaveWater,segmentClear,nearestWater,resolveMove,steer,classify,lightAt,metersAt});
});