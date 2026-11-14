/* Abyssal anatomical pressure suit. Coordinates are shared with diver-art's
 * existing weapon rig; geometry, gameplay scale and equipment anchors stay intact. */
(function(root){'use strict';
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
  const w=thickness*.58*bulk,v=thickness*.40*bulk;
  const shade=grad([0,-w],[0,w],[[0,'#0a131b'],[.25,highlight],[.45,base],[.82,base],[1,'#09141d']]);
  path(()=>{c.moveTo(-1,-w*.65);c.quadraticCurveTo(len*.34,-w,len,-v);c.quadraticCurveTo(len+v,0,len,v);c.quadraticCurveTo(len*.36,w*.87,-1,w*.65);c.quadraticCurveTo(-w,0,-1,-w*.65);},shade,'#071019',.95);
  line([len*.18,-w*.54],[len*.78,-v*.6],'#c8e0df40',.55);
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
 // Rear hair is composited before the suit, cylinders and helmet.
 if(look.hairStyle!=='shaved'){
  const long=look.hairStyle==='long'||(look.hairStyle!=='short'&&female),len=long?43:13;
  const drift=Math.sin(phase*.54)*3.5*weight+Math.sin((Number(t)||0)*.0016)*.65;
  path(()=>{c.moveTo(30,-8);c.quadraticCurveTo(27,-14,23,-10);c.bezierCurveTo(17,-13,12-len*.5,-17+drift,24-len,-12+drift);c.quadraticCurveTo(17-len,-9,24-len,-6+drift);c.bezierCurveTo(19,-8,24,-5,27,-7);c.closePath();},hair[0],'#070e15',.5);
  for(let i=0;i<(long?7:4);i++){const y=-10+i*.68;path(()=>{c.moveTo(27,y);c.bezierCurveTo(20,-14+i,18-len*.3,-17+i+drift,24-len,-12+i*.9+drift);},null,i%3===0?hair[1]:hair[2],.7);}
 }
 // Far leg first. Tapered thigh/calf, flexible boot and rubber blades.
 for(const side of [-1,1]){
  const pose=rig?.leg(side,phase,weight,powered)||{hip:[-16,side*5.5],knee:[-34,side*7.5],ankle:[-53,side*8],finAngle:0};
  const {hip,knee,ankle}=pose;
  c.save();if(side<0)c.globalAlpha=.86;
  limb(hip,knee,9.4,s[1],s[3]);limb(knee,ankle,7.4,s[0],s[2]);
  oval(knee[0],knee[1],4.6,3.6,grad([knee[0]-4,knee[1]-4],[knee[0]+3,knee[1]+3],[[0,s[3]],[.45,s[2]],[1,'#0c1922']]),'#0a141c',.9);
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
 path(()=>{c.moveTo(-22,-6);c.quadraticCurveTo(-23,-10,-15,-10);c.bezierCurveTo(-2,-9,7,-14,15,-12);c.quadraticCurveTo(20,-11,22,-7);c.lineTo(22,7);c.quadraticCurveTo(17,13,10,12);c.bezierCurveTo(1,10,-7,8,-15,10);c.quadraticCurveTo(-23,9,-22,6);c.closePath();},suit,'#07131b',1.1);
 box(-20,-8.5,6,17,2.5,'#14252e','#526b77',.65);
 box(-20,-2,5,4,1,'#9da7a5','#273c46',.6);
 for(let x=-12;x<=-6;x+=3)path(()=>{c.moveTo(x,-7);c.quadraticCurveTo(x-1,0,x,7);},null,'#758a9144',.9);
 const chest=grad([0,-11],[11,10],[[0,s[3]],[.24,s[2]],[.62,s[1]],[1,s[0]]]);
 path(()=>{c.moveTo(-6,-6.8);c.quadraticCurveTo(5,-10,14,-8.7);c.lineTo(18,-3);c.lineTo(17,5);c.quadraticCurveTo(6,9,-6,6.8);c.lineTo(-8,0);c.closePath();},chest,'#526b77',.8);
 path(()=>{c.moveTo(-4,0);c.quadraticCurveTo(7,-2,15,0);},null,'#091b28',1);
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
 if(look.hairStyle!=='shaved'){path(()=>{c.moveTo(22,-8);c.quadraticCurveTo(26,-13,31,-9);c.lineTo(28,-7.5);c.quadraticCurveTo(25,-9,22,-6.5);c.closePath();},hair[0],'#0a141c',.45);}
 if(options.helmetLamp){box(33,-12,7,4.6,1.4,'#384d58','#a5b9b9',.8);oval(39,-9.7,1.8,1.6,'#d6ffed');}
 return limb;
}
root.AbyssalRealisticBody=Object.freeze({draw:body});
})(typeof globalThis!=='undefined'?globalThis:this);
