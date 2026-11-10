/* Curated Mar Aberto geology. Small deterministic sectors are generated
 * only around a diver. Mining and filling are validated on the server.
 * Fossas and Solo/Online shooter worlds never call this generator.
 */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const config=node?require('./abyssal-exploration-config.js'):root.AbyssalExplorationConfig;
 const geo=node?require('./abyssal-ocean-geography.js'):root.AbyssalOceanGeography;
 const stream=node?require('./abyssal-ocean-stream.js'):root.AbyssalOceanStream;
 const api=factory(config,geo,stream);
 if(node)module.exports=api;
 if(root)root.AbyssalResourceFields=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(config,geo,stream){
 'use strict';
 const ENABLED=true, CHUNK=stream?.CHUNK||1200, MAX_COUNT=1000000;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function hash(text){let x=2166136261;for(const c of String(text)){x^=c.charCodeAt(0);x=Math.imul(x,16777619);}return x>>>0;}
 function rng(seed){let s=hash(seed);return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
 function depthAt(y){return clamp(Number(y)||0,0,geo?.HEIGHT||21000)/(geo?.DEPTH_SCALE||2.3333);}
 function rollType(depth,rock,random){
  const pool=depth<400?['seaMineral','seaMineral','phosphorite']:
   depth<1400?['seaMineral','phosphorite','ferromanganeseCrust','ferromanganeseCrust','oilSeep']:
   depth<3500?['ferromanganeseCrust','hydrothermalSulfide','phosphorite','oilSeep','gasSeep','ferromanganeseCrust']:
   ['polymetallicNodule','polymetallicNodule','ferromanganeseCrust','hydrothermalSulfide','gasSeep','oilSeep'];
  // Seeps are rare geological fractures, not guaranteed merely by diving deeper.
  let kind=pool[Math.floor(random()*pool.length)];
  if((kind==='oilSeep'||kind==='gasSeep')&&random()>.38)
   kind=depth>3500?'polymetallicNodule':'ferromanganeseCrust';
  if(kind==='polymetallicNodule'&&rock)kind='ferromanganeseCrust';
  if(kind==='hydrothermalSulfide'&&depth<1200)kind='phosphorite';
  if(kind==='hydrothermalSulfide'&&!rock)kind=depth>3500?'polymetallicNodule':'ferromanganeseCrust';
  return kind;
 }
 const cache=new Map();
 function sector(seed,cx,cy){
  const key=String(seed)+':'+cx+':'+cy;
  if(cache.has(key))return cache.get(key);
  const random=rng('seabed:v2:'+key),nodes=[];
  const minX=cx*CHUNK,minY=cy*CHUNK,maxX=Math.min(geo.WIDTH,minX+CHUNK),maxY=Math.min(geo.HEIGHT,minY+CHUNK);
  if(minX>=geo.WIDTH||minY>=geo.HEIGHT)return nodes;
  // A maximum of two stationary deposits per sector. Nothing is simulated off screen.
  for(let i=0;i<2;i++){
   let point=null,isRock=false;
   for(let attempt=0;attempt<13;attempt++){
    const nearbyRocks=geo.ROCKS.filter(r=>r.x+r.rx>=minX&&r.x-r.rx<=maxX&&r.y+r.ry>=minY&&r.y-r.ry<=maxY);
    const rock=nearbyRocks.length&&random()<.56?nearbyRocks[Math.floor(random()*nearbyRocks.length)]:null;
    let x,y;
    if(rock){
     const angle=-Math.PI*.95+random()*Math.PI*.9;
     x=rock.x+Math.cos(angle)*(rock.rx-6);y=rock.y+Math.sin(angle)*(rock.ry-6);
    }else{
     x=minX+60+random()*Math.max(1,maxX-minX-120);
     y=geo.floorAt(x)-42-random()*15;
    }
    if(x<minX+16||x>=maxX-16||y<minY+16||y>=maxY-16)continue;
    if(!rock&&geo.isSolid(x,y,17))continue;
    point={x:Math.round(x),y:Math.round(y)};isRock=Boolean(rock);break;
   }
   if(!point)continue;
   const depth=depthAt(point.y),type=rollType(depth,isRock,random);
   const isSeep=type==='oilSeep'||type==='gasSeep';
   nodes.push({id:'geo:'+cx+':'+cy+':'+i,type,x:point.x,y:point.y,
    amount:isSeep?1:1+Math.floor(random()*3),depth:Math.round(depth),
    feature:isSeep?'fracture':isRock?'embedded-rock':'seabed'});
  }
  // Bounded cache; sector generation is deterministic across eviction.
  if(cache.size>=320)cache.delete(cache.keys().next().value);
  cache.set(key,nodes);
  return nodes;
 }
 function streamNear(seed,x,y,radius=1700,collected=[]){
  if(!ENABLED||!Number.isFinite(x)||!Number.isFinite(y))return [];
  const taken=collected instanceof Set?collected:new Set(collected);
  const sectors=stream.near(x,y,Math.min(2500,Math.max(120,radius))),result=[];
  for(const {cx,cy} of sectors){
   for(const node of sector(seed,cx,cy)){
    if(taken.has(node.id))continue;
    if((node.x-x)**2+(node.y-y)**2<=radius*radius)result.push(node);
   }
  }
  return result.sort((a,b)=>(a.x-x)**2+(a.y-y)**2-(b.x-x)**2-(b.y-y)**2).slice(0,64);
 }
 function nearby(nodes,x,y,radius=260,collected=[]){
  const taken=collected instanceof Set?collected:new Set(collected);
  return (nodes||[]).filter(n=>!taken.has(n.id)&&(n.x-x)**2+(n.y-y)**2<=radius*radius);
 }
 function create(){return [];} // Fossas and shooter deposits remain disabled.
 function toolFor(type){return type==='oilSeep'||type==='gasSeep'?'offshoreCable':'abyssPickaxe';}
 function eligible(node,x,y,inventory={},radius=115,selectedTool=null){
  if(!node||!Number.isFinite(x)||!Number.isFinite(y)||!config.RESOURCES[node.type]||!['ore','seep'].includes(config.RESOURCES[node.type].kind))return {ok:false,reason:'invalid-node'};
  if(Math.hypot(node.x-x,node.y-y)>radius)return {ok:false,reason:'too-far'};
  const tool=toolFor(node.type);
  if(!(Number(inventory?.[tool])>0))return {ok:false,reason:tool==='offshoreCable'?'offshore-infrastructure-required':'tool-required',tool};
  if(selectedTool&&selectedTool!==tool)return {ok:false,reason:'select-tool',tool};
  return {ok:true,tool};
 }
 function starterKit(raw,alreadyGranted=false){
  const inventory={...(raw||{})};
  if(!alreadyGranted){
   inventory.abyssPickaxe=Math.max(1,Math.floor(Number(inventory.abyssPickaxe)||0));
   inventory.emptyCylinder=clamp(Math.floor(Number(inventory.emptyCylinder)||0)+4,0,MAX_COUNT);
  }
  return {inventory,granted:true,changed:!alreadyGranted};
 }
 function collect(node,inventory){
  const def=config.RESOURCES[node?.type];
  if(!def||!['ore','seep'].includes(def.kind))return {ok:false,reason:'invalid-node'};
  const next={...(inventory||{})},isSeep=def.kind==='seep';
  if(isSeep)return {ok:false,reason:'offshore-infrastructure-required'};
  const required=toolFor(node.type);
  if(!(Number(next[required])>0))return {ok:false,reason:isSeep?'empty-cylinder-required':'tool-required'};
  const item=isSeep?def.filled:node.type,amount=isSeep?1:clamp(Math.floor(Number(node.amount)||1),1,3);
  if(!config.RESOURCES[item])return {ok:false,reason:'unknown-item'};
  if(Number(next[item]||0)+amount>MAX_COUNT)return {ok:false,reason:'inventory-full'};
  if(isSeep)next.emptyCylinder=Math.floor(Number(next.emptyCylinder))-1;
  next[item]=Math.floor(Number(next[item])||0)+amount;
  return {ok:true,inventory:next,item,amount};
 }
 return Object.freeze({ENABLED,CHUNK,depthAt,streamNear,nearby,create,eligible,toolFor,starterKit,collect});
});
