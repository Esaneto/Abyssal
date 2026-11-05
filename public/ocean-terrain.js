(function(){
 'use strict';
 const cache=new WeakMap();
 const noise=(x,y)=>Math.sin(x*.019+Math.sin(y*.027)*2)*Math.cos(y*.023)+.4*Math.sin(x*.071+y*.053);
 function build(layout){
  const scale=3,canvas=document.createElement('canvas');
  canvas.width=Math.ceil(layout.width/scale);canvas.height=Math.ceil(layout.height/scale);
  const c=canvas.getContext('2d'),image=c.createImageData(canvas.width,canvas.height);
  for(let py=0;py<canvas.height;py++)for(let px=0;px<canvas.width;px++){
   const x=px*scale,y=py*scale;let distance=-Infinity;
   for(const r of layout.rooms){const d=(1-Math.hypot((x-r.x)/r.rx,(y-r.y)/r.ry))*Math.min(r.rx,r.ry);distance=Math.max(distance,d);}
   for(const e of layout.corridors){const path=e.path||[{x:e.x1,y:e.y1},{x:e.x2,y:e.y2}];for(let p=1;p<path.length;p++){const a=path[p-1],b=path[p],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/Math.max(1,dx*dx+dy*dy)));distance=Math.max(distance,e.width-Math.hypot(x-a.x-t*dx,y-a.y-t*dy));}}
   const grain=(Math.sin(x*12.9898+y*78.233)*43758.5453)%1;
   const n=noise(x,y),edge=distance+n*7;
   let red,green,blue;
   if(edge>0){const shelf=Math.exp(-edge/35),silt=(n+1.5)*2+grain*2;red=3+silt+shelf*8;green=17+silt+shelf*16;blue=25+silt+shelf*15;}
   else {const ridge=Math.exp(edge/95),strata=Math.abs(Math.sin(x*.024+y*.038+n*3));red=5+ridge*(13+strata*8);green=10+ridge*(23+strata*12);blue=16+ridge*(27+strata*14);}
   const i=(py*canvas.width+px)*4;image.data[i]=red;image.data[i+1]=green;image.data[i+2]=blue;image.data[i+3]=255;
  }
  c.putImageData(image,0,0);return canvas;
 }
 window.AbyssalTerrain={draw(ctx,layout,cameraX,cameraY,width,height,t){
  let terrain=cache.get(layout);if(!terrain){terrain=build(layout);cache.set(layout,terrain);}
  ctx.drawImage(terrain,0,0,layout.width,layout.height);
  ctx.save();
  // Suspended marine snow drifts through the water column, independent of rooms.
  for(let i=0;i<90;i++){const x=cameraX+((i*137.7+t*.003)%width),y=cameraY+((i*83.3-t*.006)%height+height)%height;ctx.fillStyle='rgba(146,206,215,'+(.04+(i%5)*.025)+')';ctx.beginPath();ctx.arc(x,y,.7+i%3*.35,0,Math.PI*2);ctx.fill();}
  const fog=ctx.createRadialGradient(cameraX+width*.5,cameraY+height*.5,width*.12,cameraX+width*.5,cameraY+height*.5,width*.67);fog.addColorStop(0,'rgba(0,5,15,0)');fog.addColorStop(1,'rgba(0,5,15,.72)');ctx.fillStyle=fog;ctx.fillRect(cameraX,cameraY,width,height);ctx.restore();
 }};
})();
