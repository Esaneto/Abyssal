/* Static procedural abyss environment. Drawn only on resize,
 * never each frame; the camera pans the canvas with the Rift portals.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalMenuScenery=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function draw(canvas,width,height){
  if(!canvas?.getContext||!(width>0)||!(height>0))return;
  const dpr=Math.max(1,Math.min(2.25,Number(typeof devicePixelRatio==='number'?devicePixelRatio:1)||1,Math.sqrt(3000000/(width*height))));
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  canvas.style.width=width+'px';canvas.style.height=height+'px';
  const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,width,height);
  let state=93217;const random=()=>{state=(state*1664525+1013904223)>>>0;return state/4294967296};
  c.save();
  // Distant abyssal rift light, not a foreground illustration.
  const glow=c.createRadialGradient(width*.53,height*.92,0,width*.53,height*.92,width*.57);
  glow.addColorStop(0,'rgba(20,151,188,.18)');glow.addColorStop(.3,'rgba(11,77,110,.09)');glow.addColorStop(1,'rgba(2,14,29,0)');
  c.fillStyle=glow;c.fillRect(0,0,width,height);
  // Light shafts appear to descend from the ocean ceiling.
  for(let i=0;i<13;i++){
   const cx=width*(.03+random()*.94),spread=height*(.09+random()*.1);
   const ray=c.createLinearGradient(cx,0,cx+spread*.25,height*.9);
   ray.addColorStop(0,'rgba(82,185,218,.09)');ray.addColorStop(.8,'rgba(38,128,165,.012)');ray.addColorStop(1,'rgba(43,133,169,0)');
   c.beginPath();c.moveTo(cx,0);c.lineTo(cx+spread*.38,height*.92);c.lineTo(cx-spread,height*.92);c.closePath();c.fillStyle=ray;c.fill();
  }
  // Back layer: tall rocky outcrops descending into a drowned canyon.
  function ridge(start,end,top,color,seed){
   const step=34,ys=[];let x=start,index=0;
   while(x<=end){const local=Math.sin((index+seed)*2.2)*23+(random()-.5)*38;ys.push({x,y:top+local});x+=step;index++;}
   c.beginPath();c.moveTo(start,height);c.lineTo(ys[0].x,ys[0].y);
   for(const pt of ys)c.lineTo(pt.x,pt.y);
   c.lineTo(end,height);c.closePath();c.fillStyle=color;c.fill();
  }
  ridge(0,width,height*.79,'rgba(5,22,38,.55)',3);
  ridge(0,width*.48,height*.91,'rgba(2,13,26,.89)',12);
  ridge(width*.55,width,height*.9,'rgba(2,13,26,.90)',24);
  for(let i=0;i<26;i++){
   const x=width*(random()),base=height*(.78+random()*.18),peak=height*(.54+random()*.2),w=16+random()*34;
   c.beginPath();c.moveTo(x-w*.8,base);c.lineTo(x-w*.28,peak+random()*18);c.lineTo(x,peak);c.lineTo(x+w*.28,peak+random()*19);c.lineTo(x+w,base);c.closePath();
   c.fillStyle=i%3===0?'rgba(5,28,43,.55)':'rgba(2,15,29,.67)';c.fill();
   if(i%5===0){c.strokeStyle='rgba(51,163,190,.12)';c.lineWidth=1;c.beginPath();c.moveTo(x,peak);c.lineTo(x+w*.16,base);c.stroke();}
  }
  // Subtle cyan geothermal glow between canyon walls.
  const vent=c.createLinearGradient(0,height*.74,0,height);
  vent.addColorStop(0,'rgba(14,148,200,0)');vent.addColorStop(.85,'rgba(20,145,190,.22)');vent.addColorStop(1,'rgba(5,43,89,.06)');
  c.fillStyle=vent;c.beginPath();c.moveTo(width*.47,height*.98);c.lineTo(width*.52,height*.73);c.lineTo(width*.55,height);c.closePath();c.fill();
  // The abyssal opening is carved into the actual seabed, not a
  // floating card. Stratified edges reveal the depth under the sediment.
  const fissureX=width*.50,fissureY=height*.835,fr=Math.min(width*.14,height*.16);
  c.save();
  let floorGlow=c.createRadialGradient(fissureX,fissureY,0,fissureX,fissureY,fr*2.1);
  floorGlow.addColorStop(0,'rgba(126,19,35,.22)');
  floorGlow.addColorStop(.45,'rgba(42,7,17,.10)');
  floorGlow.addColorStop(1,'rgba(8,16,30,0)');
  c.fillStyle=floorGlow;c.fillRect(fissureX-fr*2.1,fissureY-fr*2.1,fr*4.2,fr*4.2);
  c.beginPath();
  for(let i=0;i<=48;i++){
   const a=i*Math.PI*2/48,radius=1+.085*Math.sin(a*7)+.06*Math.cos(a*13);
   const xx=fissureX+Math.cos(a)*fr*1.18*radius,yy=fissureY+Math.sin(a)*fr*.49*radius;
   if(!i)c.moveTo(xx,yy);else c.lineTo(xx,yy);
  }
  c.closePath();c.fillStyle='rgba(0,2,10,.97)';c.fill();
  c.strokeStyle='rgba(147,28,45,.23)';c.lineWidth=7;c.stroke();
  c.lineWidth=1.5;c.strokeStyle='rgba(178,52,60,.27)';c.stroke();
  for(let i=0;i<14;i++){
   const a=i*Math.PI*2/14;
   const sx=fissureX+Math.cos(a)*fr*1.14,sy=fissureY+Math.sin(a)*fr*.5;
   c.beginPath();c.moveTo(sx,sy);
   c.lineTo(sx+Math.cos(a)*fr*(.3+(i%4)*.1),sy+Math.sin(a)*fr*.16);
   c.strokeStyle='rgba(142,36,49,.20)';c.lineWidth=1.5;c.stroke();
  }
  c.restore();
  // Rock-face bioluminescence and marine snow.
  for(let i=0;i<150;i++){
   const x=random()*width,y=height*(.68+random()*.3),r=.3+random()*1.4;
   c.fillStyle=i%6===0?'rgba(48,215,245,.52)':'rgba(42,158,200,.22)';
   c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
  }
  for(let i=0;i<550;i++){
   const x=random()*width,y=random()*height,r=random()<.85?.45:.95;
   c.globalAlpha=.09+random()*.22;c.fillStyle=random()<.2?'#8be4f5':'#5aadcc';
   c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=1;
  // Tiny schooling silhouettes add scale without competing with the portal text.
  for(let group=0;group<11;group++){
   const gx=random()*width,gy=height*(.18+random()*.68),direction=random()<.5?-1:1;
   for(let n=0;n<10;n++){
    const x=gx+n*direction*12+(random()-.5)*20,y=gy+(random()-.5)*18;
    c.fillStyle='rgba(12,55,75,.58)';
    c.beginPath();c.moveTo(x,y);c.lineTo(x-direction*5,y-2);c.lineTo(x-direction*3,y);
    c.lineTo(x-direction*5,y+2);c.closePath();c.fill();
   }
  }
  // Rare distant jellyfish in corners only; game objects remain readable.
  for(let i=0;i<7;i++){
   const left=i%2===0,x=left?width*(.03+random()*.16):width*(.83+random()*.14),y=height*(.35+random()*.48),size=5+random()*11;
   c.strokeStyle='rgba(42,178,215,.25)';c.fillStyle='rgba(45,130,172,.14)';c.lineWidth=1;
   c.beginPath();c.arc(x,y,size,Math.PI,0);c.lineTo(x+size*.7,y+size*.18);c.lineTo(x-size*.7,y+size*.18);c.closePath();c.fill();c.stroke();
   for(let j=-1;j<=1;j++){c.beginPath();c.moveTo(x+j*size*.46,y+size*.18);c.bezierCurveTo(x+j*size*.54,y+size,x+j*size*.3,y+size*1.9,x+j*size*.50,y+size*2.6);c.stroke();}
  }
  c.restore();
 }

 // Preserves the existing underwater background, adding only the foreground floor.
 function drawSubmarineModel(c,x,y,scale=1,powered=true,time=0){
 c.save();c.translate(x,y);c.scale(scale,scale);
 const e=(x,y,rx,ry,fill,stroke,width=2)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}};
 const grad=(x1,y1,x2,y2,stops)=>{const g=c.createLinearGradient(x1,y1,x2,y2);stops.forEach(([p,v])=>g.addColorStop(p,v));return g;};
 e(-248,0,38,57,'#172a30','#a8863c',7);e(-248,0,27,44,'#061217','#49666b',3);
 for(let i=0;i<4;i++){c.save();c.translate(-248,0);c.rotate(i*Math.PI/2+.3+(Number(time)||0)*.0035);c.fillStyle='#64777a';c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(18,-12,10,-37);c.quadraticCurveTo(-9,-22,0,0);c.fill();c.restore();}
 e(-248,0,9,9,'#c9a14d','#1b292c');
 c.beginPath();c.moveTo(-225,-25);c.bezierCurveTo(-174,-50,-124,-73,-48,-76);c.lineTo(158,-76);c.bezierCurveTo(292,-76,307,69,174,80);c.lineTo(-35,72);c.bezierCurveTo(-123,66,-186,34,-225,25);c.closePath();
 c.fillStyle=grad(0,-82,0,82,[[0,'#ffe28b'],[.19,'#d9a83b'],[.45,'#a66c19'],[.62,'#d7a532'],[.84,'#594221'],[1,'#182329']]);c.fill();c.strokeStyle='#101c21';c.lineWidth=6;c.stroke();
 c.save();c.clip();c.fillStyle='#1c292b';c.fillRect(-220,20,510,15);c.strokeStyle='rgba(255,228,149,.45)';c.lineWidth=2;c.beginPath();c.moveTo(-180,-32);c.bezierCurveTo(-65,-64,120,-63,214,-49);c.stroke();
 for(const px of [-155,-89,24,97,177]){c.strokeStyle='#463923';c.lineWidth=3;c.beginPath();c.moveTo(px,-80);c.quadraticCurveTo(px+15,0,px,82);c.stroke();for(let j=0;j<5;j++)e(px+5,-43+j*22,2,2,'#e9ce88');}
 c.fillStyle='#172429';c.fillRect(-113,-30,149,48);for(let i=0;i<6;i++){c.fillStyle='#556469';c.fillRect(-104+i*22,-23,14,3);}c.restore();
 e(205,0,72,65,'#17282e','#10191c',8);e(208,-1,55,50,grad(170,-50,244,49,[[0,'#76dce3'],[.27,'#1e6577'],[.67,'#0a303d'],[1,'#05161f']]),'#7a9795',4);
 c.save();c.globalAlpha=.65;c.strokeStyle='#b5f5f2';c.lineWidth=4;c.beginPath();c.ellipse(208,-1,46,43,0,3.7,5.1);c.stroke();c.restore();
 for(const px of [55,93,130]){e(px,-13,14,19,'#102931','#a58c4b',3);e(px,-13,9,13,powered?'#63d9df':'#28535a');}
 c.fillStyle='#26383b';c.fillRect(-37,-91,104,19);c.fillStyle='#c19740';c.fillRect(-25,-99,80,9);c.strokeStyle='#76888a';c.lineWidth=4;c.beginPath();c.moveTo(16,-99);c.lineTo(16,-123);c.lineTo(37,-123);c.stroke();
 e(0,76,48,18,'#121e23','#d9b451',5);e(0,86,32,16,powered?'#13606b':'#173840','#92a9a2',3);e(0,87,21,10,'#081b24',powered?'#8dfaff':'#426b71',2);
 c.save();c.translate(42,61);c.rotate(-.65);e(0,0,36,14,'#a77a30','#1b292c',4);e(0,0,24,8,null,'#e4bd65',2);c.restore();
 if(powered){for(const px of [-116,105,227]){c.save();c.shadowColor='#8bfaff';c.shadowBlur=12+6*Math.sin((Number(time)||0)*.002+px);e(px,53,8,4,'#c5ffff');c.restore();}}
 // Animated ballast pistons, independent of the solid hull.
 const pulse=Math.sin((Number(time)||0)*.002);for(const px of [-162,159]){c.save();c.translate(px,62);c.fillStyle='#263a40';c.fillRect(-12,0,24,12);c.fillStyle='#98aca9';c.fillRect(-5,8,10,7+2*pulse);c.restore();}
 c.fillStyle='#202b2c';c.font='bold 13px sans-serif';c.textAlign='center';c.fillText('ABYSSAL',85,47);c.restore();
 }
 function menuSubmarineScale(width,height,mobile=false){
  const base=Math.min(1.2,Math.max(.59,width/800));
  return mobile?Math.min(base*.75,Math.max(.26,height*.29/210)):base;
 }
 function drawSubmarine(canvas,width,height,scale=menuSubmarineScale(width,height)){
  if(!canvas?.getContext||width<100||height<100)return;
  const ratio=Math.min(2.25,Math.max(1,typeof devicePixelRatio==='number'?devicePixelRatio:1),Math.sqrt(3000000/(width*height)));
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  canvas.style.width=width+'px';canvas.style.height=height+'px';
  const c=canvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);
  c.clearRect(0,0,width,height);
  const cx=width/2;
  c.save();c.translate(cx,0);c.scale(scale,scale);
  c.restore();
  drawSubmarineModel(c,cx,124*scale,scale,true);
  // Terrain and the abyssal descent share ONE geometry. The two sides
  // fall into the opening, rather than painting a button over a flat floor.
  const mouthX=width*.5,mouthY=height*.835;
  const mouthRx=Math.min(width*.18,136),mouthRy=Math.min(height*.068,48);
  const floorY=height*.78;
  const bedY=x=>{
   const distance=(x-mouthX)/(mouthRx*1.8);
   const decline=Math.exp(-Math.pow(distance,4))*height*.105;
   return floorY+Math.sin(x*.013)*4+Math.sin(x*.043)*2.4+decline;
  };
  const sand=c.createLinearGradient(0,floorY-26,0,height);
  sand.addColorStop(0,'rgba(2,8,17,.05)');
  sand.addColorStop(.27,'rgba(11,26,32,.83)');
  sand.addColorStop(.82,'rgba(3,12,20,.98)');
  sand.addColorStop(1,'#02070e');
  c.fillStyle=sand;c.beginPath();c.moveTo(0,height);c.lineTo(0,bedY(0));
  for(let x=8;x<=width;x+=8)c.lineTo(x,bedY(x));
  c.lineTo(width,height);c.closePath();c.fill();
  c.strokeStyle='rgba(90,126,132,.24)';c.lineWidth=1.35;
  c.beginPath();for(let x=0;x<=width;x+=8){
   const y=bedY(x);
   if(x===0)c.moveTo(x,y);else c.lineTo(x,y);
  }c.stroke();
  // The black throat has a broken, naturally fractured rock lip.
  c.save();
  const glow=c.createRadialGradient(mouthX,mouthY,0,mouthX,mouthY,mouthRx*1.8);
  glow.addColorStop(0,'rgba(66,11,23,.26)');glow.addColorStop(.55,'rgba(34,5,14,.13)');
  glow.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=glow;c.fillRect(mouthX-mouthRx*2,mouthY-mouthRx,mouthRx*4,mouthRx*2);
  const crack=()=>{c.beginPath();for(let i=0;i<=44;i++){
   const theta=i*Math.PI*2/44;
   const rough=1+.075*Math.sin(theta*7)+.042*Math.cos(theta*13);
   const x=mouthX+Math.cos(theta)*mouthRx*rough;
   const y=mouthY+Math.sin(theta)*mouthRy*rough;
   if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
  }c.closePath();};
  crack();c.fillStyle='#000309';c.fill();
  // Stone contours, not a neon-ring or dotted outline.
  c.lineWidth=7;c.strokeStyle='rgba(9,14,21,.87)';c.stroke();
  c.lineWidth=1.2;c.strokeStyle='rgba(98,82,81,.34)';c.stroke();
  for(const side of [-1,1]){
   const lip=mouthX+side*mouthRx*.97;
   c.strokeStyle='rgba(80,109,111,.29)';c.lineWidth=1.4;
   for(let i=0;i<4;i++){
    const origin=lip+side*(i*16+7),base=bedY(origin)-2;
    c.beginPath();c.moveTo(origin,base);c.bezierCurveTo(origin-side*9,base+9,origin-side*13,base+17,origin-side*8,base+27);c.stroke();
   }
   // Exposed strata point down into the opening on either bank.
   for(let band=0;band<3;band++){
    c.strokeStyle=band===0?'rgba(82,116,118,.19)':'rgba(71,78,79,.15)';
    c.beginPath();
    for(let i=0;i<=14;i++){
     const x=mouthX+side*(mouthRx*(.65+i*.095)),y=bedY(x)+band*10+4;
     if(!i)c.moveTo(x,y);else c.lineTo(x,y);
    }c.stroke();
   }
  }
  c.restore();

 }
 return Object.freeze({draw,drawSubmarine,drawSubmarineModel,menuSubmarineScale});
});