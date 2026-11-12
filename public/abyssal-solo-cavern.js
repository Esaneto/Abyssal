/* Solo: world-anchored abyssal caverns, shared solid geometry, navigation and light. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalSoloCavern=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const noise=(x,k)=>Math.sin(x*.005+k)*.61+Math.sin(x*.017+k*2)*.26+Math.sin(x*.046+k)*.13;
 const layouts=new WeakMap();
 function buildRocks(w,h){
  const s=Math.min(w,h);
  // Staggered shelves form interconnected corridors with generous boss clearance.
  // The starting lane at x=0.5 and y=.11 is clear.
  const features=[
   [.115,.245,.140,.055,-.23],[.33,.31,.097,.044,.21],[.69,.255,.132,.051,-.14],[.91,.36,.089,.049,.55],
   [.14,.58,.127,.057,.16],[.39,.55,.050,.109,-.26],[.64,.56,.061,.105,.31],[.87,.64,.117,.044,-.21],
   [.25,.83,.143,.055,-.22],[.53,.83,.087,.047,.12],[.79,.87,.114,.042,-.18],
   [.095,.82,.038,.092,.11],[.47,.202,.152,.052,-.10],[.535,.038,.131,.035,.04]
  ];
  return features.map(([fx,fy,a,b,angle],index)=>{
   const rx=s*a,ry=s*b,vertices=[];
   // Irregular eroded rock contour. Collision, shadows and art share this polygon.
   for(let k=0;k<40;k++){
    const phi=TAU*k/40,grain=.92+.052*Math.sin(phi*5+index*1.7)+.035*Math.sin(phi*11-index*2)+.022*Math.cos(phi*17+index);
    vertices.push([Math.cos(phi)*rx*grain,Math.sin(phi)*ry*grain]);
   }
   const r=Math.max(...vertices.map(v=>Math.hypot(...v)));
   let x=w*fx,y=h*fy;const baseX=w*.5,baseY=h*.39;
   if(Math.abs(x-baseX)<rx+390&&Math.abs(y-baseY)<ry+265)x=baseX+(x<baseX?-1:1)*(rx+415);
   return {x,y,rx,ry,r,angle,vertices,shade:.14+index%5*.115,seed:900+index,edge:'cavern',cavernSolid:true,visualOnly:false};
  });
 }
 function submarineHull(x,y,scale=1){
  // Convex silhouette follows the shared hull, including stern and front viewport.
  const vertices=[[-286,-35],[-270,-57],[-235,-57],[-175,-53],[-110,-72],[-38,-76],[-38,-99],[55,-99],[70,-76],[160,-76],[215,-66],[265,-45],[281,-12],[281,22],[255,55],[190,77],[48,80],[32,99],[-32,99],[-48,76],[-130,60],[-225,28],[-270,57],[-286,35]].map(([a,b])=>[a*scale,b*scale]);
  return {x,y,rx:286*scale,ry:99*scale,r:300*scale,angle:0,vertices,cavernSolid:true,submarineHull:true,visualOnly:false};
 }
 function local(r,x,y){
  const a=-(r.angle||0),ca=Math.cos(a),sa=Math.sin(a),dx=x-r.x,dy=y-r.y;
  return [dx*ca-dy*sa,dx*sa+dy*ca];
 }
 const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
 function pointSegment2(x,y,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],q=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);
  return (x-a[0]-dx*q)**2+(y-a[1]-dy*q)**2;
 }
 function contains(pts,x,y,pad=0){
  let inside=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
   const a=pts[j],b=pts[i];
   if(pad>0&&pointSegment2(x,y,a,b)<pad*pad)return true;
   if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;
 }
 function lineParameter(x,y,dx,dy,a,b){
  const sx=b[0]-a[0],sy=b[1]-a[1],den=cross(dx,dy,sx,sy);
  if(Math.abs(den)<1e-9)return Infinity;
  const ax=a[0]-x,ay=a[1]-y,t=cross(ax,ay,sx,sy)/den,u=cross(ax,ay,dx,dy)/den;
  return t>=0&&u>=0&&u<=1?t:Infinity;
 }
 function segmentRock(r,x1,y1,x2,y2,padding){
  const a=local(r,x1,y1),b=local(r,x2,y2),rx=r.rx*1.06+padding,ry=r.ry*1.06+padding;
  if(Math.min(a[0],b[0])>rx||Math.max(a[0],b[0])<-rx||Math.min(a[1],b[1])>ry||Math.max(a[1],b[1])<-ry)return false;
  const pts=r.vertices,dx=b[0]-a[0],dy=b[1]-a[1];
  if(contains(pts,a[0],a[1],padding)||contains(pts,b[0],b[1],padding))return true;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
   const p=pts[j],q=pts[i];
   if(lineParameter(a[0],a[1],dx,dy,p,q)<=1)return true;
   if(padding>0&&pointSegment2(p[0],p[1],a,b)<padding*padding)return true;
  }return false;
 }
 function isBlocked(rocks,x,y,padding=0){
  for(const r of rocks||[]){
   if(!r.cavernSolid||r.visualOnly)continue;
   if(Math.abs(x-r.x)>r.r+padding||Math.abs(y-r.y)>r.r+padding)continue;
   const p=local(r,x,y);
   if(Math.abs(p[0])<=r.rx*1.06+padding&&Math.abs(p[1])<=r.ry*1.06+padding&&contains(r.vertices,p[0],p[1],padding))return true;
  }return false;
 }
 function resolve(rocks,fromX,fromY,toX,toY,padding=0){
  const d=Math.hypot(toX-fromX,toY-fromY),steps=clamp(Math.ceil(d/Math.max(3,padding*.6)),1,1000);
  const dx=(toX-fromX)/steps,dy=(toY-fromY)/steps;
  let x=fromX,y=fromY,blocked=false;
  // Recover entities already overlapping a solid (e.g. a launch or knockback).
  if(isBlocked(rocks,x,y,padding)){const originX=x,originY=y;let found=false;for(let radius=Math.max(4,padding*.5);radius<=640&&!found;radius+=Math.max(4,padding*.5)){for(let i=0;i<32;i++){const a=i*TAU/32,xx=originX+Math.cos(a)*radius,yy=originY+Math.sin(a)*radius;if(!isBlocked(rocks,xx,yy,padding)){x=xx;y=yy;found=true;break;}}}if(!found)return {x,y,blocked:true};return {x,y,blocked:true};}
  // Integrate from the last accepted point, never skip through a solid rock.
  for(let i=0;i<steps;i++){
   const tx=x+dx,ty=y+dy;
   if(!segmentBlocked(rocks,x,y,tx,ty,padding)){x=tx;y=ty;continue;}
   blocked=true;
   if(!segmentBlocked(rocks,x,y,tx,y,padding))x=tx;
   else if(!segmentBlocked(rocks,x,y,x,ty,padding))y=ty;
  }return {x,y,blocked};
 }
 function segmentBlocked(rocks,x1,y1,x2,y2,padding=0,ignoreSubmarine=false){
  for(const r of rocks||[]){
   if(!r.cavernSolid||r.visualOnly||(ignoreSubmarine&&r.submarineHull))continue;
   if(Math.min(x1,x2)>r.x+r.r+padding||Math.max(x1,x2)<r.x-r.r-padding||Math.min(y1,y2)>r.y+r.r+padding||Math.max(y1,y2)<r.y-r.r-padding)continue;
   if(segmentRock(r,x1,y1,x2,y2,padding))return true;
  }return false;
 }
 function rayDistance(rocks,x,y,dx,dy,range){
  if(isBlocked(rocks,x,y,0))return 0;
  let limit=range;
  for(const r of rocks||[]){
   if(!r.cavernSolid||r.visualOnly)continue;
   if(Math.min(x,x+dx*limit)>r.x+r.r||Math.max(x,x+dx*limit)<r.x-r.r||Math.min(y,y+dy*limit)>r.y+r.r||Math.max(y,y+dy*limit)<r.y-r.r)continue;
   const a=local(r,x,y),b=local(r,x+dx*range,y+dy*range),vx=b[0]-a[0],vy=b[1]-a[1],pts=r.vertices;
   for(let i=0,j=pts.length-1;i<pts.length;j=i++){const t=lineParameter(a[0],a[1],vx,vy,pts[j],pts[i]);if(t<=1)limit=Math.min(limit,t*Math.hypot(vx,vy));}
  }return limit;
 }
 const CELL=64,DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
 function gridFor(rocks,w,h,padding){
  let cache=layouts.get(rocks);if(!cache){cache=new Map();layouts.set(rocks,cache);}
  const p=Math.ceil(padding/4)*4,key=w+':'+h+':'+p+':'+rocks.length;
  if(cache.has(key))return cache.get(key);
  const cols=Math.ceil(w/CELL),rows=Math.ceil(h/CELL),count=cols*rows;
  const xy=id=>({x:Math.min(w-p-1,(id%cols+.5)*CELL),y:Math.min(h-p-1,(Math.floor(id/cols)+.5)*CELL)});
  const idAt=(x,y)=>clamp(Math.floor(y/CELL),0,rows-1)*cols+clamp(Math.floor(x/CELL),0,cols-1);
  const pass=new Uint8Array(count),edges=new Array(count);
  for(let i=0;i<count;i++){const a=xy(i);pass[i]=!isBlocked(rocks,a.x,a.y,p)&&a.x>=p&&a.y>=p?1:0;}
  for(let i=0;i<count;i++){
   edges[i]=[];if(!pass[i])continue;const x=i%cols,y=Math.floor(i/cols),a=xy(i);
   for(const [dx,dy]of DIRS){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=cols||yy>=rows)continue;
    const j=yy*cols+xx,b=xy(j);if(pass[j]&&!segmentBlocked(rocks,a.x,a.y,b.x,b.y,p))edges[i].push(j);}
  }
  const g={w,h,p,cols,rows,count,xy,idAt,pass,edges,flows:new Map()};cache.set(key,g);return g;
 }
 function nearestNode(g,rocks,x,y,requireLine=true){
  const at=g.idAt(x,y);if(g.pass[at]){const p=g.xy(at);if(!requireLine||!segmentBlocked(rocks,x,y,p.x,p.y,g.p))return at;}
  let best=-1,dist=Infinity;const cx=at%g.cols,cy=Math.floor(at/g.cols);
  for(let r=1;r<=5;r++){
   for(let yy=Math.max(0,cy-r);yy<=Math.min(g.rows-1,cy+r);yy++)for(let xx=Math.max(0,cx-r);xx<=Math.min(g.cols-1,cx+r);xx++){
    const i=yy*g.cols+xx;if(!g.pass[i])continue;const p=g.xy(i),d=Math.hypot(p.x-x,p.y-y);
    if(d<dist&&(!requireLine||!segmentBlocked(rocks,x,y,p.x,p.y,g.p))){best=i;dist=d;}
   }if(best>=0)return best;
  }return best;
 }
 function nearestWater(rocks,w,h,x,y,padding=0){
  x=clamp(x,padding+1,w-padding-1);y=clamp(y,padding+1,h-padding-1);
  if(!isBlocked(rocks,x,y,padding))return {x,y};
  const g=gridFor(rocks,w,h,padding),id=nearestNode(g,rocks,x,y,false);return id<0?null:g.xy(id);
 }
 function flow(g,goal){
  if(g.flows.has(goal)){const value=g.flows.get(goal);g.flows.delete(goal);g.flows.set(goal,value);return value;}
  const d=new Int32Array(g.count);d.fill(-1);const q=new Int32Array(g.count);let head=0,tail=0;
  d[goal]=0;q[tail++]=goal;
  while(head<tail){const i=q[head++];for(const j of g.edges[i])if(d[j]<0){d[j]=d[i]+1;q[tail++]=j;}}
  g.flows.set(goal,d);if(g.flows.size>8)g.flows.delete(g.flows.keys().next().value);return d;
 }
 function navigationTarget(rocks,w,h,fromX,fromY,toX,toY,padding=0){
  if(!segmentBlocked(rocks,fromX,fromY,toX,toY,padding))return {x:toX,y:toY,direct:true,blocked:false};
  const g=gridFor(rocks,w,h,padding),start=nearestNode(g,rocks,fromX,fromY);
  if(start<0)return {x:fromX,y:fromY,blocked:true,direct:false};
  // Player may hug a wall more closely than a large animal can. Choose a reachable
  // water point near the target, not a node on the wrong side of a thin shelf.
  let goal=nearestNode(g,rocks,toX,toY,false);if(goal<0)return {x:fromX,y:fromY,blocked:true,direct:false};
  let d=flow(g,goal);
  if(d[start]<0||isBlocked(rocks,toX,toY,g.p)){
   const reach=flow(g,start),at=g.idAt(toX,toY),cx=at%g.cols,cy=Math.floor(at/g.cols);let best=-1,bestScore=Infinity;
   for(let yy=Math.max(0,cy-3);yy<=Math.min(g.rows-1,cy+3);yy++)for(let xx=Math.max(0,cx-3);xx<=Math.min(g.cols-1,cx+3);xx++){const i=yy*g.cols+xx;if(reach[i]<0)continue;const q=g.xy(i),dist=Math.hypot(q.x-toX,q.y-toY),visible=!segmentBlocked(rocks,q.x,q.y,toX,toY,0);const score=dist+(visible?0:CELL*4)+reach[i]*.05;if(score<bestScore){bestScore=score;best=i;}}
   if(best>=0){goal=best;d=flow(g,goal);}
  }
  if(d[start]<0)return {x:fromX,y:fromY,blocked:true,direct:false};
  let node=start,best=g.xy(node);
  // Look ahead along the shared flow field. Stable waypoints avoid oscillation.
  for(let step=0;step<8;step++){
   let next=-1,rank=d[node];for(const j of g.edges[node])if(d[j]>=0&&d[j]<rank){next=j;rank=d[j];}
   if(next<0)break;const p=g.xy(next);
   if(segmentBlocked(rocks,fromX,fromY,p.x,p.y,padding))break;
   node=next;best=p;
  }
  return {...best,direct:false,blocked:false,goalX:g.xy(goal).x,goalY:g.xy(goal).y};
 }
 // Exact angular events at solid polygon corners prevent a fan from bridging
 // a thin rock between two uniformly spaced rays. The same geometry drives AI.
 function visionFan(rocks,x,y,angle,half,range){
  const relative=a=>Math.atan2(Math.sin(a-angle),Math.cos(a-angle)),angles=[];
  for(let i=0;i<=32;i++)angles.push(-half+2*half*i/32);
  for(const rock of rocks||[]){
   if(!rock.cavernSolid||rock.visualOnly||Math.hypot(rock.x-x,rock.y-y)>range+rock.r)continue;
   const ca=Math.cos(rock.angle||0),sa=Math.sin(rock.angle||0);
   for(const [vx,vy] of rock.vertices){const wx=rock.x+vx*ca-vy*sa,wy=rock.y+vx*sa+vy*ca,delta=relative(Math.atan2(wy-y,wx-x));
    if(Math.abs(delta)<=half+.0001)for(const off of [-.00008,0,.00008])angles.push(clamp(delta+off,-half,half));}
  }
  angles.sort((a,b)=>a-b);
  return angles.map(delta=>{const a=angle+delta,dx=Math.cos(a),dy=Math.sin(a);let reach=Math.max(0,rayDistance(rocks,x,y,dx,dy,range)-.65);
   // Tangent/corner intersections can differ by floating-point rounding.
   // Validate the final visual segment against the physical collision test.
   if(reach>0&&segmentBlocked(rocks,x,y,x+dx*reach,y+dy*reach,0)){let lo=0,hi=reach;for(let k=0;k<20;k++){const mid=(lo+hi)*.5;if(segmentBlocked(rocks,x,y,x+dx*mid,y+dy*mid,0))hi=mid;else lo=mid;}reach=Math.max(0,lo-.65);}
   return {x:x+dx*reach,y:y+dy*reach};});
 }
 // Find a locally traversable escape direction rather than repeatedly sliding into a wall.
 function escapeTarget(rocks,w,h,x,y,goalX,goalY,padding=0,heading=0){
  const desired=Math.atan2(goalY-y,goalX-x),step=Math.max(36,padding*3),oldDistance=Math.hypot(goalX-x,goalY-y);
  let best=null,score=-Infinity;
  for(let i=0;i<16;i++){const a=desired+i*TAU/16,tx=clamp(x+Math.cos(a)*step,padding+1,w-padding-1),ty=clamp(y+Math.sin(a)*step,padding+1,h-padding-1);
   if(segmentBlocked(rocks,x,y,tx,ty,padding))continue;
   const travel=Math.hypot(tx-x,ty-y),progress=oldDistance-Math.hypot(goalX-tx,goalY-ty),value=progress*.7+travel*.35+Math.cos(a-heading)*step*.2;
   if(value>score){score=value;best={x:tx,y:ty};}}
  return best;
 }
 function pursuitTarget(rocks,w,h,actor,goal,padding,now=0){
  const x=actor.x,y=actor.y,previous=actor.caveRoute,close=Math.hypot(goal.x-x,goal.y-y),direct=!segmentBlocked(rocks,x,y,goal.x,goal.y,padding);
  if(direct){actor.caveRoute=null;return {x:goal.x,y:goal.y,direct:true,blocked:false};}
  // Hold a waypoint long enough to actually round a corner; don't pick a new
  // tangent on every collision or when the diver moves a few pixels.
  if(previous&&now<previous.until&&Math.hypot(previous.x-x,previous.y-y)>Math.max(5,padding*.25)&&Math.hypot(previous.targetX-goal.x,previous.targetY-goal.y)<CELL*1.4&&!segmentBlocked(rocks,x,y,previous.x,previous.y,padding))return previous;
  const nav=navigationTarget(rocks,w,h,x,y,goal.x,goal.y,padding);let next=nav;
  if(nav.blocked||Math.hypot(nav.x-x,nav.y-y)<Math.max(4,padding*.2)){
   // A valid attack position can be adjacent to the player's wall. Hold here
   // only if the actual target is visible, otherwise take a traversable detour.
   if(close<Math.max(35,padding*2.5)&&!segmentBlocked(rocks,x,y,goal.x,goal.y,0))return {x,y,direct:false,blocked:false,hold:true};
   next=escapeTarget(rocks,w,h,x,y,goal.x,goal.y,padding,actor.angle)||nav;
  }
  const route={...next,direct:false,targetX:goal.x,targetY:goal.y,until:now+550};actor.caveRoute=route;return route;
 }
 function path(c,pts){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
 function organicPath(c,pts){
  const n=pts.length,last=pts[n-1],first=pts[0];c.beginPath();c.moveTo((last[0]+first[0])/2,(last[1]+first[1])/2);
  for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];c.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);}c.closePath();
 }
 function linear(c,x1,y1,x2,y2,stops){const g=c.createLinearGradient(x1,y1,x2,y2);for(const [p,col]of stops)g.addColorStop(p,col);return g;}
 function radial(c,x,y,r,stops){const g=c.createRadialGradient(x,y,0,x,y,r);for(const [p,col]of stops)g.addColorStop(p,col);return g;}
 let worldCache=null;
 function worldArt(w,h){
  const rnd=rng(1729),mass=[],beams=[],particles=[],arches=[],ridges=[],growth=[];
  // Depth planes have distinct color and scale, like geological relief in a
  // submerged cavern. All coordinates are fixed in the 4800 x 3000 world.
  for(let layer=0;layer<3;layer++){
   for(let i=0;i<15;i++){
    const x=rnd()*w,y=rnd()*h,rx=300+rnd()*760,ry=150+rnd()*340,ang=(rnd()-.5)*1.3,pts=[];
    for(let j=0;j<48;j++){const a=j/48*TAU,r=.83+.09*Math.sin(a*5+i)+.05*Math.cos(a*9+layer)+.025*Math.sin(a*21+i);const xx=Math.cos(a)*rx*r,yy=Math.sin(a)*ry*r;pts.push([x+xx*Math.cos(ang)-yy*Math.sin(ang),y+xx*Math.sin(ang)+yy*Math.cos(ang)]);}
    mass.push({x,y,rx,ry,layer,pts});
   }
   for(let i=0;i<7;i++){
    const x=220+i*(w/6.8)+(layer-1)*185,y=h*(.14+.30*(i%3))+rnd()*170;
    arches.push({x,y,rx:390+rnd()*300,ry:250+rnd()*280,layer,seed:71+i+layer*23});
   }
   for(let i=0;i<4;i++){
    const x=-300+i*(w/3.2)+(layer-1)*180,y=h*(.22+((i+layer)%3)*.28),rw=1500+rnd()*1000,pts=[];
    for(let j=0;j<=52;j++){const xx=x+rw*j/52,yy=y+noise(xx,layer*9+i*4)*160+Math.sin(j*.17+i)*65;pts.push([xx,yy]);}
    for(let j=52;j>=0;j--){const xx=x+rw*j/52,yy=y+noise(xx,layer*9+i*4)*160+Math.sin(j*.17+i)*65+90+layer*60+noise(xx,i+31)*40;pts.push([xx,yy]);}
    ridges.push({x,y,rw,layer,pts});
   }
  }
  // Irregular ledges and hanging details in the starting vista; the same
  // structures continue naturally in every direction, not around the camera.
  for(let i=0;i<16;i++)beams.push({x:rnd()*w,y:rnd()*h,r:330+rnd()*700,a:.10+rnd()*.18});
  beams.push({x:w*.56,y:h*.105,r:1050,a:.32});
  for(let i=0;i<950;i++)particles.push({x:rnd()*w,y:rnd()*h,r:.45+rnd()*1.8,phase:rnd()*TAU});
  for(let i=0;i<95;i++)growth.push({x:rnd()*w,y:rnd()*h,len:12+rnd()*39,seed:i*17+71});
  return {w,h,mass,beams,particles,arches,ridges,growth};
 }
 function drawFarArch(c,o){
  const {x,y,rx,ry,layer,seed}=o;
  c.save();c.translate(x,y);c.scale(rx,ry);
  const a=.06*Math.sin(seed);
  // Asymmetric arch, not an ellipse: weathered arms enclose an open passage.
  c.beginPath();c.moveTo(-1,.72);c.bezierCurveTo(-1.2,-.2,-.62,-1.1,.12+a,-.88);
  c.bezierCurveTo(.65,-.96,1.13,-.33,1,.67);c.lineTo(.63,.72);
  c.bezierCurveTo(.83,.12,.49,-.45,.06,-.49);c.bezierCurveTo(-.46,-.63,-.79,.02,-.65,.72);c.closePath();
  c.fillStyle=['rgba(40,115,125,.41)','rgba(18,68,82,.60)','rgba(8,40,53,.75)'][layer];c.fill();
  c.strokeStyle=['rgba(83,165,172,.15)','rgba(58,120,129,.14)','rgba(34,84,91,.15)'][layer];c.lineWidth=.012;c.stroke();
  c.restore();
 }
 function paint(c,view,t,w=4800,h=3000){
  if(!worldCache||worldCache.w!==w||worldCache.h!==h)worldCache=worldArt(w,h);
  const {left,top,width,height}=view,right=left+width,bottom=top+height;
  c.save();
  c.fillStyle=linear(c,0,0,w,h,[[0,'#205964'],[.26,'#277b85'],[.56,'#175566'],[.8,'#0b3445'],[1,'#071e30']]);c.fillRect(left,top,width,height);
  // Diffuse caustic pools are placed in the map. No screen-centred spotlight.
  for(const b of worldCache.beams){if(b.x+b.r<left||b.x-b.r>right||b.y+b.r<top||b.y-b.r>bottom)continue;
   c.fillStyle=radial(c,b.x,b.y,b.r,[[0,'rgba(101,223,216,'+b.a+')'],[.45,'rgba(54,153,163,.14)'],[1,'rgba(4,26,39,0)']]);c.fillRect(b.x-b.r,b.y-b.r,b.r*2,b.r*2);}
  for(let layer=0;layer<3;layer++){
   for(const m of worldCache.mass){if(m.layer!==layer)continue;const r=Math.max(m.rx,m.ry)*1.1;if(m.x+r<left||m.x-r>right||m.y+r<top||m.y-r>bottom)continue;
    organicPath(c,m.pts);c.fillStyle=linear(c,m.x,m.y-m.ry,m.x,m.y+m.ry,
     layer===0?[[0,'#37838a'],[.55,'#286f79'],[1,'#174e60']]:layer===1?[[0,'#25606a'],[.6,'#194953'],[1,'#0d3544']]:[[0,'#153f4a'],[.55,'#10313d'],[1,'#09222f']]);
    c.globalAlpha=[.46,.58,.70][layer];c.fill();c.globalAlpha=1;
    c.strokeStyle=['rgba(110,186,187,.13)','rgba(71,137,142,.17)','rgba(55,99,105,.17)'][layer];c.lineWidth=2.4;c.stroke();
   }
   for(const a of worldCache.arches){if(a.layer!==layer||a.x+a.rx<left||a.x-a.rx>right||a.y+a.ry<top||a.y-a.ry>bottom)continue;drawFarArch(c,a);}
   for(const r of worldCache.ridges){if(r.layer!==layer||r.x+r.rw<left||r.x>right||r.y+500<top||r.y-250>bottom)continue;
    organicPath(c,r.pts);c.fillStyle=linear(c,0,r.y-130,0,r.y+270,
     [[0,['#397c80','#28616a','#143c47'][layer]],[.45,['#2b6870','#194953','#102f3d'][layer]],[1,['#1c5360','#123d49','#0b2631'][layer]]]);c.globalAlpha=.7;c.fill();c.globalAlpha=1;
    c.strokeStyle='rgba(106,182,175,.14)';c.lineWidth=2;c.stroke();
   }
  }
  // Thin silt, light-shaft noise and distant attached vegetation.
  for(const g of worldCache.growth){if(g.x<left-45||g.x>right+45||g.y<top-60||g.y>bottom+50)continue;
   const a=.08+(g.seed%7)*.017;c.strokeStyle='rgba(8,47,48,'+a+')';c.lineWidth=2;c.beginPath();c.moveTo(g.x,g.y);
   c.quadraticCurveTo(g.x+8,g.y-g.len*.5,g.x+Math.sin(t*.0009+g.seed)*6,g.y-g.len);c.stroke();
  }
  for(const p of worldCache.particles){const y=((p.y-t*.006)%h+h)%h,x=p.x+Math.sin(t*.0005+p.phase)*8;if(x<left||x>right||y<top||y>bottom)continue;
   c.fillStyle='rgba(175,228,220,'+(.14+.12*Math.sin(t*.001+p.phase)).toFixed(3)+')';c.beginPath();c.arc(x,y,p.r,0,TAU);c.fill();}
  c.restore();
 }
 const rockArtCache=new WeakMap();
 function paintRockSurface(c,r){
  path(c,r.vertices);c.fillStyle=linear(c,-r.rx,-r.ry,r.rx,r.ry,[[0,'#204d4e'],[.20,'#122e35'],[.47,'#071b23'],[1,'#02090f']]);c.fill();
  c.save();c.clip();const rnd=rng(r.seed);
  for(let j=0;j<25;j++){const x=(rnd()*2-1)*r.rx,y=(rnd()*2-1)*r.ry,l=30+rnd()*r.rx*.6;
   path(c,[[x,y],[x+l*.32,y-18],[x+l,y+10],[x+l*.71,y+36],[x-12,y+24]]);c.fillStyle=j%3===0?'rgba(65,112,108,.20)':'rgba(1,9,15,.30)';c.fill();if(j%3===0){c.strokeStyle='rgba(82,137,130,.14)';c.lineWidth=1.5;c.stroke();}}
  c.restore();
 }
 function drawRockSurface(c,r){
  const transform=c.getTransform?.(),scale=transform?Math.hypot(transform.a,transform.b):1,density=Math.max(1,Math.ceil(scale)),w=Math.ceil(r.rx*2+8),h=Math.ceil(r.ry*2+8);
  // Cache static basalt at native display density. Large rocks remain vectors.
  if(w*density>4096||h*density>4096||typeof document==='undefined'){paintRockSurface(c,r);return;}
  let art=rockArtCache.get(r);if(!art||art.density!==density){const canvas=document.createElement('canvas');canvas.width=w*density;canvas.height=h*density;const off=canvas.getContext('2d');off.setTransform(density,0,0,density,w*density/2,h*density/2);paintRockSurface(off,r);art={canvas,density};rockArtCache.set(r,art);}
  c.drawImage(art.canvas,-w/2,-h/2,w,h);
 }
 function drawRocks(c,rocks,view,t){
  const {left,top,width,height}=view,right=left+width,bottom=top+height;
  for(const r of rocks){if(!r.cavernSolid||r.submarineHull||r.x+r.r+100<left||r.x-r.r-100>right||r.y+r.r+100<top||r.y-r.r-100>bottom)continue;
   c.save();c.translate(r.x,r.y);c.rotate(r.angle||0);
   drawRockSurface(c,r);
   // Sparse kelp and branching growth follow real rock surfaces.
   for(let j=0;j<15;j++){const k=20+Math.floor(j/14*19),[x,y]=r.vertices[k],ln=16+((r.seed+j*17)%49);
    const sway=Math.sin(t*.0014+j+r.seed)*5;
    c.strokeStyle='#132e2f';c.lineWidth=2.8+(j%3);c.lineCap='round';c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+sway,y-ln*.5,x+sway*.7,y-ln);c.stroke();
    for(let k=1;k<4;k++){const yy=y-ln*k/4,xx=x+sway*k/4,side=k%2?1:-1;c.beginPath();c.moveTo(xx,yy);c.quadraticCurveTo(xx+side*12,yy-4,xx+side*15,yy-13);c.lineWidth=2;c.stroke();
     c.beginPath();c.moveTo(xx+side*6,yy-3);c.quadraticCurveTo(xx+side*22,yy-14,xx+side*13,yy-19);c.quadraticCurveTo(xx+side*10,yy-12,xx+side*6,yy-3);c.fillStyle='#173d35';c.fill();
     // No painted light dots; the diffuse light is composited separately.
    }
   }
   c.restore();
  }
 }
 function lampParameters(level=1){const lv=clamp(Math.floor(Number(level)||1),1,3);return {level:lv,range:570*Math.pow(1.22,lv-1),halfAngle:.26,halo:38+lv*7};}
 let lightLayer=null;
 function lighting(c,view,player,level,rocks,t,extraLights=[]){
  if(!player||!Number.isFinite(player.x))return;
  const {left,top,width:w,height:h}=view,p=lampParameters(level),a=Number.isFinite(player.bodyAngle)?player.bodyAngle:Number(player.angle)||0;
  const heading=Number.isFinite(player.bodyAngle)?player.bodyAngle:Number(player.angle)||0,bodyScale=(Number(player.r)||17)*.60/14;
  const x=player.x+Math.cos(heading)*42*bodyScale+Math.sin(heading)*9*bodyScale,y=player.y+Math.sin(heading)*42*bodyScale-Math.cos(heading)*9*bodyScale;
  // Render a separate darkness mask so destination-out never erases world pixels.
  if(typeof document==='undefined')return;
  const scale=Math.min(1,1600/Math.max(w,h)),cw=Math.max(1,Math.ceil(w*scale)),ch=Math.max(1,Math.ceil(h*scale));
  if(!lightLayer){lightLayer=document.createElement('canvas');}
  if(lightLayer.width!==cw||lightLayer.height!==ch){lightLayer.width=cw;lightLayer.height=ch;}
  const m=lightLayer.getContext('2d');m.setTransform(cw/w,0,0,ch/h,-left*cw/w,-top*ch/h);
  m.globalCompositeOperation='source-over';m.clearRect(left,top,w,h);m.fillStyle='rgba(0,2,5,.78)';m.fillRect(left,top,w,h);
  m.globalCompositeOperation='destination-out';
  const reveal=(r,stops)=>{m.fillStyle=radial(m,x,y,r,stops);m.fillRect(x-r,y-r,r*2,r*2);};
  // Fixed suit light: half the original 570-unit helmet range; upgrades only affect the cone.
  const suitRadius=285,suitGlow=radial(m,player.x,player.y,suitRadius,[[0,'rgba(0,0,0,.84)'],[.25,'rgba(0,0,0,.64)'],[.62,'rgba(0,0,0,.26)'],[1,'rgba(0,0,0,0)']]);m.fillStyle=suitGlow;m.fillRect(player.x-suitRadius,player.y-suitRadius,suitRadius*2,suitRadius*2);
  reveal(p.halo,[[0,'rgba(0,0,0,.99)'],[.48,'rgba(0,0,0,.40)'],[1,'rgba(0,0,0,0)']]);
  // Three feathered cone passes: the soft edge retains volumetric water
  // scattering; the actual ray hits are shared with projectile collision.
  for(const [fraction,intensity] of [[1,.20],[.88,.40],[.72,.83],[.56,.85]]){
   const arc=p.halfAngle*fraction;m.save();m.beginPath();m.moveTo(x,y);
   for(let i=0;i<=40;i++){
    const angle=a-arc+i/40*arc*2,dx=Math.cos(angle),dy=Math.sin(angle),length=rayDistance(rocks,x,y,dx,dy,p.range);
    m.lineTo(x+dx*length,y+dy*length);
   }m.closePath();m.clip();
   reveal(p.range,[[0,'rgba(0,0,0,'+intensity+')'],[.37,'rgba(0,0,0,'+(intensity*.94)+')'],[.72,'rgba(0,0,0,'+(intensity*.53)+')'],[1,'rgba(0,0,0,0)']]);m.restore();
  }
  for(const source of extraLights||[]){
   if(!source||!source.active||!Number.isFinite(source.x)||!Number.isFinite(source.y))continue;
   const radius=Math.max(30,Number(source.radius)||320),sx=source.x,sy=source.y;
   // Base light is radial and independent from the diver helmet cone.
   const strength=Number(source.strength)||1,g=radial(m,sx,sy,radius,[[0,'rgba(0,0,0,'+(.98*strength)+')'],[.42,'rgba(0,0,0,'+(.78*strength)+')'],[.78,'rgba(0,0,0,'+(.34*strength)+')'],[1,'rgba(0,0,0,0)']]);
   m.fillStyle=g;m.fillRect(sx-radius,sy-radius,radius*2,radius*2);
  }
  m.globalCompositeOperation='source-over';
  c.save();c.drawImage(lightLayer,left,top,w,h);c.restore();
  // Every rock plant remains faintly self-luminous after the darkness mask.
  c.save();c.globalCompositeOperation='screen';
  for(const source of extraLights||[]){if(!source?.active||!source.color||!Number.isFinite(source.x)||!Number.isFinite(source.y))continue;const radius=source.radius||85,glow=radial(c,source.x,source.y,radius,[[0,source.color],[1,'rgba(0,0,0,0)']]);c.globalAlpha=.25;c.fillStyle=glow;c.fillRect(source.x-radius,source.y-radius,radius*2,radius*2);c.globalAlpha=1;}
  // Suspended marine snow, world anchored and animated, visible in darkness.
  for(const p of worldCache?.particles||[]){const y=((p.y-t*.009)%worldCache.h+worldCache.h)%worldCache.h,x=p.x+Math.sin(t*.0007+p.phase)*18;if(x<left||x>left+w||y<top||y>top+h)continue;const lit=Math.hypot(x-player.x,y-player.y)<285;c.fillStyle='rgba(183,225,224,'+(lit?.42:.13)+')';c.beginPath();c.arc(x,y,p.r,0,TAU);c.fill();}
  for(const r of rocks||[]){if(!r.cavernSolid||r.submarineHull||r.x+r.r+80<left||r.x-r.r-80>left+w||r.y+r.r+80<top||r.y-r.r-80>top+h)continue;
   const ca=Math.cos(r.angle||0),sa=Math.sin(r.angle||0);
   // Emissive vegetation: light belongs to the stem and root, not a large green cloud.
   c.save();c.translate(r.x,r.y);c.rotate(r.angle||0);c.globalCompositeOperation='source-over';
   for(let j=0;j<15;j++){const k=20+Math.floor(j/14*19),[x,y]=r.vertices[k],ln=16+((r.seed+j*17)%49),sway=Math.sin(t*.0014+j+r.seed)*5;
    const glow=radial(c,x,y-3,30,[[0,'rgba(40,255,109,.19)'],[.45,'rgba(26,235,90,.08)'],[1,'rgba(0,100,30,0)']]);c.fillStyle=glow;c.fillRect(x-30,y-33,60,60);
    c.lineCap='round';c.shadowColor='#24ff78';c.shadowBlur=6;c.strokeStyle='#39ff8b';c.lineWidth=2.5;
    c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+sway,y-ln*.5,x+sway*.7,y-ln);c.stroke();
    c.lineWidth=1.5;c.strokeStyle='#23cb69';for(let i=1;i<4;i++){const yy=y-ln*i/4,xx=x+sway*i/4,side=i%2?1:-1;c.beginPath();c.moveTo(xx,yy);c.quadraticCurveTo(xx+side*12,yy-4,xx+side*15,yy-13);c.stroke();}
    c.shadowBlur=4;c.strokeStyle='#74ffad';c.lineWidth=3;c.beginPath();c.moveTo(x,y);c.lineTo(x+sway*.2,y-5);c.stroke();c.shadowBlur=0;
   }c.restore();
  }
  c.restore();
 }
 return Object.freeze({buildRocks,submarineHull,isBlocked,resolve,segmentBlocked,rayDistance,visionFan,nearestWater,navigationTarget,escapeTarget,pursuitTarget,paint,drawRocks,lampParameters,lighting});
});