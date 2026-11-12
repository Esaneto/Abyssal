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
   [.095,.82,.038,.092,.11],[.49,.16,.038,.033,.25],[.945,.12,.05,.032,-.17]
  ];
  return features.map(([fx,fy,a,b,angle],index)=>{
   const rx=s*a,ry=s*b,vertices=[];
   for(let k=0;k<48;k++){const phi=TAU*k/48;vertices.push([Math.cos(phi)*rx,Math.sin(phi)*ry]);}
   return {x:w*fx,y:h*fy,rx,ry,r:Math.max(rx,ry),angle,vertices,shade:.14+index%5*.115,seed:900+index,edge:'cavern',cavernSolid:true,visualOnly:false};
  });
 }
 function isBlocked(rocks,x,y,padding=0){
  for(const r of rocks||[]){
   if(!r.cavernSolid||r.visualOnly)continue;
   const dx=x-r.x,dy=y-r.y,reach=r.r+padding;
   if(Math.abs(dx)>reach||Math.abs(dy)>reach)continue;
   const a=-(r.angle||0),ca=Math.cos(a),sa=Math.sin(a);
   if(((dx*ca-dy*sa)/(r.rx+padding))**2+((dx*sa+dy*ca)/(r.ry+padding))**2<1)return true;
  }return false;
 }
 function resolve(rocks,fromX,fromY,toX,toY,padding=0){
  const d=Math.hypot(toX-fromX,toY-fromY),steps=clamp(Math.ceil(d/Math.max(3,padding*.6)),1,1000);
  let x=fromX,y=fromY,blocked=false;
  for(let i=1;i<=steps;i++){
   const tx=fromX+(toX-fromX)*i/steps,ty=fromY+(toY-fromY)*i/steps;
   if(!isBlocked(rocks,tx,ty,padding)){x=tx;y=ty;continue;}
   blocked=true;
   if(!isBlocked(rocks,tx,y,padding))x=tx;
   else if(!isBlocked(rocks,x,ty,padding))y=ty;
  }return {x,y,blocked};
 }
 function segmentBlocked(rocks,x1,y1,x2,y2,padding=0){
  // Exact segment/expanded-ellipse intersection: no missed thin rock at speed.
  for(const r of rocks||[]){
   if(!r.cavernSolid||r.visualOnly)continue;
   const a=-(r.angle||0),ca=Math.cos(a),sa=Math.sin(a),rx=r.rx+padding,ry=r.ry+padding;
   const ox=x1-r.x,oy=y1-r.y,dx=x2-x1,dy=y2-y1;
   const px=(ox*ca-oy*sa)/rx,py=(ox*sa+oy*ca)/ry;
   const vx=(dx*ca-dy*sa)/rx,vy=(dx*sa+dy*ca)/ry;
   const q=clamp(-(px*vx+py*vy)/(vx*vx+vy*vy||1),0,1);
   if((px+vx*q)**2+(py+vy*q)**2<1)return true;
  }return false;
 }
 const CELL=64,DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
 function gridFor(rocks,w,h,padding){
  let cache=layouts.get(rocks);if(!cache){cache=new Map();layouts.set(rocks,cache);}
  const p=Math.ceil(padding/8)*8+8,key=w+':'+h+':'+p;
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
  const g={w,h,p,cols,rows,count,xy,idAt,pass,edges,goal:-1,distance:null};cache.set(key,g);return g;
 }
 function nearestNode(g,rocks,x,y,requireLine=true){
  const at=g.idAt(x,y);if(g.pass[at]){const p=g.xy(at);if(!requireLine||!segmentBlocked(rocks,x,y,p.x,p.y,g.p-8))return at;}
  let best=-1,dist=Infinity;const cx=at%g.cols,cy=Math.floor(at/g.cols);
  for(let r=1;r<=5;r++){
   for(let yy=Math.max(0,cy-r);yy<=Math.min(g.rows-1,cy+r);yy++)for(let xx=Math.max(0,cx-r);xx<=Math.min(g.cols-1,cx+r);xx++){
    const i=yy*g.cols+xx;if(!g.pass[i])continue;const p=g.xy(i),d=Math.hypot(p.x-x,p.y-y);
    if(d<dist&&(!requireLine||!segmentBlocked(rocks,x,y,p.x,p.y,g.p-8))){best=i;dist=d;}
   }if(best>=0)return best;
  }return best;
 }
 function nearestWater(rocks,w,h,x,y,padding=0){
  x=clamp(x,padding+1,w-padding-1);y=clamp(y,padding+1,h-padding-1);
  if(!isBlocked(rocks,x,y,padding))return {x,y};
  const g=gridFor(rocks,w,h,padding),id=nearestNode(g,rocks,x,y,false);return id<0?null:g.xy(id);
 }
 function flow(g,goal){
  if(g.goal===goal&&g.distance)return g.distance;
  const d=new Int32Array(g.count);d.fill(-1);const q=new Int32Array(g.count);let head=0,tail=0;
  d[goal]=0;q[tail++]=goal;
  while(head<tail){const i=q[head++];for(const j of g.edges[i])if(d[j]<0){d[j]=d[i]+1;q[tail++]=j;}}
  g.goal=goal;g.distance=d;return d;
 }
 function navigationTarget(rocks,w,h,fromX,fromY,toX,toY,padding=0){
  if(!segmentBlocked(rocks,fromX,fromY,toX,toY,padding+5))return {x:toX,y:toY,direct:true,blocked:false};
  const g=gridFor(rocks,w,h,padding),start=nearestNode(g,rocks,fromX,fromY),goal=nearestNode(g,rocks,toX,toY,false);
  if(start<0||goal<0)return {x:fromX,y:fromY,blocked:true,direct:false};
  const d=flow(g,goal);if(d[start]<0)return {x:fromX,y:fromY,blocked:true,direct:false};
  let node=start,best=g.xy(node);
  // Look ahead along the shared flow field. Stable waypoints avoid oscillation.
  for(let step=0;step<8;step++){
   let next=-1,rank=d[node];for(const j of g.edges[node])if(d[j]>=0&&d[j]<rank){next=j;rank=d[j];}
   if(next<0)break;const p=g.xy(next);
   if(segmentBlocked(rocks,fromX,fromY,p.x,p.y,padding+4))break;
   node=next;best=p;
  }
  return {...best,direct:false,blocked:false};
 }
 function path(c,pts){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
 function linear(c,x1,y1,x2,y2,stops){const g=c.createLinearGradient(x1,y1,x2,y2);for(const [p,col]of stops)g.addColorStop(p,col);return g;}
 function radial(c,x,y,r,stops){const g=c.createRadialGradient(x,y,0,x,y,r);for(const [p,col]of stops)g.addColorStop(p,col);return g;}
 let worldCache=null;
 function worldArt(w,h){
  const rnd=rng(1729),mass=[],beams=[],particles=[];
  // Fixed world silhouettes, distributed in both axes, never camera-relative.
  for(let layer=0;layer<3;layer++){
   for(let i=0;i<28;i++){
    const x=rnd()*w,y=rnd()*h,rx=190+rnd()*560,ry=95+rnd()*280,ang=(rnd()-.5)*1.5,pts=[];
    for(let j=0;j<38;j++){const a=j/38*TAU,r=.88+.09*Math.sin(a*5+i)+.04*Math.cos(a*13+layer);const xx=Math.cos(a)*rx*r,yy=Math.sin(a)*ry*r;pts.push([x+xx*Math.cos(ang)-yy*Math.sin(ang),y+xx*Math.sin(ang)+yy*Math.cos(ang)]);}
    mass.push({x,y,rx,ry,layer,pts});
   }
  }
  for(let i=0;i<20;i++)beams.push({x:rnd()*w,y:rnd()*h,r:280+rnd()*650,a:.07+rnd()*.12});
  for(let i=0;i<240;i++)particles.push({x:rnd()*w,y:rnd()*h,r:.5+rnd()*2,phase:rnd()*TAU});
  return {w,h,mass,beams,particles};
 }
 function paint(c,view,t,w=4800,h=3000){
  if(!worldCache||worldCache.w!==w||worldCache.h!==h)worldCache=worldArt(w,h);
  const {left,top,width,height}=view,right=left+width,bottom=top+height;
  c.save();c.fillStyle=linear(c,0,0,w,h,[[0,'#0d4851'],[.35,'#155d65'],[.73,'#08323e'],[1,'#051c29']]);c.fillRect(left,top,width,height);
  for(const b of worldCache.beams){if(b.x+b.r<left||b.x-b.r>right||b.y+b.r<top||b.y-b.r>bottom)continue;
   c.fillStyle=radial(c,b.x,b.y,b.r,[[0,'rgba(69,183,184,'+b.a+')'],[.5,'rgba(31,118,127,.09)'],[1,'rgba(4,26,39,0)']]);c.fillRect(b.x-b.r,b.y-b.r,b.r*2,b.r*2);}
  for(const m of worldCache.mass){const r=Math.max(m.rx,m.ry);if(m.x+r<left||m.x-r>right||m.y+r<top||m.y-r>bottom)continue;
   path(c,m.pts);c.fillStyle=['#1c6570','#103e4a','#092a36'][m.layer];c.globalAlpha=[.35,.48,.57][m.layer];c.fill();
   c.strokeStyle=['#38818a','#25616d','#17434c'][m.layer];c.lineWidth=4;c.stroke();
  }
  c.globalAlpha=1;
  // Long, eroded distant strata are anchored to the world, not screen edges.
  for(let j=0;j<5;j++){const base=h*(.13+j*.19);c.beginPath();c.moveTo(0,base);for(let x=0;x<=w+25;x+=25)c.lineTo(x,base+noise(x,j*9)*80);
   c.strokeStyle='rgba(46,121,130,.15)';c.lineWidth=15;c.stroke();}
  for(const p of worldCache.particles){const y=((p.y-t*.006)%h+h)%h,x=p.x+Math.sin(t*.0005+p.phase)*8;if(x<left||x>right||y<top||y>bottom)continue;
   c.fillStyle='rgba(147,213,210,'+(.12+.10*Math.sin(t*.001+p.phase)).toFixed(3)+')';c.beginPath();c.arc(x,y,p.r,0,TAU);c.fill();}
  c.restore();
 }
 function drawRocks(c,rocks,view,t){
  const {left,top,width,height}=view,right=left+width,bottom=top+height;
  for(const r of rocks){if(!r.cavernSolid||r.x+r.r+100<left||r.x-r.r-100>right||r.y+r.r+100<top||r.y-r.r-100>bottom)continue;
   c.save();c.translate(r.x,r.y);c.rotate(r.angle||0);
   // Physical ellipse silhouette and layered fractured basalt, without neon rims.
   path(c,r.vertices);c.fillStyle=linear(c,-r.rx,-r.ry,r.rx,r.ry,[[0,'#17373b'],[.19,'#0a2329'],[.54,'#06151d'],[1,'#020b12']]);c.fill();
   c.save();c.clip();const rnd=rng(r.seed);
   for(let j=0;j<14;j++){const x=(rnd()*2-1)*r.rx,y=(rnd()*2-1)*r.ry,l=30+rnd()*r.rx*.6;
    path(c,[[x,y],[x+l*.32,y-18],[x+l,y+10],[x+l*.71,y+36],[x-12,y+24]]);
    c.fillStyle=j%3===0?'rgba(44,85,82,.14)':'rgba(1,9,15,.30)';c.fill();}
   c.restore();
   // Sparse kelp and branching growth follow real rock surfaces.
   for(let j=0;j<8;j++){const a=-Math.PI+.15+j/7*(Math.PI-.3),x=Math.cos(a)*r.rx,y=Math.sin(a)*r.ry,ln=15+((r.seed+j*17)%37);
    const sway=Math.sin(t*.0014+j+r.seed)*5;
    c.strokeStyle='#112d2d';c.lineWidth=3+(j%3);c.lineCap='round';c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+sway,y-ln*.5,x+sway*.7,y-ln);c.stroke();
    for(let k=1;k<4;k++){const yy=y-ln*k/4,xx=x+sway*k/4,side=k%2?1:-1;c.beginPath();c.moveTo(xx,yy);c.quadraticCurveTo(xx+side*12,yy-4,xx+side*15,yy-13);c.lineWidth=2;c.stroke();}
   }
   c.restore();
  }
 }
 function lampParameters(level=1){const lv=clamp(Math.floor(Number(level)||1),1,3);return {level:lv,range:570*Math.pow(1.22,lv-1),halfAngle:.39,halo:94+lv*10};}
 let lightLayer=null;
 function lighting(c,view,player,level,rocks,t){
  if(!player||!Number.isFinite(player.x))return;
  const {left,top,width:w,height:h}=view,p=lampParameters(level),a=Number.isFinite(player.weaponAngle)?player.weaponAngle:Number(player.angle)||0;
  const x=player.x,y=player.y;
  // Render a separate darkness mask so destination-out never erases world pixels.
  if(typeof document==='undefined')return;
  const scale=Math.min(1,1600/Math.max(w,h)),cw=Math.max(1,Math.ceil(w*scale)),ch=Math.max(1,Math.ceil(h*scale));
  if(!lightLayer){lightLayer=document.createElement('canvas');}
  if(lightLayer.width!==cw||lightLayer.height!==ch){lightLayer.width=cw;lightLayer.height=ch;}
  const m=lightLayer.getContext('2d');m.setTransform(cw/w,0,0,ch/h,-left*cw/w,-top*ch/h);
  m.globalCompositeOperation='source-over';m.clearRect(left,top,w,h);m.fillStyle='rgba(0,6,10,.74)';m.fillRect(left,top,w,h);
  m.globalCompositeOperation='destination-out';
  const reveal=(r,stops)=>{m.fillStyle=radial(m,x,y,r,stops);m.fillRect(x-r,y-r,r*2,r*2);};
  reveal(p.halo,[[0,'rgba(0,0,0,.99)'],[.48,'rgba(0,0,0,.78)'],[1,'rgba(0,0,0,0)']]);
  // Raycast the beam against the same physical solids used by shots and AI.
  m.save();m.beginPath();m.moveTo(x,y);
  for(let i=0;i<=72;i++){const angle=a-p.halfAngle+i/72*p.halfAngle*2,dx=Math.cos(angle),dy=Math.sin(angle);
   let lo=0,hi=p.range;
   if(segmentBlocked(rocks,x,y,x+dx*hi,y+dy*hi,0)){for(let k=0;k<10;k++){const mid=(lo+hi)/2;if(segmentBlocked(rocks,x,y,x+dx*mid,y+dy*mid,0))hi=mid;else lo=mid;}}else lo=hi;
   m.lineTo(x+dx*lo,y+dy*lo);
  }m.closePath();m.clip();
  reveal(p.range,[[0,'rgba(0,0,0,1)'],[.40,'rgba(0,0,0,.94)'],[.76,'rgba(0,0,0,.55)'],[1,'rgba(0,0,0,0)']]);
  m.restore();m.globalCompositeOperation='source-over';
  c.save();c.drawImage(lightLayer,left,top,w,h);c.restore();
 }
 return Object.freeze({buildRocks,isBlocked,resolve,segmentBlocked,nearestWater,navigationTarget,paint,drawRocks,lampParameters,lighting});
});