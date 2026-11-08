/* Abyssal menu scenery v4: canvas-only metal submarine, seabed and sinkhole.
   Static geometry is rebuilt only when the viewport changes. */
(function(root,factory){
 const art=factory();
 if(typeof module==='object'&&module.exports)module.exports=art;
 if(root)root.AbyssalMenuScene=art;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TAU=Math.PI*2;
 function canvasContext(canvas,w,h){
  if(!canvas||!w||!h)return null;
  const dpr=Math.min(1.5,Math.max(1,Number(typeof devicePixelRatio==='number'?devicePixelRatio:1)||1));
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  canvas.style.width=w+'px';canvas.style.height=h+'px';
  const c=canvas.getContext('2d');if(!c)return null;
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  return c;
 }
 function drawSubmarine(canvas,w,h){
  const bodyH=Math.min(165,Math.max(94,h*.37)),c=canvasContext(canvas,w,bodyH);
  if(!c)return;
  const scale=Math.min(1.15,Math.max(.52,w/650)),cx=w*.5;
  c.save();c.translate(cx,10);c.scale(scale,scale);
  // A large metallic yellow hull is intentionally partly outside the upper edge.
  const hull=c.createLinearGradient(0,-76,0,90);
  hull.addColorStop(0,'#f5db76');hull.addColorStop(.25,'#b99a35');
  hull.addColorStop(.53,'#e0b83f');hull.addColorStop(.78,'#6f541f');hull.addColorStop(1,'#2a260f');
  c.shadowColor='rgba(0,0,0,.65)';c.shadowBlur=22;
  c.fillStyle=hull;c.strokeStyle='#181915';c.lineWidth=6;
  c.beginPath();c.moveTo(-212,-16);
  c.bezierCurveTo(-235,-57,-122,-90,0,-88);
  c.bezierCurveTo(134,-92,238,-54,218,-6);
  c.bezierCurveTo(207,51,129,79,7,78);
  c.bezierCurveTo(-123,77,-219,54,-212,-16);c.closePath();c.fill();c.stroke();
  c.shadowBlur=0;
  // Upper pressure fins and riveted armor.
  c.fillStyle='#1b1e1b';c.fillRect(-220,-15,440,8);
  c.fillStyle='#1a1d1a';
  for(let i=-5;i<=5;i++){const x=i*35;c.beginPath();c.arc(x,-12,3.2,0,TAU);c.fill();}
  for(const x of [-145,-91,92,148]){
   c.fillStyle='#171f21';c.strokeStyle='#b6a34f';c.lineWidth=5;
   c.beginPath();c.arc(x,21,21,0,TAU);c.fill();c.stroke();
   c.fillStyle='#58b3b5';c.globalAlpha=.42;
   c.beginPath();c.arc(x,21,12,0,TAU);c.fill();c.globalAlpha=1;
   c.fillStyle='rgba(240,237,173,.45)';c.beginPath();c.ellipse(x-4,17,5,2,-.4,0,TAU);c.fill();
  }
  // Caution panels, black mechanical seams.
  c.strokeStyle='rgba(9,16,16,.65)';c.lineWidth=3;
  for(const x of [-185,-65,65,185]){c.beginPath();c.moveTo(x,-30);c.lineTo(x+5,57);c.stroke();}
  c.fillStyle='#1c201a';c.fillRect(-135,47,270,7);
  for(let i=0;i<7;i++){const x=-118+i*39;c.fillStyle=i%2===0?'#161917':'#f8cf52';
   c.beginPath();c.moveTo(x,49);c.lineTo(x+14,49);c.lineTo(x+6,54);c.lineTo(x-8,54);c.closePath();c.fill();}
  // Exposed hatch: a dark oval opening with hinged open steel lid above it.
  c.shadowColor='#000';c.shadowBlur=10;
  c.fillStyle='#050d14';c.strokeStyle='#e4bd46';c.lineWidth=9;
  c.beginPath();c.ellipse(0,68,39,16,0,0,TAU);c.fill();c.stroke();c.shadowBlur=0;
  c.strokeStyle='#040807';c.lineWidth=4;c.beginPath();c.moveTo(-34,65);c.lineTo(-34,26);c.lineTo(-21,17);c.stroke();
  c.save();c.translate(-15,26);c.rotate(-.28);
  const lid=c.createLinearGradient(0,-18,0,15);lid.addColorStop(0,'#eed05a');lid.addColorStop(1,'#74591c');
  c.fillStyle=lid;c.strokeStyle='#0a100e';c.lineWidth=5;c.beginPath();c.ellipse(0,0,43,15,0,0,TAU);c.fill();c.stroke();
  c.fillStyle='#1b251f';c.beginPath();c.ellipse(0,1,27,7,0,0,TAU);c.fill();c.restore();
  // Thin light from the opened hatch points toward the spawned diver.
  const glow=c.createLinearGradient(0,78,0,141);
  glow.addColorStop(0,'rgba(246,224,122,.32)');glow.addColorStop(1,'rgba(246,224,122,0)');
  c.fillStyle=glow;c.beginPath();c.moveTo(-27,77);c.lineTo(27,77);c.lineTo(58,141);c.lineTo(-58,141);c.closePath();c.fill();
  c.restore();
 }
 function drawSeabed(canvas,w,h){
  const c=canvasContext(canvas,w,h);if(!c)return;
  let state=51711;const rnd=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296;};
  const ground=h*.80,riftX=w*.82;
  c.save();
  // Low-contrast upper ridges taper around the concealed Fossas entrance.
  const grad=c.createLinearGradient(0,ground-58,0,h);
  grad.addColorStop(0,'rgba(5,20,29,0)');grad.addColorStop(.27,'rgba(8,26,35,.69)');
  grad.addColorStop(.76,'rgba(2,12,21,.95)');grad.addColorStop(1,'#020810');
  c.beginPath();c.moveTo(0,h);c.lineTo(0,ground+15);
  for(let x=0;x<=w;x+=16){
   const dip=Math.exp(-Math.pow((x-riftX)/Math.max(64,w*.14),2));
   const y=ground+Math.sin(x*.028)*9+Math.sin(x*.071)*4+dip*37;
   c.lineTo(x,y);
  }
  c.lineTo(w,h);c.closePath();c.fillStyle=grad;c.fill();
  c.strokeStyle='rgba(74,129,142,.22)';c.lineWidth=2;c.beginPath();
  for(let x=0;x<=w;x+=12){
   const dip=Math.exp(-Math.pow((x-riftX)/Math.max(64,w*.14),2));
   const y=ground+Math.sin(x*.028)*9+Math.sin(x*.071)*4+dip*37;
   if(x===0)c.moveTo(x,y);else c.lineTo(x,y);
  }c.stroke();
  // Rocks, silt, shell fragments and barely-visible benthic plants.
  for(let i=0;i<130;i++){
   const x=rnd()*w,y=ground+25+rnd()*(h-ground-28),r=.4+rnd()*5.5;
   c.fillStyle=i%8===0?'rgba(72,134,132,.28)':'rgba(29,62,75,.27)';
   c.beginPath();c.ellipse(x,y,r,r*.42,rnd()*TAU,0,TAU);c.fill();
  }
  for(let i=0;i<19;i++){
   const x=rnd()*w,y=ground+14+rnd()*25,l=9+rnd()*22;
   c.strokeStyle='rgba(25,105,109,.30)';c.lineWidth=1+rnd()*1.3;
   c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+(rnd()-.5)*14,y-l*.55,x+(rnd()-.5)*18,y-l);c.stroke();
  }
  // An actual open cavity, merged with the terrain. Blood-red thin fissures.
  const yr=ground+42,rx=Math.min(100,w*.145),ry=Math.min(61,h*.14);
  const abyss=c.createRadialGradient(riftX,yr,3,riftX,yr,rx*1.13);
  abyss.addColorStop(0,'#000006');abyss.addColorStop(.5,'#04010a');
  abyss.addColorStop(.80,'#19050d');abyss.addColorStop(1,'rgba(15,2,9,0)');
  c.fillStyle=abyss;c.beginPath();c.ellipse(riftX,yr,rx*1.19,ry*1.13,-.08,0,TAU);c.fill();
  c.fillStyle='#010107';c.strokeStyle='rgba(156,28,44,.60)';c.lineWidth=3;
  c.beginPath();
  for(let i=0;i<=18;i++){
   const a=i*TAU/18,noise=.86+.11*Math.sin(i*2.3)+.08*Math.cos(i*1.67);
   const x=riftX+Math.cos(a)*rx*noise,y=yr+Math.sin(a)*ry*noise;
   if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
  }c.closePath();c.fill();c.stroke();
  c.strokeStyle='rgba(156,33,52,.38)';c.lineWidth=2;
  for(let i=0;i<9;i++){
   const a=i*TAU/9,x=riftX+Math.cos(a)*rx*.90,y=yr+Math.sin(a)*ry*.82;
   c.beginPath();c.moveTo(x,y);
   c.lineTo(x+Math.cos(a)*((i%3+1)*11),y+Math.sin(a)*((i%3+1)*13));
   c.stroke();
  }
  c.restore();
 }
 return Object.freeze({drawSubmarine,drawSeabed});
});
