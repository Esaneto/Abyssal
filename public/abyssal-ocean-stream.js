/* Sparse open-ocean sectors. 5x wider and 3x taller: 15x the former area.
 * Deterministic by world ID / chunk coords; only nearby sectors are generated.
 * No global array of the full ocean is ever allocated. UMD for Node + browser.
 */
(function(root,factory){
 const geo=typeof module==='object'&&module.exports?require('./abyssal-ocean-geography.js'):root.AbyssalOceanGeography;
 const api=factory(geo);if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalOceanStream=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(geo){
 'use strict';
 const WIDTH=geo?.WIDTH||24000,HEIGHT=geo?.HEIGHT||21000,CHUNK=1200,AREA_RATIO=35;
 const MAX_NEARBY=150,INITIAL_FAUNA=6,RESOURCE_COUNT=0; // No unapproved resource nodes.
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function hash(key){let h=2166136261;for(const c of String(key)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
 function random(key){let n=hash(key);return ()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
 function chunkAt(x,y){return {cx:clamp(Math.floor(x/CHUNK),0,Math.ceil(WIDTH/CHUNK)-1),cy:clamp(Math.floor(y/CHUNK),0,Math.ceil(HEIGHT/CHUNK)-1)};}
 function id(cx,cy){return cx+':'+cy;}
 function near(x,y,radius=1800){
  const {cx,cy}=chunkAt(x,y),steps=Math.ceil(radius/CHUNK),list=[];
  for(let iy=Math.max(0,cy-steps);iy<=Math.min(Math.ceil(HEIGHT/CHUNK)-1,cy+steps);iy++)
   for(let ix=Math.max(0,cx-steps);ix<=Math.min(Math.ceil(WIDTH/CHUNK)-1,cx+steps);ix++){
    const left=ix*CHUNK,right=Math.min(WIDTH,left+CHUNK),top=iy*CHUNK,bottom=Math.min(HEIGHT,top+CHUNK);
    const px=clamp(x,left,right),py=clamp(y,top,bottom);
    if(Math.hypot(px-x,py-y)<=radius)list.push({cx:ix,cy:iy,key:id(ix,iy)});
   }
  return list;
 }
 function generate(seed,cx,cy,ecology){
  const next=random(seed+':'+cx+':'+cy),x0=cx*CHUNK,y0=cy*CHUNK,animals=[],resources=[];
  // The final row is only 600 units tall. Never populate beyond world bounds.
  const cellWidth=Math.max(0,Math.min(CHUNK,WIDTH-x0));
  const cellHeight=Math.max(0,Math.min(CHUNK,HEIGHT-y0));
  // Reject invalid coordinates instead of synthesizing off-map entities.
  if(!Number.isInteger(cx)||!Number.isInteger(cy)||cx<0||cy<0||cellWidth===0||cellHeight===0)return {key:id(cx,cy),animals,resources};
  const position=(margin,span)=>Math.min(span,margin)+next()*Math.max(0,span-2*margin);
  function randomWater(padding=30){
   // Bounded, deterministic rejection sampling. Fully solid sectors stay empty.
   for(let tries=0;tries<26;tries++){
    const x=x0+position(65,cellWidth),y=y0+position(65,cellHeight);
    if(!geo||!geo.isSolid(x,y,padding))return {x,y};
   }
   return null;
  }
  for(let i=0;i<INITIAL_FAUNA;i++){
   const point=randomWater(62);if(!point)break;
   const {x,y}=point,species=ecology?.speciesAt?.(x,y,next)||'seapig';
   const schooling=Boolean(ecology?.isSchooling?.(species)),schoolId=schooling?id(cx,cy)+':s0':id(cx,cy)+':solo'+i;
   animals.push({id:id(cx,cy)+':f'+i,x,y,species,temperament:ecology?.temperament?.(species)||'passive',schoolId});
   if(schooling){
    // Cohesive same-species groups spawn near a shared anchor rather than random points.
    for(let n=i+1;n<INITIAL_FAUNA;n++){
     const angle=n*2.39996,px=x+Math.cos(angle)*Math.min(58,20*n),py=y+Math.sin(angle)*Math.min(58,20*n);
     const point=px>=x0+24&&px<x0+cellWidth-24&&py>=y0+24&&py<y0+cellHeight-24&&!geo?.isSolid?.(px,py,28)?{x:px,y:py}:randomWater(36);
     if(!point)break;
     animals.push({id:id(cx,cy)+':f'+n,x:point.x,y:point.y,species,temperament:ecology?.temperament?.(species)||'passive',schoolId});
    }
    break;
   }
  }
  for(let i=0;i<RESOURCE_COUNT;i++){
   let point=null;
   // Mineral and coral deposits visually follow the solid seabed, not open sky.
   if(geo&&next()<.72){
    const x=x0+position(70,cellWidth),y=geo.floorAt(x)-32-next()*36;
    if(y>=y0+20&&y<y0+cellHeight-15&&!geo.isSolid(x,y,16))point={x,y};
   }
   if(!point)point=randomWater(18);
   if(!point)break;
   const {x,y}=point,zone=ecology?.habitatAt?.(x,y);
   const types=zone?.resources||['seaMineral'];
   resources.push({id:id(cx,cy)+':r'+i,type:types[Math.floor(next()*types.length)],x:Math.round(x),y:Math.round(y),amount:1+Math.floor(next()*3),habitat:zone?.id||null});
  }
  return {key:id(cx,cy),animals,resources};
 }
 function active(players,limit=MAX_NEARBY,radius=1900){
  // Round-robin between widely separated divers so the first player cannot
  // consume the entire AI budget before other party members receive fauna.
  if(!Number.isFinite(limit)||limit<=0)return [];
  const positions=(players||[]).filter(p=>p&&p.alive!==false&&Number.isFinite(p.x)&&Number.isFinite(p.y));
  const groups=positions.map(p=>near(p.x,p.y,radius).sort((a,b)=>{
   const da=(a.cx*CHUNK+CHUNK/2-p.x)**2+(a.cy*CHUNK+CHUNK/2-p.y)**2;
   const db=(b.cx*CHUNK+CHUNK/2-p.x)**2+(b.cy*CHUNK+CHUNK/2-p.y)**2;
   return da-db;
  }));
  const chunks=new Map(),cap=Math.max(1,Math.ceil(limit/INITIAL_FAUNA));
  let offset=0,progress=true;
  while(progress&&chunks.size<cap){
   progress=false;
   for(const group of groups){
    if(offset<group.length){
     const cell=group[offset];chunks.set(cell.key,cell);progress=true;
     if(chunks.size>=cap)break;
    }
   }
   offset++;
  }
  return [...chunks.values()];
 }
 function within(a,b,r=2300){return !!a&&!!b&&Math.hypot(a.x-b.x,a.y-b.y)<=r;}
 return Object.freeze({WIDTH,HEIGHT,CHUNK,AREA_RATIO,MAX_NEARBY,INITIAL_FAUNA,RESOURCE_COUNT,chunkAt,id,near,generate,active,within,random});
});
