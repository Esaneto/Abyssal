/* Sparse open-ocean sectors. 5x wider and 3x taller: 15x the former area.
 * Deterministic by world ID / chunk coords; only nearby sectors are generated.
 * No global array of the full ocean is ever allocated. UMD for Node + browser.
 */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalOceanStream=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const WIDTH=24000,HEIGHT=9000,CHUNK=1200,AREA_RATIO=15;
 const MAX_NEARBY=110,INITIAL_FAUNA=3,RESOURCE_COUNT=5;
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
  for(let i=0;i<INITIAL_FAUNA;i++){
   const x=x0+position(140,cellWidth),y=y0+position(140,cellHeight);
   const species=ecology?.speciesAt?.(x,y,next)||'seapig';
   animals.push({id:id(cx,cy)+':f'+i,x,y,species,temperament:ecology?.temperament?.(species)||'passive',schoolId:id(cx,cy)+':s'+Math.floor(i/2)});
  }
  for(let i=0;i<RESOURCE_COUNT;i++){
   const x=x0+position(70,cellWidth),y=y0+position(70,cellHeight);
   const zone=ecology?.habitatAt?.(x,y);
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
