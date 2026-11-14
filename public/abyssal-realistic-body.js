/* Abyssal anatomical pressure suit. Coordinates are shared with diver-art's
 * existing weapon rig; geometry, gameplay scale and equipment anchors stay intact. */
(function(root){'use strict';

// All positions use the original head coordinate system (+x toward the crown).
// Each lock has a fixed root; only the free length is deformed by water.
// Layers are intentionally separate so future eyewear and head accessories can
// be added without baking them into the hair or changing combat geometry.
const HAIR_STYLES=Object.freeze(['classic','short','long','shaved','whiteLong','wildGreen','silverBraid','tealSpikes','whiteCurls','greenUndercut','ghostStraight','abyssPunk','sideSweep','asymBob','topKnot','twinBraids','dreadlocks','mohawk']);
const HAIR_ANCHOR=Object.freeze([31,0]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hairGeometry(style,time=0,weight=0,flow=0){
 if(!HAIR_STYLES.includes(style))style='classic';
 time=Number.isFinite(time)?time:0;weight=clamp(Number(weight)||0,0,1);flow=clamp(Number(flow)||0,0,1);
 const seconds=time*.001,locks=[];
 // Cubic centreline sampled in normalized distance. Displacement is zero
 // at the root and grows quadratically toward the tip. No whole-hair rotation.
 function lock(layer,root,a,b,tip,width,flex=1,accent=false,texture='ribbon'){
  const seed=locks.length*1.71,points=[],count=16;
  for(let i=0;i<=count;i++){
   const u=i/count,v=1-u,env=u*u,osc=Math.sin(seconds*1.9+seed-u*4.2),slow=Math.sin(seconds*1.1+seed*.71-u*2.5);
   const x=v*v*v*root[0]+3*v*v*u*a[0]+3*v*u*u*b[0]+u*u*u*tip[0] +env*flex*(slow*1.6-weight*3.4-flow*5.5);
   const y=v*v*v*root[1]+3*v*v*u*a[1]+3*v*u*u*b[1]+u*u*u*tip[1]+env*flex*(osc*(1.5+weight*1.7+flow*2.8))+(texture==='wave'?Math.sin(u*Math.PI*3+seed)*Math.sin(u*Math.PI)*4.5:0);
   points.push([x,y]);
  }
  locks.push({layer,root:[...root],points,width,accent,texture});
 }
 const crown=(side,reach=12,width=5,accent=false)=>{for(let j=0;j<4;j++){const k=j/3;lock('crown',[34+1.4*k,side*(2+4*k)],[40+reach*.22,side*(2+6*k)],[42+reach*.55-j*2,side*(8+5*k)],[38+reach-j*3,side*(8+12*k)],width*(.56-.05*j),.48,accent);}};
 const tail=(side,len,spread,width,i=0,accent=false)=>lock('back',[28+i*.6,side*(5+i*.6)],[24,side*(11+i*2)],[12-len*.36,side*(spread+i*2+3*Math.sin(i*2))],[26-len,side*(spread+i*2)],width*.75,1,accent);
 if(style==='shaved')return locks;
 if(style==='classic'||style==='short'){
  for(const side of [-1,1])lock('crown',[33,side*3],[40,side*2],[41,side*7],[34,side*10],style==='short'?2.2:3.3,.22);
  if(style==='classic')tail(-1,20,15,3.5);
 }else if(style==='long'||style==='whiteLong'){
  const n=style==='whiteLong'?9:5;
  for(const side of [-1,1]){for(let i=0;i<n;i++)tail(side,style==='whiteLong'?42+i*2:31+i*3,15+i*1.6,4.7-i*.22,i*.25);crown(side,style==='whiteLong'?9:5,5);}
  lock('crown',[34,0],[43,-3],[54,-12],[48,-22],5.5,.65);
 }else if(style==='wildGreen'){
  for(const side of [-1,1]){for(let i=0;i<9;i++)lock('back',[27+i*.7,side*(4+i*.4)],[26+i*.5,side*(15+i*1.1)],[3-i*3,side*(31-i*.55+3*Math.sin(i))],[-3-i*3,side*(17+i*1.8)],3.5-i*.12,1.15,false,'wave');crown(side,14,5);}
  for(let i=0;i<6;i++)lock('crown',[33+i*.35,-2+i*.8],[44,2-i*.8],[50-i*1.4,8-i*3],[53-i*1.4,-12-i*2],2.7-i*.13,.8,false,'wave');
 }else if(style==='silverBraid'){
  crown(-1,7,5);crown(1,5,4);tail(-1,26,15,4);
  lock('braid',[28,8],[18,15],[0,21],[-24,19],4.5,.72);
 }else if(style==='tealSpikes'){
  for(let i=0;i<9;i++){const k=(i-4)/4;lock('crown',[33, k*6],[41,k*8],[48+7*(1-Math.abs(k)),k*17],[52+7*(1-Math.abs(k)),k*25],3.4,.26);}
  for(const side of [-1,1])tail(side,20,19,3);
 }else if(style==='whiteCurls'){
  for(let i=0;i<18;i++){const a=i*Math.PI*2/18,dx=Math.cos(a),dy=Math.sin(a),r=17+(i%3)*3;
   // Rear curls keep the face clear; crown curls sit around the exposed scalp.
   lock(dx>-.15?'crown':'back',[31+dx*4,dy*5],[33+dx*r*.8,dy*r*.9],[31+dx*r-dy*10,dy*r+dx*10],[31+dx*r*.76+dy*4,dy*r*.8-dx*6],3.6,.65);
  }
 }else if(style==='greenUndercut'){
  for(let i=0;i<5;i++)lock('crown',[34,-2+i*1.3],[47,0-i*2],[48-i*3,-19-i*2],[29-i*5,-24-i*2],4.6-i*.4,.7);
  tail(-1,36,24,4);
 }else if(style==='ghostStraight'){
  for(const side of [-1,1]){for(let i=0;i<7;i++)lock('back',[31,side*(2+i*.55)],[22,side*(11+i*1.4)],[0,side*(17+i*2)],[-35+i*2.4,side*(18+i*1.8)],3.7-i*.23,.62);crown(side,4,4);}
 }else if(style==='abyssPunk'){
  for(let i=0;i<6;i++)lock('crown',[34,-4+i*1.6],[45,-2+i],[51-i*2,-14-i*2],[45-i*5,-26-i],4.7-i*.35,.65,i%3===1);
  for(let i=0;i<4;i++)tail(-1,33+i*5,24+i*2,4.5-i*.5,i*.2,i%2===0);
  lock('braid',[29,8],[18,14],[2,22],[-18,17],3.2,.65,true);
 }else if(style==='sideSweep'){
  for(let i=0;i<10;i++)lock('crown',[34-i*.25,-4+i*.8],[43,2+i*.6],[45-i*1.5,-16-i],[26-i*1.6,-19-i*1.3],3.1-i*.12,.75);tail(-1,27,19,4);
 }else if(style==='asymBob'){
  crown(-1,4,4);crown(1,3,3);for(const side of [-1,1])for(let i=0;i<7;i++)tail(side,side<0?29+i*.8:19+i*.6,12+i*1.4,3.6,i*.3);
 }else if(style==='topKnot'){
  lock('knot',[34,0],[39,0],[44,0],[47,0],8.0,.18);for(const side of [-1,1])for(let i=0;i<3;i++)lock('crown',[33+i*.5,side*(2+i)],[39,side*(4+i)],[43,side*(3+i)],[45,side*(1+i)],2.5,.19);tail(-1,16,12,2);
 }else if(style==='twinBraids'){
  crown(-1,5,4);crown(1,5,4);for(const side of [-1,1])lock('braid',[28,side*7],[19,side*17],[1,side*20],[-29,side*18],4.2,.74);
 }else if(style==='dreadlocks'){
  crown(-1,7,5);crown(1,7,5);for(const side of [-1,1])for(let i=0;i<6;i++)lock('back',[29+i*.45,side*(3+i*.65)],[23,side*(11+i*2)],[0-i*2,side*(15+i*2)],[-20-i*2,side*(14+i*2.4)],2.4,.78,false,'loc');
 }else if(style==='mohawk'){
  for(let i=0;i<11;i++){const k=(i-5)/5;lock('crown',[34,k*5],[43,k*6],[53+4*(1-Math.abs(k)),k*9],[57-4*Math.abs(k),k*13],2.3,.26);}
 }
 return locks;
}
function drawHairLayer(c,locks,layer,hair,detail=true){
 const color=hair||['#121920','#46505b','#232b34'];
 for(const lock of locks){
  if(lock.layer!==layer)continue;
  const p=lock.points,n=p.length,w=lock.width,pal=lock.accent?['#163b2a','#a1ed69','#419d54']:color;
  const root=p[0],tip=p[n-1],g=c.createLinearGradient(root[0],root[1],tip[0],tip[1]);
  g.addColorStop(0,pal[0]);g.addColorStop(.23,pal[2]);g.addColorStop(.49,pal[1]);g.addColorStop(.82,pal[2]);g.addColorStop(1,pal[0]);
  if(layer==='knot'){c.save();c.translate(tip[0],tip[1]);const bun=c.createLinearGradient(-w,-w,w,w);bun.addColorStop(0,pal[0]);bun.addColorStop(.36,pal[1]);bun.addColorStop(.72,pal[2]);bun.addColorStop(1,pal[0]);c.fillStyle=bun;c.strokeStyle=pal[0];c.lineWidth=.65;c.beginPath();c.ellipse(0,0,w,w*.83,0,0,Math.PI*2);c.fill();c.stroke();for(let j=0;j<4;j++){c.strokeStyle=j%2?pal[0]:pal[1];c.lineWidth=.42;c.beginPath();c.ellipse(-.6+j*.3,0,w*(.31+j*.17),w*(.25+j*.14),-.36,Math.PI*.10,Math.PI*1.93);c.stroke();}c.restore();continue;}
  if(lock.texture==='loc'){c.save();c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(...p[0]);for(let i=1;i<n;i++)c.lineTo(...p[i]);c.strokeStyle=pal[0];c.lineWidth=w*1.85;c.stroke();c.strokeStyle=g;c.lineWidth=w*1.45;c.stroke();if(detail){for(let i=2;i<n;i+=2){const a=p[i-1],b=p[i],angle=Math.atan2(b[1]-a[1],b[0]-a[0]);c.save();c.translate(b[0],b[1]);c.rotate(angle);c.strokeStyle=pal[0];c.lineWidth=.38;c.beginPath();c.moveTo(-.6,-w*.55);c.quadraticCurveTo(.5,0,.1,w*.55);c.stroke();c.restore();}}c.restore();continue;}
  if(layer==='braid'){
   for(let i=0;i<n-1;i++){const a=p[i],b=p[i+1],angle=Math.atan2(b[1]-a[1],b[0]-a[0]),size=w*(1-i/n*.58);c.save();c.translate(a[0],a[1]);c.rotate(angle+(i%2?.35:-.35));c.fillStyle=g;c.strokeStyle=pal[0];c.lineWidth=.6;c.beginPath();c.ellipse(0,0,Math.max(2,size*1.13),Math.max(1.3,size*.67),0,0,Math.PI*2);c.fill();c.stroke();c.restore();}
   const q=p[n-2];c.save();c.translate(q[0],q[1]);c.rotate(Math.atan2(tip[1]-q[1],tip[0]-q[0]));c.fillStyle='#a0d5bd';c.fillRect(-1.2,-2.2,2.4,4.4);c.restore();continue;
  }
  const left=[],right=[];
  for(let i=0;i<n;i++){
   const a=p[Math.max(0,i-1)],b=p[Math.min(n-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,u=i/(n-1),radius=w*(.82+.18*Math.sin(u*Math.PI))*Math.pow(1-u,.48)+.13;
   left.push([p[i][0]-dy/len*radius,p[i][1]+dx/len*radius]);right.push([p[i][0]+dy/len*radius,p[i][1]-dx/len*radius]);
  }
  const smooth=(points)=>{for(let i=1;i<points.length-1;i++){const a=points[i],b=points[i+1];c.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);}c.lineTo(...points.at(-1));};
  c.beginPath();c.moveTo(...left[0]);smooth(left);c.lineTo(...right.at(-1));smooth([...right].reverse());c.closePath();c.fillStyle=g;c.fill();c.strokeStyle=pal[0];c.lineWidth=.26;c.stroke();
  if(detail){c.save();for(const off of [-.48,.08,.53]){const strand=p.map((q,i)=>[q[0]+(left[i][0]-q[0])*off,q[1]+(left[i][1]-q[1])*off]);c.beginPath();c.moveTo(...strand[0]);smooth(strand);c.strokeStyle=off<0?pal[0]:pal[1];c.lineWidth=.30;c.globalAlpha=off<0?.48:.43;c.stroke();}c.restore();}
 }
}


// Lightweight world-oriented strand solver. Five nodes per lock, semi-implicit
// integration, fixed root, rest-length projection and spring bending. Visual only.
function simulateHair(style,t,heading,motion,weight,flow,reduced=false){
 const rest=hairGeometry(style,0,0,0);
 if(reduced)return rest;
 if(!motion)return hairGeometry(style,t,weight,flow);
 const co=Math.cos(heading),si=Math.sin(heading),toWorld=p=>[p[0]*co-p[1]*si,p[0]*si+p[1]*co],toLocal=p=>[p[0]*co+p[1]*si,-p[0]*si+p[1]*co];
 let state=motion.hairState;
 if(!state||state.style!==style||state.locks.length!==rest.length||!Number.isFinite(state.time)||Math.abs(t-state.time)>400){
  state={style,time:t,locks:rest.map(l=>{const nodes=[0,4,8,12,16].map(i=>toWorld(l.points[i]));return {nodes,vel:nodes.map(()=>[0,0])};})};motion.hairState=state;
 }
 const elapsed=clamp((t-state.time)/1000,0,.065),steps=Math.max(1,Math.ceil(elapsed/.016)),dt=elapsed/steps;state.time=t;
 const vx=Number(motion.flowX)||0,vy=Number(motion.flowY)||0;
 for(let k=0;k<rest.length;k++){
  const l=rest[k],q=state.locks[k],target=[0,4,8,12,16].map(i=>toWorld(l.points[i])),lengths=target.slice(1).map((p,i)=>Math.hypot(p[0]-target[i][0],p[1]-target[i][1]));
  const stiff=l.layer==='knot'?28:l.layer==='braid'?8:l.layer==='crown'?19:5.5,drag=l.layer==='knot'?11:7.5,dragGain=l.layer==='knot'?.18:l.layer==='crown'?.43:1,gravity=l.layer==='braid'||l.texture==='loc'?12:l.layer==='crown'?5:8;
  for(let step=0;step<steps;step++){
   const before=q.nodes.map(p=>[...p]);q.nodes[0]=target[0];q.vel[0]=[0,0];
   for(let i=1;i<5;i++){
    const p=q.nodes[i],v=q.vel[i],u=i/4,ambientX=Math.sin(t*.0011+k*.47+i*.65)*2.1,ambientY=Math.cos(t*.0014+k*.33+i*.82)*1.6;
    // Relative fluid flow opposes actual velocity. Weak net downward weight:
    // water offsets most, not all, gravitational acceleration.
    const ax=(target[i][0]-p[0])*stiff+(-vx*22*dragGain+ambientX-v[0])*drag*u;
    const ay=(target[i][1]-p[1])*stiff+(-vy*22*dragGain+ambientY-v[1])*drag*u+gravity*u;
    v[0]=clamp(v[0]+ax*dt,-125,125);v[1]=clamp(v[1]+ay*dt,-125,125);p[0]+=v[0]*dt;p[1]+=v[1]*dt;
   }
   // Project every segment to its original length, keeping root fixed.
   for(let i=1;i<5;i++){const a=q.nodes[i-1],b=q.nodes[i],dx=b[0]-a[0],dy=b[1]-a[1],L=lengths[i-1];const restA=target[i-1],restB=target[i],restAngle=Math.atan2(restB[1]-restA[1],restB[0]-restA[0]);const ref=i===1?restAngle:Math.atan2(a[1]-q.nodes[i-2][1],a[0]-q.nodes[i-2][0]);const limit=i===1?.58:l.layer==='crown'?1.0:1.45;const raw=Math.atan2(dy,dx),delta=Math.atan2(Math.sin(raw-ref),Math.cos(raw-ref));let angle=ref+clamp(delta,-limit,limit);
    const clearance=(v)=>{const p=toLocal(v),ellipse=(x,y,rx,ry)=>((p[0]-x)/rx)**2+((p[1]-y)/ry)**2;return Math.min(ellipse(31,0,9,8),ellipse(0,0,20,12));};
    if(i>=2&&l.layer==='back'&&clearance(restB)>1.08){const candidate=ang=>[a[0]+Math.cos(ang)*L,a[1]+Math.sin(ang)*L];if(clearance(candidate(angle))<1){let best=angle,score=clearance(candidate(angle));for(let j=-4;j<=4;j++){const ang=ref+limit*j/4,q=clearance(candidate(ang));if(q>score){best=ang;score=q;}}angle=best;}}
    b[0]=a[0]+Math.cos(angle)*L;b[1]=a[1]+Math.sin(angle)*L;}
   if(dt>0)for(let i=1;i<5;i++){q.vel[i][0]=clamp((q.nodes[i][0]-before[i][0])/dt,-125,125);q.vel[i][1]=clamp((q.nodes[i][1]-before[i][1])/dt,-125,125);}
  }
  q.nodes[0]=target[0];
  // Smooth constrained control nodes with bounded cubic Hermite tangents.
  // Avoid the sharp folds created by adding a rotated rest curve twice.
  const p=q.nodes,tangent=(i,max)=>{const a=p[Math.max(0,i-1)],b=p[Math.min(4,i+1)],x=(b[0]-a[0])*.5,y=(b[1]-a[1])*.5,n=Math.hypot(x,y)||1,scale=Math.min(1,max/n);return [x*scale,y*scale];};
  l.points=l.points.map((_,i)=>{if(!i)return [...l.root];const j=Math.min(3,Math.floor(i/4)),u=(i-j*4)/4,u2=u*u,u3=u2*u,a=p[j],b=p[j+1],L=lengths[j],m=tangent(j,L),n=tangent(j+1,L);return toLocal([a[0]*(2*u3-3*u2+1)+m[0]*(u3-2*u2+u)+b[0]*(-2*u3+3*u2)+n[0]*(u3-u2),a[1]*(2*u3-3*u2+1)+m[1]*(u3-2*u2+u)+b[1]*(-2*u3+3*u2)+n[1]*(u3-u2)]);});
 }
 return rest;
}

function body(c,t,options,look={}){
 const rig=root.AbyssalDiverRig,phase=Number.isFinite(options.motion?.phase)?options.motion.phase:(Number(t)||0)*.008,swim=options.moving!==false,female=options.gender==='female';
 const weight=Number.isFinite(options.motion?.weight)?options.motion.weight:(swim?1:0),powered=Boolean(options.motion?.powered||options.propulsorActive),heading=Number(options.heading)||0;
 const kind=look.outfitId||'navy',industrial=kind==='rust',polar=kind==='ice',scout=kind==='olive';
 const s=look.outfit||['#101923','#263847','#39536a','#668293','#b4c8cc'],f=look.fins||['#15242c','#60858e','#9db6b8'],tank=look.back||['#14252e','#77929b','#455e69','#263e49','#101b24'],hair=look.hair||['#121920','#46505b','#232b34'],glass=look.visor||['#b5d8d9','#568a99','#264b60','#102631'];
 const path=(fn,fill,stroke,width=.7)=>{c.beginPath();fn();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}};
 const line=(a,b,color,width=.7)=>path(()=>{c.moveTo(...a);c.lineTo(...b);},null,color,width);
 const light=options.light||{intensity:.72,depth:0,angle:-1.2},intensity=clamp(Number(light.intensity)||0,0,1),depth=clamp((Number(light.depth)||0)/1400,0,1),lightAngle=(Number(light.angle)||0)-heading;
 const tone=(color,p=.5)=>{if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))return color;const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),shade=.74+.26*intensity-.10*depth,boost=Math.max(0,1-Math.abs(p-.33)*2)*intensity*.10;return '#'+rgb.map((v,i)=>Math.round(clamp(v*shade+(i===0?13:i===1?27:36)*boost,0,255)).toString(16).padStart(2,'0')).join('');};
 const grad=(a,b,stops)=>{const g=c.createLinearGradient(...a,...b),dir=(b[0]-a[0])*Math.cos(lightAngle)+(b[1]-a[1])*Math.sin(lightAngle),reverse=dir>0;for(const [p,v] of stops)g.addColorStop(p,tone(v,reverse?1-p:p));return g;};
 const oval=(x,y,rx,ry,fill,stroke,width=.7)=>path(()=>c.ellipse(x,y,rx,ry,0,0,Math.PI*2),fill,stroke,width);
 const box=(x,y,w,h,r,fill,stroke,width=.7)=>path(()=>c.roundRect(x,y,w,h,r),fill,stroke,width);
 const view=options.view||rig?.viewFor?.(0),yaw=view?.yaw||0,detail=options.detail!==false,bulk=industrial?1.10:polar?1.13:scout?.96:1;
 // Continuous tapered anatomical limbs: shoulder/hip volume, muscle belly,
 // narrowed joint, then wrist/ankle. No spherical robot joints.
 function limb(a,b,thickness,base,highlight){
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,w=thickness*.59*bulk,v=w*.57;
  c.save();c.translate(...a);c.rotate(Math.atan2(dy,dx));
  const shade=grad([0,-w],[0,w],[[0,'#101d28'],[.22,base],[.40,highlight],[.64,base],[1,'#08131c']]);
  path(()=>{c.moveTo(-1,-w*.75);c.bezierCurveTo(len*.14,-w*1.10,len*.42,-w*.94,len*.72,-v*.91);c.quadraticCurveTo(len*.94,-v,len,-v);c.quadraticCurveTo(len+v*.66,0,len,v);c.bezierCurveTo(len*.72,v*.98,len*.35,w*.88,-1,w*.73);c.quadraticCurveTo(-w*.65,0,-1,-w*.75);c.closePath();},shade,'#0a151e',.65);
  if(detail){path(()=>{c.moveTo(len*.15,-w*.50);c.quadraticCurveTo(len*.38,-w*.70,len*.77,-v*.46);},null,'#b8d0d43b',.55);path(()=>{c.moveTo(len*.78,-v*.85);c.quadraticCurveTo(len*.81,0,len*.77,v*.85);},null,'#07131b99',.5);}
  if(industrial||polar){const panel=grad([0,-w],[0,w],[[0,s[1]],[.38,s[3]],[.72,s[2]],[1,s[0]]]);path(()=>{c.moveTo(len*.14,-w*.70);c.lineTo(len*.38,-w*.78);c.lineTo(len*.65,-v*.70);c.lineTo(len*.58,v*.69);c.lineTo(len*.22,w*.65);c.closePath();},panel,'#182a33',.45);}
  c.restore();
 }
 limb.joint=(p,r)=>{oval(p[0],p[1],r*.83,r*.72,grad([p[0]-r,p[1]-r],[p[0]+r,p[1]+r],[[0,s[2]],[.55,s[1]],[1,s[0]]]),'#16252e',.35);};
 // Flattened palms, thumb and fingers follow the forearm; hand center is
 // shared with the equipment grip. Resting fingers are longer than a fist.
 limb.glove=(hand,wrist,gripping=false)=>{const angle=Math.atan2(hand[1]-wrist[1],hand[0]-wrist[0]);c.save();c.translate(...hand);c.rotate(angle);
  const g=grad([-3,-2.5],[3,2.5],[[0,'#657d83'],[.32,'#344a55'],[.68,'#1c303b'],[1,'#0b1720']]),end=gripping?3.4:5.2;
  path(()=>{c.moveTo(-4,-1.8);c.quadraticCurveTo(-2,-2.8,.7,-2.4);c.quadraticCurveTo(end,-2.5,end,0);c.quadraticCurveTo(end,2.4,1,2.6);c.lineTo(-3,1.9);c.closePath();},g,'#0b1720',.55);
  path(()=>{c.moveTo(-1,1.8);c.quadraticCurveTo(0,3.5,2.2,2.4);c.lineTo(gripping?1.2:3.4,1.3);},null,'#81979a',.5);
  for(const x of [1.4,2.6,3.6])line([x,-1.7],[x,gripping?.3:1.3],'#a9c0c14c',.35);
  box(-4.4,-2.2,1.9,4.4,.6,'#20333e','#58717d',.42);c.restore();
 };

 c.save();if(view)c.transform(1,view.shear,0,view.width,0,0);
 const hairStyle=look.hairStyle||'classic',hairFlow=Number.isFinite(options.motion?.hairFlow)?options.motion.hairFlow:(powered?1:0),locks=simulateHair(hairStyle,Number(t)||0,heading,options.motion,weight,hairFlow,options.reducedMotion);
 c.save();drawHairLayer(c,locks,'back',hair,detail);c.restore();
 // Low-profile paired tanks sit behind the rib cage; their outer edges alone
 // appear from the front. Equipment does not replace the anatomy.
 for(const side of [-1,1]){const far=side<0,y=side*13.3-4.2+(far?2.2:1.1)*yaw,w=8.4+(far?-1.6:1.7)*yaw,len=34+(far?-3:2)*yaw,x0=-17+(far?1.5:-1)*yaw;c.save();const metal=grad([0,y],[0,y+w],[[0,tank[0]],[.24,far?tank[2]:tank[1]],[.51,tank[2]],[1,tank[4]]]);box(x0,y,len,w,Math.min(3.8,w/2),metal,'#0b1922',.7);for(const x of [-10,7])box(x,y+.3,2.8,w-.6,.7,'#152530','#829298',.42);box(x0+len-2,y+w*.24,4.2,w*.54,1,'#75898c','#253b42',.55);if(detail&&!far)line([x0+4,y+w*.22],[x0+len-5,y+w*.22],'#b7d6de55',.6);c.restore();}
 // Legs: the pelvis is drawn over the thigh roots, with separate crotch
 // and knee landmarks. Full leg length is nearly half of standing stature.
 for(const side of [-1,1]){
  const pose=rig?.leg(side,phase,weight,powered,options.motion)||{hip:[-19,side*7],knee:[-43,side*9],ankle:[-67,side*10],finAngle:0}, {hip,knee,ankle}=pose;
  c.save();const far=side<0,scale=far?1-.12*(view?.yaw||0):1;
  limb(hip,knee,11.5*scale,far?s[0]:s[1],far?s[2]:s[3]);limb(knee,ankle,8.5*scale,s[0],far?s[1]:s[2]);
  const joint=grad([knee[0]-4,knee[1]-3],[knee[0]+4,knee[1]+3],[[0,s[1]],[.43,s[2]],[1,s[0]]]);
  path(()=>{c.moveTo(knee[0]+4,knee[1]-3);c.quadraticCurveTo(knee[0],knee[1]-4.3,knee[0]-4,knee[1]-2.6);c.lineTo(knee[0]-3,knee[1]+2.8);c.quadraticCurveTo(knee[0]+1,knee[1]+4,knee[0]+4,knee[1]+2.5);c.closePath();},joint,'#172733',.55);
  c.save();c.translate(...ankle);c.rotate(-pose.finAngle);
  box(-5,-3.1,9.5,6.2,2.1,grad([0,-3],[0,3],[[0,s[2]],[.45,s[1]],[1,s[0]]]),'#0b1821',.55);
  const blade=grad([-12,-6],[-12,6],[[0,'#0a141c'],[.23,f[1]],[.45,f[0]],[.8,f[0]],[1,'#071219']]);
  path(()=>{c.moveTo(-2,-3);c.bezierCurveTo(-9,-3.5,-17,-5.8,-22,-6);c.quadraticCurveTo(-25,0,-22,6);c.bezierCurveTo(-17,5.8,-9,3.5,-2,3);c.closePath();},blade,f[1],.7);
  for(const off of [-3,0,3])path(()=>{c.moveTo(-6,off*.45);c.quadraticCurveTo(-14,off*.6,-21,off);},null,f[2],.55);
  c.restore();c.restore();
 }
 // Far arm is painted before the torso, in projected space, not above the face.
 if(options.beforeTorso){c.save();if(view)c.transform(1,-view.shear/view.width,0,1/view.width,0,0);options.beforeTorso(limb);c.restore();}
 const shoulder=female?13.9:15.0,hipWidth=female?12.9:12.0,waist=female?8.7:9.5;
 const suit=grad([0,-shoulder],[2,shoulder],[[0,'#0b1821'],[.20,s[2]],[.42,s[1]],[.68,s[0]],[1,'#09131b']]);
 // One continuous skin-tight suit silhouette with distinct neck, trapezius,
 // rib cage, waist, iliac crest and crotch. Positive x points toward head.
 path(()=>{c.moveTo(22,-4.3);c.bezierCurveTo(18,-5.5,17,-11.8,13,-shoulder);c.bezierCurveTo(8,-shoulder-1,2,-11.8,-3,-waist-1);c.bezierCurveTo(-8,-waist,-10,-waist,-14,-hipWidth);c.quadraticCurveTo(-19,-hipWidth-1,-24,-8.2);c.quadraticCurveTo(-25,-5.8,-23,-2.8);c.lineTo(-20,0);c.lineTo(-23,2.8);c.quadraticCurveTo(-25,5.8,-24,8.2);c.quadraticCurveTo(-19,hipWidth+1,-14,hipWidth);c.bezierCurveTo(-10,waist,-8,waist,-3,waist+1);c.bezierCurveTo(2,11.8,8,shoulder+1,13,shoulder);c.bezierCurveTo(17,11.8,18,5.5,22,4.3);c.closePath();},suit,'#07131b',.85);
 // Deltoids bridge the torso into the upper arms rather than resembling bolted-on joints.
 for(const side of [-1,1]){const deltoid=grad([15,side*10],[8,side*17],[[0,s[2]],[.40,s[3]],[.73,s[1]],[1,s[0]]]);path(()=>{c.moveTo(17,side*10.6);c.bezierCurveTo(18,side*14.4,15,side*17.4,11,side*17.3);c.quadraticCurveTo(7,side*16.1,7.4,side*13.0);c.quadraticCurveTo(12,side*10.4,17,side*10.6);c.closePath();},deltoid,'#14242d',.46);}
 // Sculpted pectoral and abdominal volumes, not a solid rectangular breastplate.
 const chest=grad([8,-11],[8,11],[[0,s[1]],[.32,s[3]],[.52,s[2]],[1,s[0]]]);
 for(const side of [-1,1]){
  c.save();c.translate(0,-1.4*yaw);c.scale(1,side<0?1-.17*yaw:1+.10*yaw);
  path(()=>{c.moveTo(15,side*3);c.quadraticCurveTo(15,side*10,10,side*11.1);c.bezierCurveTo(6,side*11.8,2,side*8.6,1,side*2.4);c.quadraticCurveTo(8,side*1.1,15,side*3);c.closePath();},chest,null);
  if(detail){path(()=>{c.moveTo(14,side*9.7);c.quadraticCurveTo(8,side*13,3,side*9.5);},null,'#9dbac22e',.55);path(()=>{c.moveTo(-3,side*7.2);c.quadraticCurveTo(-8,side*5.8,-14,side*8.8);},null,'#08151e99',.65);}c.restore();
 }
 path(()=>{c.moveTo(15,-1.4*yaw);c.quadraticCurveTo(5,-.7-1.4*yaw,-13,0);},null,'#10232f',.65);
 for(const x of [-2,-6,-10])path(()=>{c.moveTo(x,-5);c.quadraticCurveTo(x-1,0,x,5);},null,'#a0b6b82b',.5);
 // Waist harness follows the iliac crest, not the abdomen.
 path(()=>{c.moveTo(-16,-10);c.lineTo(-19,-9.5);c.quadraticCurveTo(-20,0,-19,9.5);c.lineTo(-16,10);c.quadraticCurveTo(-17,0,-16,-10);c.closePath();},'#172a32','#5c747a',.55);
 box(-19,-2.4,4.4,4.8,1,'#839ca0','#142832',.55);
 for(const side of [-1,1]){
  path(()=>{c.moveTo(15,side*10.4);c.quadraticCurveTo(5,side*9.2,-5,side*6.8);c.lineTo(-16,side*8.6);},null,'#10212b',2.7);
  path(()=>{c.moveTo(15,side*10.4);c.quadraticCurveTo(5,side*9.2,-5,side*6.8);c.lineTo(-16,side*8.6);},null,'#819a9e',.52);
  box(4,side*9.2-1.4,3.8,2.8,.7,'#70898d','#152b36',.42);
 }
 // Modular suit shells respect the same human silhouette.
 const panel=grad([5,-12],[5,12],[[0,s[1]],[.30,s[3]],[.54,s[2]],[1,s[0]]]);
 if(industrial){for(const side of [-1,1]){path(()=>{c.moveTo(14,side*8);c.lineTo(13,side*14);c.lineTo(6,side*12.6);c.lineTo(4,side*7.5);c.closePath();},panel,'#18282f',.65);line([11,side*11.4],[7,side*10.6],'#edbe7e',.65);box(-15,side<0?-11:6,6,5,1,s[1],s[3],.5);}}
 else if(polar){path(()=>{c.moveTo(14,-9);c.quadraticCurveTo(19,-3,14,9);c.lineTo(1,8.5);c.lineTo(1,-8.5);c.closePath();},panel,'#66818a',.65);for(const x of [-3,-7,-11])line([x,-6],[x,6],'#b7d3d6',.52);}
 else if(scout){for(const side of [-1,1]){box(-11,side<0?-9.5:4,8,5.5,1.2,s[1],'#182c26',.6);line([-10,side*7],[-5,side*7],s[3],.65);}box(2,-2.5,8,5,1,s[1],s[3],.5);}
 else if(detail){box(3,-2,6.4,4,1,'#132b37','#6c8e96',.45);line([5,-.8],[7,-.8],'#b3e6df',.65);}
 // Neck and rounded anatomical head. Mask sits on a face, rather than a
 // rectangular head replacing the face. Hair roots retain original mounts.
 box(18,-4.1,7.1,8.2,2.3,grad([0,-4],[0,4],[[0,s[2]],[.5,s[1]],[1,s[0]]]),'#142631',.55);
 const skull=grad([31,-8],[31,8],[[0,'#1c303a'],[.25,'#607580'],[.55,'#2d414e'],[1,'#111f28']]);
 path(()=>{c.moveTo(23,-3.8);c.quadraticCurveTo(25,-7.3,31,-7.8);c.bezierCurveTo(38,-8.2,41,-4.6,40,0);c.bezierCurveTo(41,4.6,38,8.2,31,7.8);c.quadraticCurveTo(25,7.3,23,3.8);c.quadraticCurveTo(22.5,0,23,-3.8);c.closePath();},skull,'#0b151e',.8);
 if(hairStyle!=='shaved'){const cap=grad([34,-8],[42,7],[[0,hair[0]],[.43,hair[2]],[.72,hair[1]],[1,hair[0]]]);path(()=>{c.moveTo(33,-7);c.quadraticCurveTo(38,-10,41,-6);c.quadraticCurveTo(44,0,41,6);c.quadraticCurveTo(37,9,33,7);c.quadraticCurveTo(36,0,33,-7);c.closePath();},cap,hair[0],.4);}
 c.save();drawHairLayer(c,locks,'knot',hair,detail);drawHairLayer(c,locks,'crown',hair,detail);c.restore();
 const skin={original:['#8b6b59','#c6a38c','#ac8a75','#695655'],light:['#a78372','#f0c9ae','#e3b99c','#987462'],bronze:['#70432e','#c79466','#a56f49','#593a2b'],deep:['#422d29','#946951','#694337','#362724']}[look.skin]||['#8b6b59','#c6a38c','#ac8a75','#695655'];const eye={original:'#223c45',hazel:'#aa8152',blue:'#6bc1ed',green:'#7eae74',violet:'#a48de1'}[look.eyes]||'#223c45';
 c.save();c.translate(0,-1.25*yaw);c.scale(1,1-.12*yaw);
 const face=grad([30,-6],[30,6],[[0,skin[0]],[.35,skin[1]],[.66,skin[2]],[1,skin[3]]]);
 path(()=>{c.moveTo(36,-5);c.quadraticCurveTo(34,-6.5,30,-6);c.quadraticCurveTo(25,-5.8,24.5,0);c.quadraticCurveTo(25,5.8,30,6);c.quadraticCurveTo(34,6.5,36,5);c.closePath();},face,'#34414a',.4);
 for(const side of [-1,1]){const eyeSize=side<0?1-.22*yaw:1;path(()=>{c.moveTo(33.5,side*1.8);c.quadraticCurveTo(34,side*3.7,33,side*4.7);},null,'#51413c',.45);oval(32.2,side*3.1,.55*eyeSize,1.05*eyeSize,'#d4c7b3');oval(32.2,side*3.1,.42*eyeSize,.42*eyeSize,eye);}
 path(()=>{c.moveTo(32,0);c.lineTo(29.4,-.65);c.lineTo(29.2,.5);},null,'#70584c',.4);
 // Optional prescription inserts sit inside the pressure mask, not on top of the hair.
 if(look.eyewear&&look.eyewear!=='none'){const frame=look.eyewear==='tactical'?'#83e4e8':look.eyewear==='square'?'#b19a79':'#b6c9cc';for(const side of [-1,1]){if(look.eyewear==='round')oval(32.3,side*3,1.9,2.3,null,frame,.55);else box(30.4,side*3-2.2,3.8,4.4,.65,null,frame,.55);}line([32.3,-.8],[32.3,.8],frame,.6);}
 // Panoramic transparent mask, twin eyes remain readable under tinted glass.
 const mask=grad([35,-7],[28,7],[[0,glass[0]],[.30,glass[1]],[.67,glass[2]],[1,glass[3]]]);
 const maskShape=()=>{c.moveTo(35.2,-6.6);c.quadraticCurveTo(37,-3.4,35.7,0);c.quadraticCurveTo(37,3.4,35.2,6.6);c.lineTo(30.2,6.5);c.quadraticCurveTo(28.8,3.4,30.5,0);c.quadraticCurveTo(28.8,-3.4,30.2,-6.5);c.closePath();};
 path(maskShape,null,'#0b1e29',2.0);c.save();c.globalAlpha=.48;path(maskShape,mask,null);c.restore();path(maskShape,null,'#a2c3c8',.65);
 path(()=>{c.moveTo(34.8,-5.2);c.quadraticCurveTo(35.5,-3.7,34.6,-1.2);},null,'#e2f8f6ac',.7);
 // Regulator centered at the mouth and hose routed behind the shoulder.
 path(()=>{c.moveTo(18,-15);c.bezierCurveTo(25,-18,30,-12,26,-5);},null,'#09131b',3.0);path(()=>{c.moveTo(18,-15);c.bezierCurveTo(25,-18,30,-12,26,-5);},null,'#55707a',1.55);
 box(23.6,-3.5,5.4,7,2.0,'#1b303c','#7a939b',.6);oval(26.2,0,1.7,2.2,'#405762','#15252f',.5);for(const y of [-1,0,1])line([25.7,y],[26.8,y],'#a3c1c3',.35);
 c.restore();c.save();drawHairLayer(c,locks,'braid',hair,detail);c.restore();
 if(look.headgear==='comms'){box(27,-9.2,5.5,3.5,1.1,'#273d47','#8da9b0',.55);path(()=>{c.moveTo(30,-9);c.lineTo(38,-11.5);},null,'#78949b',.8);oval(38,-11.5,.65,.65,'#91ead9');}else if(look.headgear==='temple'){box(33,7.1,4,3.1,.7,'#2f4955','#87b6b8',.5);line([34,8.5],[36,8.5],'#a2fff1',.8);}else if(look.headgear==='clip'&&hairStyle!=='shaved'){line([38,-5],[35,-8],'#e1be7e',1.1);line([39,-5],[36,-8],'#b28f54',.7);}
 if(options.helmetLamp){box(35,-9.7,5.2,3.7,1.1,'#354b57','#8eafb7',.55);oval(39,-7.9,1.25,1.2,'#d9fff0');}
 c.restore();return limb;
}
root.AbyssalRealisticBody=Object.freeze({draw:body,hairGeometry,simulateHair,HAIR_STYLES,HAIR_ANCHOR});
})(typeof globalThis!=='undefined'?globalThis:this);
