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

function body(c,t,options,look={}){
 const rig=root.AbyssalDiverRig,phase=Number.isFinite(options.motion?.phase)?options.motion.phase:(Number(t)||0)*.008,swim=options.moving!==false,female=options.gender==='female';
 const weight=Number.isFinite(options.motion?.weight)?options.motion.weight:(swim?1:0),powered=Boolean(options.motion?.powered||options.propulsorActive);
 const kind=look.outfitId||'navy',industrial=kind==='rust',polar=kind==='ice',scout=kind==='olive';
 const s=look.outfit||['#101923','#263847','#39536a','#668293','#b4c8cc'];
 const f=look.fins||['#15242c','#60858e','#9db6b8'];
 const tank=look.back||['#14252e','#77929b','#455e69','#263e49','#101b24'];
 const hair=look.hair||['#121920','#46505b','#232b34'];
 const glass=look.visor||['#b5d8d9','#568a99','#264b60','#102631'];
 const path=(fn,fill,stroke,width=.7)=>{c.beginPath();fn();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}};
 const line=(a,b,color,width=.7)=>path(()=>{c.moveTo(...a);c.lineTo(...b);},null,color,width);
 const grad=(a,b,stops)=>{const g=c.createLinearGradient(...a,...b);for(const [p,v] of stops)g.addColorStop(p,v);return g;};
 const oval=(x,y,rx,ry,fill,stroke,width=.7)=>path(()=>c.ellipse(x,y,rx,ry,0,0,Math.PI*2),fill,stroke,width);
 const box=(x,y,w,h,r,fill,stroke,width=.7)=>path(()=>c.roundRect(x,y,w,h,r),fill,stroke,width);
 function limb(a,b,thickness,base,highlight){
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
  c.save();c.translate(...a);c.rotate(Math.atan2(dy,dx));
  const bulk=industrial?1.12:polar?1.18:scout?.92:1;
  const w=thickness*.70*bulk,v=thickness*.43*bulk;
  const shade=grad([0,-w],[0,w],[[0,'#101d28'],[.18,base],[.36,highlight],[.57,base],[.79,base],[1,'#071019']]);
  path(()=>{c.moveTo(-1.5,-w*.70);c.bezierCurveTo(len*.12,-w*1.17,len*.42,-w*1.05,len*.68,-v*1.12);c.quadraticCurveTo(len*.93,-v*.94,len,-v);c.quadraticCurveTo(len+v*.85,0,len,v);c.bezierCurveTo(len*.68,v*1.15,len*.38,w*.98,-1.5,w*.70);c.quadraticCurveTo(-w*.78,0,-1.5,-w*.70);},shade,'#071019',.95);
  path(()=>{c.moveTo(len*.10,-w*.42);c.quadraticCurveTo(len*.36,-w*.85,len*.76,-v*.57);},null,'#c8e0df40',.7);
  for(let j=0;j<(options.detail===false?0:2);j++)path(()=>{const q=len*(.53+j*.12);c.moveTo(q,-v*.75);c.quadraticCurveTo(q+2,0,q-1,v*.76);},null,'#07131b66',.65);
  // Variant-specific panels follow every articulated limb, including weapon arms.
  if(industrial||polar){
   const top=grad([0,-w],[0,w],[[0,s[4]],[.24,s[3]],[.52,s[2]],[1,s[0]]]);
   path(()=>{c.moveTo(len*.13,-w*.88);c.lineTo(len*.42,-w*.98);c.lineTo(len*.67,-w*.62);c.lineTo(len*.61,w*.56);c.lineTo(len*.28,w*.78);c.lineTo(len*.1,w*.35);c.closePath();},top,'#101c24',.65);
   if(industrial){line([len*.22,-w*.65],[len*.47,-w*.55],'#e6b074',.9);line([len*.22,w*.4],[len*.47,w*.3],'#131b22',.85);}
   else{for(const at of [.72,.84])line([len*at,-v*.74],[len*at,v*.72],'#b8d5db',.65);}
  }else if(scout){line([len*.2,-w*.55],[len*.84,-v*.7],s[3],.75);}
  c.restore();
 }
 // Hair is independent of gender, suit, equipment and collision.
 const hairStyle=look.hairStyle||'classic',hairFlow=Number.isFinite(options.motion?.hairFlow)?options.motion.hairFlow:(powered?1:0);
 const locks=hairGeometry(hairStyle,options.reducedMotion?0:t,options.reducedMotion?0:weight,options.reducedMotion?0:hairFlow);
 c.save();drawHairLayer(c,locks,'back',hair,options.detail!==false);c.restore();
 // Far leg first. Tapered thigh/calf, flexible boot and rubber blades.
 for(const side of [-1,1]){
  const pose=rig?.leg(side,phase,weight,powered)||{hip:[-16,side*5.5],knee:[-34,side*7.5],ankle:[-53,side*8],finAngle:0};
  const {hip,knee,ankle}=pose;
  c.save();if(side<0)c.globalAlpha=.86;
  limb(hip,knee,11.2,s[1],s[3]);limb(knee,ankle,8.7,s[0],s[2]);
  oval(knee[0],knee[1],5.0,4.2,grad([knee[0]-4,knee[1]-4],[knee[0]+3,knee[1]+3],[[0,s[3]],[.45,s[2]],[1,'#0c1922']]),'#0a141c',.9);
  path(()=>{c.moveTo(knee[0]-2,knee[1]-2.4);c.lineTo(knee[0]+2,knee[1]-2.8);c.lineTo(knee[0]+3,knee[1]+1);},null,'#9db6ba75',.7);
  c.save();c.translate(...ankle);c.rotate(-pose.finAngle);
  box(-4,-3.9,9,7.8,2.8,grad([-4,-4],[-4,4],[[0,'#5c717a'],[.35,'#263845'],[1,'#0b1620']]),'#09121a');
  const blade=grad([-12,-8],[-12,8],[[0,'#0a141c'],[.3,f[1]],[.48,f[0]],[.78,f[0]],[1,'#071219']]);
  path(()=>{c.moveTo(-1,-3);c.bezierCurveTo(-9,-4,-18,-7,-24,-7);c.quadraticCurveTo(-29,0,-24,7);c.bezierCurveTo(-18,7,-8,4,-1,3);c.closePath();},blade,f[1],.9);
  for(const off of [-4,0,4])path(()=>{c.moveTo(-6,off*.45);c.quadraticCurveTo(-15,off*.5,-23,off);},null,f[2],.75);
  c.restore();c.restore();
 }
 // Twin composite cylinders: shaded metal, retaining straps, valves and hoses.
 for(const ty of [-23,-14]){
  c.save();if(ty===-23)c.globalAlpha=.83;
  box(-21,ty,39,10,4.5,grad([-21,ty],[-21,ty+10],[[0,tank[0]],[.23,tank[1]],[.48,tank[2]],[.8,tank[3]],[1,tank[4]]]),'#0a1720',.9);
  for(const x of [-13,7])box(x,ty+.3,3.5,9.4,.8,'#101d26','#6f8288',.55);
  box(17,ty+2.3,5,5,1,'#a3aca5','#354b52');line([20,ty+1],[20,ty+8],'#667b7f',1.4);
  line([-17,ty+2],[-1,ty+2],'#d7eeee55',.75);box(-21,ty+1.4,4,7.2,1.8,'#152630','#647d85',.55);box(12,ty+2.5,3.5,5,1,'#14242b','#7a9194',.55);c.restore();
 }
 // Undersuit neck, waist and harness. Rounded anatomy rather than flat plates.
 const suit=grad([-12,-13],[-8,13],[[0,'#0c1721'],[.18,s[2]],[.38,s[1]],[.68,s[0]],[1,'#09131b']]);
 path(()=>{c.moveTo(-23,-8);c.quadraticCurveTo(-24,-13,-16,-12.5);c.bezierCurveTo(-5,-10,1,-15.5,10,-16);c.quadraticCurveTo(19,-16,22,-9);c.quadraticCurveTo(24,0,22,9);c.quadraticCurveTo(18,16,10,15.5);c.bezierCurveTo(0,14,-6,10.5,-16,12.5);c.quadraticCurveTo(-24,13,-23,8);c.closePath();},suit,'#07131b',1.1);
 box(-20,-8.5,6,17,2.5,'#14252e','#526b77',.65);
 box(-20,-2,5,4,1,'#9da7a5','#273c46',.6);
 for(let x=-12;x<=-6;x+=3)path(()=>{c.moveTo(x,-7);c.quadraticCurveTo(x-1,0,x,7);},null,'#758a9144',.9);
 const chest=grad([0,-14],[12,13],[[0,s[2]],[.23,s[3]],[.45,s[2]],[.74,s[1]],[1,s[0]]]);
 path(()=>{c.moveTo(-7,-8);c.bezierCurveTo(0,-10,7,-13,14,-11.5);c.quadraticCurveTo(19,-8,19,-2);c.quadraticCurveTo(19,8,13,10.5);c.quadraticCurveTo(3,12,-7,8);c.quadraticCurveTo(-9,0,-7,-8);c.closePath();},chest,'#526b77',.8);
 path(()=>{c.moveTo(-5,0);c.quadraticCurveTo(7,-1.4,16,0);},null,'#091b28',.85);
 // Contoured shoulder and hip transition: continuous neoprene under the plates.
 for(const side of [-1,1]){
  path(()=>{c.moveTo(4,side*9);c.quadraticCurveTo(10,side*15,16,side*12);c.quadraticCurveTo(19,side*9,16,side*7);},null,'#9dbac247',.9);
  path(()=>{c.moveTo(-19,side*9);c.quadraticCurveTo(-13,side*12,-9,side*8);},null,'#0a1723',1.2);
 }
 for(const x of [-12,-9])path(()=>{c.moveTo(x,-7);c.quadraticCurveTo(x-1,0,x,7);},null,'#91a9ad35',.7);
 for(const side of [-1,1]){
  path(()=>{c.moveTo(-12,side*7);c.quadraticCurveTo(1,side*11,15,side*8);},null,'#0b151c',3.2);
  path(()=>{c.moveTo(-12,side*7);c.quadraticCurveTo(1,side*11,15,side*8);},null,'#85979d',.85);
  box(1,side*8-1.5,4.5,3,1,'#79888a','#152630',.6);
 }
 // Flexible reinforced suit seams and a small pressure-release valve.
 if(options.detail!==false){
  path(()=>{c.moveTo(-17,-5);c.bezierCurveTo(-10,-4,-2,-4,2,-5);},null,'#b4ced344',.65);
  path(()=>{c.moveTo(-17,5);c.bezierCurveTo(-10,4,-2,4,2,5);},null,'#07131ba0',.85);
  oval(-14,7,2.2,2.2,'#243b47','#78919a',.65);oval(-14,7,.8,.8,'#9eb8b8');
  for(let i=0;i<3;i++)line([9+i*2,-5.5],[10+i*2,-3.5],'#b1c7c544',.65);
 }
 // Interchangeable silhouette modules. All remain inside the existing body envelope.
 const panelShade=grad([-11,-10],[15,10],[[0,s[4]],[.22,s[3]],[.55,s[2]],[1,s[0]]]);
 if(industrial){
  // Armoured shoulder yokes, central metal breastplate and utility belt.
  for(const side of [-1,1]){
   path(()=>{c.moveTo(6,side*7);c.lineTo(9,side*13.5);c.lineTo(17,side*14.5);c.lineTo(21,side*9);c.lineTo(18,side*5);c.closePath();},panelShade,'#10191f',1);
   line([11,side*11],[17,side*11],'#f4b568',1.1);
   box(-15,side<0?-13:7,8,6,1.3,'#47372e','#b1805c',.7);
  }
  path(()=>{c.moveTo(-5,-8);c.lineTo(13,-9);c.lineTo(18,-3);c.lineTo(16,6);c.lineTo(5,9);c.lineTo(-7,6);c.closePath();},panelShade,'#19252d',1);
  for(const y of [-3,1,5])line([-2,y],[12,y-1],'#32251e',.85);
  box(-20,-9,7,18,1.5,'#26323a','#b78b67',.8);
 }else if(polar){
  // Insulated pressure shell, raised collar and quilted abdominal segments.
  path(()=>{c.moveTo(4,-12);c.quadraticCurveTo(13,-15,20,-10);c.lineTo(22,7);c.quadraticCurveTo(14,15,4,12);c.lineTo(0,7);c.lineTo(0,-7);c.closePath();},panelShade,'#56727c',.85);
  box(16,-12,7,24,3,'#6d8791','#c5e1e0',.85);
  for(const x of [-14,-9,-4])box(x,-7,4,14,1.5,s[2],'#304b57',.65);
  line([7,-8],[15,-8],'#e2f5f5',1.1);line([7,8],[15,8],'#c6e3e6',1);
 }else if(scout){
  // Soft expedition vest, distinct side-mounted cargo pockets.
  for(const side of [-1,1]){
   box(-12,side<0?-12:6,12,6,1.7,s[1],'#1c2c25',.8);
   box(-10,side<0?-11:7,8,2,1,s[3],'#273a2c',.5);
   path(()=>{c.moveTo(2,side*8);c.lineTo(12,side*9);c.lineTo(15,side*5);c.lineTo(5,side*3);c.closePath();},s[2],'#233b2a',.75);
  }
  box(-2,-3,12,6,1.4,'#263b30','#8ba47c',.7);
  line([0,0],[8,0],'#b7cda2',.8);
 }
 // Breathing hose from shoulder valve to helmet; restrained illumination.
 path(()=>{c.moveTo(20,-18);c.bezierCurveTo(30,-22,35,-14,32,-7);},null,'#070f15',4.3);
 path(()=>{c.moveTo(20,-18);c.bezierCurveTo(30,-22,35,-14,32,-7);},null,'#455b63',2.4);
 for(const x of [23,27,31])line([x,-17],[x+1,-14],'#9daeb0',.7);
 oval(8,7.5,1.2,1.2,'#7cc9d1');
 // Readable identity panel and seam detail, only at meaningful render size.
 if(options.detail!==false){box(-10,-3.1,5.8,6.2,1,'#122732','#56717b',.5);line([-9,-1.5],[-6,-1.5],'#a3c5c7',.65);line([-9,0],[-6.7,0],'#a3c5c7',.55);}
 path(()=>{c.moveTo(16,-10);c.quadraticCurveTo(19,-7,19,-4);},null,'#a6c9cc77',.8);
 // Helmet: compact human cranium, face under curved panoramic mask, regulator.
 box(18,-5,7,10,2.5,'#263d49','#0a1720');
 const skull=grad([21,-10],[35,10],[[0,'#526570'],[.28,'#243541'],[.65,'#14232e'],[1,'#0b151e']]);
 path(()=>{c.moveTo(21,-7.5);c.quadraticCurveTo(23,-11,30,-10);c.quadraticCurveTo(39,-9,39,0);c.quadraticCurveTo(38,9,30,10);c.quadraticCurveTo(22,10,21,6);c.closePath();},skull,'#09131b',1.1);
 // Distinct helmets preserve the common human head and visor mounts.
 if(industrial){
  path(()=>{c.moveTo(21,-8);c.lineTo(23,-12);c.lineTo(33,-12);c.lineTo(38,-7);c.lineTo(37,-5);c.lineTo(30,-8);c.lineTo(23,-5);c.closePath();},panelShade,'#17232a',.8);
  box(20,-5,4,10,1.2,s[2],'#1c272e',.75);
 }else if(polar){
  path(()=>{c.moveTo(21,-8);c.quadraticCurveTo(23,-13,33,-12);c.quadraticCurveTo(40,-10,40,-2);c.lineTo(37,-3);c.quadraticCurveTo(35,-9,28,-8);c.lineTo(22,-5);c.closePath();},panelShade,'#3b5866',.85);
 }else if(scout){line([23,-7],[31,-9],'#a4b68a',1.3);}
 // Crown locks attach to the skull before the mask, keeping eyewear and lamp in front.
 c.save();if(hairStyle!=='shaved'){const cap=grad([33,-10],[43,10],[[0,hair[0]],[.44,hair[2]],[.7,hair[1]],[1,hair[0]]]);path(()=>{c.moveTo(32,-8);c.quadraticCurveTo(35,-13,40,-9);c.quadraticCurveTo(46,-2,41,8);c.quadraticCurveTo(37,11,32,8);c.quadraticCurveTo(36,0,32,-8);c.closePath();},cap,hair[0],.45);}
 c.restore();c.save();drawHairLayer(c,locks,'knot',hair,options.detail!==false);drawHairLayer(c,locks,'crown',hair,options.detail!==false);c.restore();
 if(hairStyle==='greenUndercut'){for(let i=0;i<3;i++)line([24+i*2,6],[25+i*2,8],hair[2],.55);}
 // Human face is seen through a tinted pressure mask, not a solid blue plate.
 const face=grad([25,-7],[36,7],[[0,'#c5a18a'],[.42,'#967768'],[1,'#4a4143']]);
 path(()=>{c.moveTo(26,-7);c.quadraticCurveTo(33,-8,34,-4);c.lineTo(36,-1);c.lineTo(34.4,.7);c.quadraticCurveTo(35,4,31,6.6);c.lineTo(27,5);c.lineTo(25,-2);c.closePath();},face,'#26303a',.5);
 path(()=>{c.moveTo(29,-3.2);c.quadraticCurveTo(31.5,-4.4,33,-3.1);},null,'#302b2c',.75);
 oval(31.9,-2.4,.75,.55,'#263940');
 const mask=grad([24,-8],[35,8],[[0,glass[0]],[.27,glass[1]],[.62,glass[2]],[1,glass[3]]]);
 c.save();c.globalAlpha=.60;
 path(()=>{c.moveTo(27,-7.5);c.quadraticCurveTo(34,-9,35.5,-5);c.lineTo(36,4);c.quadraticCurveTo(35,8,28,8);c.lineTo(25,4);c.lineTo(25,-4);c.closePath();},mask,null);c.restore();
 path(()=>{c.moveTo(27,-7.5);c.quadraticCurveTo(34,-9,35.5,-5);c.lineTo(36,4);c.quadraticCurveTo(35,8,28,8);c.lineTo(25,4);c.lineTo(25,-4);c.closePath();},null,'#a2b5b9',.85);
 path(()=>{c.moveTo(32,-6.4);c.quadraticCurveTo(34,-1,33,4.6);},null,'#e5faffaa',1.05);
 line([26.5,-5.4],[26.5,5.1],'#132d3d',.7);
 // Front-mounted regulator and hose coupling follow the actual face.
 path(()=>{c.moveTo(22,5);c.quadraticCurveTo(25,13,34.5,5.7);},null,'#080f17',3.1);
 path(()=>{c.moveTo(22,5);c.quadraticCurveTo(25,13,34.5,5.7);},null,'#5e727b',1.6);
 box(32.5,2.2,6.3,5.8,2,'#1b2b35','#71888e',.75);oval(37,5,1.3,1.6,'#60777c');
 for(const off of [-1,0,1])line([34,5+off],[36,5+off],'#b6c5c4',.45);
 // Braids drape over the shoulder, never across the pressure mask.
 c.save();drawHairLayer(c,locks,'braid',hair,options.detail!==false);c.restore();
 if(options.helmetLamp){box(33,-12,7,4.6,1.4,'#384d58','#a5b9b9',.8);oval(39,-9.7,1.8,1.6,'#d6ffed');}
 limb.joint=(p,r)=>{oval(p[0],p[1],r,r*.85,grad([p[0]-r,p[1]-r],[p[0]+r,p[1]+r],[[0,s[2]],[.48,s[1]],[1,s[0]]]),'#182733',.42);};
 // Glove geometry follows the wrist-to-hand vector and preserves the grip center.
 limb.glove=(hand,wrist,gripping=false)=>{
  const angle=Math.atan2(hand[1]-wrist[1],hand[0]-wrist[0]);c.save();c.translate(...hand);c.rotate(angle);
  const g=grad([-3,-3],[2,3],[[0,'#5d737c'],[.26,'#344a55'],[.55,'#1c303d'],[1,'#07131b']]);
  path(()=>{c.moveTo(-4,-2.4);c.quadraticCurveTo(-1,-3.6,2,-2.8);c.quadraticCurveTo(4,-2.4,4.2,0);c.quadraticCurveTo(4.2,2.9,1.4,3);c.lineTo(-3,2.4);c.quadraticCurveTo(-4.8,0,-4,-2.4);c.closePath();},g,'#07111a',.75);
  if(gripping){path(()=>{c.moveTo(-1,-2.4);c.quadraticCurveTo(1,-4,2.7,-2);c.lineTo(1.4,-.2);c.quadraticCurveTo(.2,-.2,-1,-2.4);c.closePath();},'#536a74','#0a1720',.5);}
  path(()=>{c.moveTo(-1,1.8);c.quadraticCurveTo(0,4,2.5,2.4);},null,'#6c8187',.6);
  for(const x of [0,1.5,3])line([x,-1.9],[x,gripping?.6:1.5],'#9bb3b74c',.55);
  box(-4.3,-2.6,1.7,5.2,.7,'#21333e','#69818a',.5);c.restore();
 };
 return limb;
}
root.AbyssalRealisticBody=Object.freeze({draw:body,hairGeometry,HAIR_STYLES,HAIR_ANCHOR});
})(typeof globalThis!=='undefined'?globalThis:this);
