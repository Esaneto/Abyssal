(function(){
 'use strict';

 // The former synchronous build created a 1600x3000 image and tested every
 // pixel against every room and corridor, blocking entry to Fossas for seconds.
 // Tile only the visible area, after the first frame. Keep the exact world
 // coordinates and geological palette so collision/gameplay cannot change.
 const TILE_WORLD=384;
 const PIXEL_SCALE=4;
 const MAX_CACHED_TILES=96;
 const states=new WeakMap();
 const noise=(x,y)=>Math.sin(x*.019+Math.sin(y*.027)*2)*Math.cos(y*.023)+.4*Math.sin(x*.071+y*.053);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

 function getState(layout){
  let state=states.get(layout);
  if(!state){state={tiles:new Map(),queued:new Set(),queue:[],running:false,buildCount:0};states.set(layout,state);}
  return state;
 }
 function visibleFeatures(layout,worldX,worldY,tileW,tileH){
  // The signed rock-distance contribution is negligible beyond this margin.
  // Exclude faraway geometry before entering the pixel loop.
  const padding=285,x2=worldX+tileW,y2=worldY+tileH;
  const rooms=(layout.rooms||[]).filter(r=>
   r.x+r.rx+padding>=worldX&&r.x-r.rx-padding<=x2&&
   r.y+r.ry+padding>=worldY&&r.y-r.ry-padding<=y2);
  const segments=[];
  for(const e of layout.corridors||[]){
   const path=e.path||[{x:e.x1,y:e.y1},{x:e.x2,y:e.y2}];
   for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],pad=(Number(e.width)||0)+padding;
    if(Math.max(a.x,b.x)+pad<worldX||Math.min(a.x,b.x)-pad>x2||
       Math.max(a.y,b.y)+pad<worldY||Math.min(a.y,b.y)-pad>y2)continue;
    const dx=b.x-a.x,dy=b.y-a.y;
    segments.push({x:a.x,y:a.y,dx,dy,inv:1/Math.max(1,dx*dx+dy*dy),width:e.width});
   }
  }
  return {rooms,segments};
 }
 function buildTile(layout,tx,ty){
  const worldX=tx*TILE_WORLD,worldY=ty*TILE_WORLD;
  const worldW=Math.min(TILE_WORLD,layout.width-worldX);
  const worldH=Math.min(TILE_WORLD,layout.height-worldY);
  if(worldW<=0||worldH<=0)return null;
  const canvas=document.createElement('canvas');
  canvas.width=Math.ceil(worldW/PIXEL_SCALE);
  canvas.height=Math.ceil(worldH/PIXEL_SCALE);
  const c=canvas.getContext('2d',{willReadFrequently:false});
  if(!c)return null;
  const image=c.createImageData(canvas.width,canvas.height);
  const {rooms,segments}=visibleFeatures(layout,worldX,worldY,worldW,worldH);
  const data=image.data;
  for(let py=0;py<canvas.height;py++){
   const y=worldY+py*PIXEL_SCALE;
   for(let px=0;px<canvas.width;px++){
    const x=worldX+px*PIXEL_SCALE;
    let distance=-Infinity;
    for(const r of rooms){
     const d=(1-Math.hypot((x-r.x)/r.rx,(y-r.y)/r.ry))*Math.min(r.rx,r.ry);
     if(d>distance)distance=d;
    }
    for(const e of segments){
     const dx=x-e.x,dy=y-e.y,t=clamp((dx*e.dx+dy*e.dy)*e.inv,0,1);
     const d=e.width-Math.hypot(dx-t*e.dx,dy-t*e.dy);
     if(d>distance)distance=d;
    }
    const grain=(Math.sin(x*12.9898+y*78.233)*43758.5453)%1;
    const n=noise(x,y),edge=distance+n*7;
    let red,green,blue;
    if(edge>0){
     const shelf=Math.exp(-edge/35),silt=(n+1.5)*2+grain*2;
     red=3+silt+shelf*8;green=17+silt+shelf*16;blue=25+silt+shelf*15;
    }else{
     const ridge=Math.exp(edge/95),strata=Math.abs(Math.sin(x*.024+y*.038+n*3));
     red=5+ridge*(13+strata*8);
     green=10+ridge*(23+strata*12);
     blue=16+ridge*(27+strata*14);
    }
    const i=(py*canvas.width+px)*4;
    data[i]=red;data[i+1]=green;data[i+2]=blue;data[i+3]=255;
   }
  }
  c.putImageData(image,0,0);
  return {canvas,x:worldX,y:worldY,width:worldW,height:worldH};
 }

 function schedule(state,layout){
  if(state.running||!state.queue.length)return;
  state.running=true;
  const work=()=>{
   const next=state.queue.shift();
   if(next){
    state.queued.delete(next.key);
    // Work is deliberately limited to a single 96x96 tile per task.
    // The first game frame is already painted before this task runs.
    const tile=buildTile(layout,next.tx,next.ty);
    if(tile){
     state.tiles.set(next.key,tile);
     state.buildCount++;
     if(state.tiles.size>MAX_CACHED_TILES){
      state.tiles.delete(state.tiles.keys().next().value);
     }
    }
   }
   state.running=false;
   if(state.queue.length)schedule(state,layout);
  };
  if(typeof requestIdleCallback==='function'){
   requestIdleCallback(work,{timeout:55});
  }else{
   setTimeout(work,0);
  }
 }
 function requestTile(layout,state,tx,ty){
  const key=tx+':'+ty;
  const existing=state.tiles.get(key);
  if(existing){
   // LRU updates help long expeditions stay inside a fixed memory budget.
   state.tiles.delete(key);state.tiles.set(key,existing);
   return existing;
  }
  if(!state.queued.has(key)){
   state.queued.add(key);
   state.queue.push({key,tx,ty});
  }
  return null;
 }
 function paintFallback(ctx,layout,x,y,width,height){
  // A cheap visible approximation while tiles are rendering; no blackout.
  ctx.fillStyle='#050a10';
  ctx.fillRect(x,y,width,height);
  ctx.save();
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const e of layout.corridors||[]){
   const path=e.path||[{x:e.x1,y:e.y1},{x:e.x2,y:e.y2}];
   const margin=e.width+80;
   if(Math.max(e.x1,e.x2)+margin<x||Math.min(e.x1,e.x2)-margin>x+width||
      Math.max(e.y1,e.y2)+margin<y||Math.min(e.y1,e.y2)-margin>y+height)continue;
   ctx.strokeStyle='#102531';ctx.lineWidth=e.width*2;
   ctx.beginPath();
   path.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
   ctx.stroke();
  }
  for(const r of layout.rooms||[]){
   if(r.x+r.rx<x||r.x-r.rx>x+width||r.y+r.ry<y||r.y-r.ry>y+height)continue;
   ctx.fillStyle=r.type==='boss'?'#251018':r.type==='start'?'#0d291f':'#10313c';
   ctx.beginPath();ctx.ellipse(r.x,r.y,r.rx,r.ry,0,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
 }

 window.AbyssalTerrain={
  draw(ctx,layout,cameraX,cameraY,width,height,t){
   if(!layout)return;
   const state=getState(layout);
   const viewX=clamp(cameraX,0,layout.width),viewY=clamp(cameraY,0,layout.height);
   const viewW=Math.max(0,Math.min(width,layout.width-viewX));
   const viewH=Math.max(0,Math.min(height,layout.height-viewY));
   if(!viewW||!viewH)return;
   const minX=Math.floor(viewX/TILE_WORLD);
   const minY=Math.floor(viewY/TILE_WORLD);
   const maxX=Math.min(Math.ceil(layout.width/TILE_WORLD)-1,Math.floor((viewX+viewW-1e-5)/TILE_WORLD));
   const maxY=Math.min(Math.ceil(layout.height/TILE_WORLD)-1,Math.floor((viewY+viewH-1e-5)/TILE_WORLD));
   const needed=[],centerX=viewX+viewW*.5,centerY=viewY+viewH*.5;
   for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++){
    needed.push({tx,ty,priority:Math.hypot((tx+.5)*TILE_WORLD-centerX,(ty+.5)*TILE_WORLD-centerY)});
   }
   // Generate the visible center first, not far edges.
   needed.sort((a,b)=>a.priority-b.priority);
   paintFallback(ctx,layout,viewX,viewY,viewW,viewH);
   for(const item of needed)requestTile(layout,state,item.tx,item.ty);
   // Build only *after* draw returns, not in the click handler or first frame.
   schedule(state,layout);
   for(const item of needed){
    const tile=state.tiles.get(item.tx+':'+item.ty);
    if(tile)ctx.drawImage(tile.canvas,tile.x,tile.y,tile.width,tile.height);
   }
   ctx.save();
   // Suspended marine snow remains animated while ground tiles catch up.
   for(let i=0;i<90;i++){
    const x=cameraX+((i*137.7+t*.003)%width);
    const y=cameraY+((i*83.3-t*.006)%height+height)%height;
    ctx.fillStyle='rgba(146,206,215,'+(.04+(i%5)*.025)+')';
    ctx.beginPath();ctx.arc(x,y,.7+i%3*.35,0,Math.PI*2);ctx.fill();
   }
   const fog=ctx.createRadialGradient(
    cameraX+width*.5,cameraY+height*.5,width*.12,
    cameraX+width*.5,cameraY+height*.5,width*.67);
   fog.addColorStop(0,'rgba(0,5,15,0)');
   fog.addColorStop(1,'rgba(0,5,15,.72)');
   ctx.fillStyle=fog;ctx.fillRect(cameraX,cameraY,width,height);
   ctx.restore();
  },
  // Diagnostics only; never mutates terrain, seeds or progression.
  stats(layout){
   const state=layout&&states.get(layout);
   return {built:state?.buildCount||0,cached:state?.tiles.size||0,queued:state?.queue.length||0};
  }
 };
})();
