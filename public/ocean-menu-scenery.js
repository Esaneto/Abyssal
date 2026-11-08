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
  const dpr=Math.max(1,Math.min(1.45,Number(typeof devicePixelRatio==='number'?devicePixelRatio:1)||1));
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
   ray.addColorStop(0,'rgba(96,192,223,.07)');ray.addColorStop(.8,'rgba(43,133,169,.009)');ray.addColorStop(1,'rgba(43,133,169,0)');
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
  ridge(0,width,height*.79,'rgba(6,24,40,.5)',3);
  ridge(0,width*.48,height*.91,'rgba(2,14,27,.87)',12);
  ridge(width*.55,width,height*.9,'rgba(2,14,27,.88)',24);
  for(let i=0;i<26;i++){
   const x=width*(random()),base=height*(.78+random()*.18),peak=height*(.54+random()*.2),w=16+random()*34;
   c.beginPath();c.moveTo(x-w*.8,base);c.lineTo(x-w*.28,peak+random()*18);c.lineTo(x,peak);c.lineTo(x+w*.28,peak+random()*19);c.lineTo(x+w,base);c.closePath();
   c.fillStyle=i%3===0?'rgba(6,30,45,.5)':'rgba(2,17,31,.62)';c.fill();
   if(i%5===0){c.strokeStyle='rgba(51,163,190,.12)';c.lineWidth=1;c.beginPath();c.moveTo(x,peak);c.lineTo(x+w*.16,base);c.stroke();}
  }
  // Subtle cyan geothermal glow between canyon walls.
  const vent=c.createLinearGradient(0,height*.74,0,height);
  vent.addColorStop(0,'rgba(16,159,212,0)');vent.addColorStop(.85,'rgba(22,152,198,.19)');vent.addColorStop(1,'rgba(5,43,89,.06)');
  c.fillStyle=vent;c.beginPath();c.moveTo(width*.47,height*.98);c.lineTo(width*.52,height*.73);c.lineTo(width*.55,height);c.closePath();c.fill();
  // Rock-face bioluminescence and marine snow.
  for(let i=0;i<150;i++){
   const x=random()*width,y=height*(.68+random()*.3),r=.3+random()*1.4;
   c.fillStyle=i%6===0?'rgba(54,220,247,.46)':'rgba(47,164,206,.18)';
   c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
  }
  for(let i=0;i<550;i++){
   const x=random()*width,y=random()*height,r=random()<.85?.45:.95;
   c.globalAlpha=.09+random()*.22;c.fillStyle=random()<.2?'#99e9f7':'#65b4d0';
   c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=1;
  // Tiny schooling silhouettes add scale without competing with the portal text.
  for(let group=0;group<11;group++){
   const gx=random()*width,gy=height*(.18+random()*.68),direction=random()<.5?-1:1;
   for(let n=0;n<10;n++){
    const x=gx+n*direction*12+(random()-.5)*20,y=gy+(random()-.5)*18;
    c.fillStyle='rgba(14,62,80,.54)';
    c.beginPath();c.moveTo(x,y);c.lineTo(x-direction*5,y-2);c.lineTo(x-direction*3,y);
    c.lineTo(x-direction*5,y+2);c.closePath();c.fill();
   }
  }
  // Rare distant jellyfish in corners only; game objects remain readable.
  for(let i=0;i<7;i++){
   const left=i%2===0,x=left?width*(.03+random()*.16):width*(.83+random()*.14),y=height*(.35+random()*.48),size=5+random()*11;
   c.strokeStyle='rgba(48,183,218,.22)';c.fillStyle='rgba(50,135,177,.11)';c.lineWidth=1;
   c.beginPath();c.arc(x,y,size,Math.PI,0);c.lineTo(x+size*.7,y+size*.18);c.lineTo(x-size*.7,y+size*.18);c.closePath();c.fill();c.stroke();
   for(let j=-1;j<=1;j++){c.beginPath();c.moveTo(x+j*size*.46,y+size*.18);c.bezierCurveTo(x+j*size*.54,y+size,x+j*size*.3,y+size*1.9,x+j*size*.50,y+size*2.6);c.stroke();}
  }
  c.restore();
 }
 return Object.freeze({draw});
});