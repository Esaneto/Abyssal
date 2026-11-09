/* Lightweight reef, kelp, canyon and wreck silhouettes. Visuals only; ecology
 * and gathering use the same fixed habitat zones but their own hit validation.
 */
(function(root,factory){
 const eco=typeof module==='object'&&module.exports?require('./abyssal-open-sea-ecology.js'):root.AbyssalOpenSeaEcology;
 const api=factory(eco);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalOpenSeaRender=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(ecology){
 'use strict';
 const TAU=Math.PI*2;
 function seeded(i,j){const x=Math.sin(i*127.1+j*311.7)*43758.5453;return x-Math.floor(x);}
 function coral(ctx,x,y,scale,color){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';ctx.strokeStyle=color;ctx.lineWidth=5;
  for(let branch=0;branch<5;branch++){
   const a=-Math.PI*.9+branch*.33;
   ctx.beginPath();ctx.moveTo(0,22);ctx.quadraticCurveTo(Math.sin(a)*24,0,Math.sin(a)*44,-35-Math.cos(a)*14);ctx.stroke();
   ctx.beginPath();ctx.moveTo(Math.sin(a)*22,1);ctx.lineTo(Math.sin(a)*27+9,-18);ctx.stroke();
  }
  ctx.restore();
 }
 function kelp(ctx,x,y,size,t){
  ctx.save();ctx.translate(x,y);ctx.lineCap='round';ctx.strokeStyle='rgba(45,147,106,.56)';ctx.lineWidth=7;
  for(let arm=0;arm<4;arm++){
   const sway=Math.sin(t*.00055+arm*1.3+x*.0009)*14;
   ctx.beginPath();ctx.moveTo(arm*9-17,15);
   ctx.bezierCurveTo(arm*8-20+sway,-size*.34,arm*8-17-sway,-size*.75,arm*7-14+sway,-size);
   ctx.stroke();
  }
  ctx.restore();
 }
 function wreck(ctx,x,y){
  ctx.save();ctx.translate(x,y);ctx.rotate(-.12);
  ctx.fillStyle='rgba(9,30,43,.88)';ctx.strokeStyle='rgba(68,139,151,.4)';ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(-160,-12);ctx.lineTo(125,-12);ctx.lineTo(75,42);ctx.lineTo(-92,42);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillRect(-58,-44,103,35);ctx.strokeRect(-58,-44,103,35);
  for(let i=0;i<4;i++){ctx.fillStyle='rgba(83,197,205,.25)';ctx.beginPath();ctx.arc(-33+i*24,-27,7,0,TAU);ctx.fill();}
  ctx.strokeStyle='rgba(92,158,159,.35)';ctx.beginPath();ctx.moveTo(4,-44);ctx.lineTo(4,-125);ctx.lineTo(58,-105);ctx.stroke();
  ctx.restore();
 }
 function draw(ctx,viewport={},time=0,lowPower=false){
  if(!ctx||!ecology?.ZONES)return;
  const left=viewport.left||0,top=viewport.top||0,right=left+(viewport.width||1200),bottom=top+(viewport.height||700);
  // Sector repeat: test only local provinces intersecting this camera,
  // never traverse every chunk of the 15x ocean.
  const minTX=Math.max(0,Math.floor((left-1200)/4800)),maxTX=Math.min(4,Math.floor((right+1200)/4800));
  const minTY=Math.max(0,Math.floor((top-900)/3000)),maxTY=Math.min(2,Math.floor((bottom+900)/3000));
  for(let ty=minTY;ty<=maxTY;ty++)for(let tx=minTX;tx<=maxTX;tx++)for(const base of ecology.ZONES){
   const zone={...base,x:base.x+tx*4800,y:base.y+ty*3000};
   if(zone.x+zone.rx+150<left||zone.x-zone.rx-150>right||zone.y+zone.ry+150<top||zone.y-zone.ry-150>bottom)continue;
   ctx.save();ctx.fillStyle='rgba(22,119,137,.025)';ctx.strokeStyle='rgba(76,166,175,.08)';ctx.lineWidth=4;
   ctx.beginPath();ctx.ellipse(zone.x,zone.y,zone.rx*.82,zone.ry*.75,0,0,TAU);ctx.fill();ctx.stroke();ctx.restore();
   const amount=lowPower?11:23;
   for(let i=0;i<amount;i++){
    const angle=seeded(i,zone.x)*TAU,r=Math.sqrt(seeded(i+104,zone.y))*.80;
    const x=zone.x+Math.cos(angle)*zone.rx*r,y=zone.y+Math.sin(angle)*zone.ry*r;
    if(x<left-130||x>right+130||y<top-130||y>bottom+130)continue;
    const size=.5+seeded(i+200,zone.x)*.6;
    if(zone.id==='reef')coral(ctx,x,y,size,'rgba(105,188,168,.42)');
    else if(zone.id==='kelp')kelp(ctx,x,y,55+80*size,time);
    else if(zone.id==='rocks'||zone.id==='canyon'||zone.id==='deep'){
     ctx.save();ctx.translate(x,y);ctx.rotate(seeded(i+44,zone.y));ctx.fillStyle='rgba(18,49,65,.56)';ctx.strokeStyle='rgba(61,110,121,.27)';
     ctx.beginPath();ctx.moveTo(-37*size,12*size);ctx.lineTo(-22*size,-24*size);ctx.lineTo(25*size,-17*size);ctx.lineTo(44*size,12*size);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    }else if(zone.id==='wreck'&&i%3===0)coral(ctx,x,y,size,'rgba(86,138,117,.37)');
   }
   if(zone.id==='wreck'&&zone.x>left-250&&zone.x<right+250&&zone.y>top-190&&zone.y<bottom+190)wreck(ctx,zone.x,zone.y);
   if(zone.x>left+120&&zone.x<right-120&&zone.y>top+80&&zone.y<bottom-80){
    ctx.save();ctx.globalAlpha=.4;ctx.textAlign='center';ctx.fillStyle='#94d6df';
    ctx.font='700 15px Inter,sans-serif';ctx.fillText(zone.label,zone.x,zone.y-zone.ry*.48);
    ctx.restore();
   }
  }
 }
 return Object.freeze({draw});
});
