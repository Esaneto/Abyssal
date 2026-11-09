/* Deterministic server/client resource deposits. Objects are generated on demand
 * from world seed; no continuous simulation or replication of whole inventories.
 */
(function(root,factory){
 const config=typeof module==='object'&&module.exports?require('./abyssal-exploration-config.js'):root.AbyssalExplorationConfig;
 const ecology=typeof module==='object'&&module.exports?require('./abyssal-open-sea-ecology.js'):root.AbyssalOpenSeaEcology;
 const stream=typeof module==='object'&&module.exports?require('./abyssal-ocean-stream.js'):root.AbyssalOceanStream;
 const api=factory(config,ecology,stream);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalResourceFields=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(config,ecology,stream){
 'use strict';
 function hash(text){let x=2166136261;for(const c of String(text)){x^=c.charCodeAt(0);x=Math.imul(x,16777619);}return x>>>0;}
 function rng(seed){let state=hash(seed);return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);}
 const POOLS=Object.freeze({classic:['seaMineral','kelpFiber','coralSample','salvageMetal'],rift:['salvageMetal','deepCrystal','bioSample','abyssCrystal']});
 function create(seed,mode='classic',width=4800,height=3000,count=70){
  const random=rng(seed),pool=POOLS[mode==='rift'?'rift':'classic'],out=[];
  const n=Math.min(150,Math.max(1,Math.floor(count)));
  for(let i=0;i<n;i++){
   const x=140+random()*Math.max(1,width-280),y=140+random()*Math.max(1,height-280);
   const zone=mode==='rift'?null:ecology?.habitatAt?.(x,y);
   const available=zone?.resources||pool;
   const type=available[Math.floor(random()*available.length)];
   out.push({id:String(i),type,habitat:zone?.id||null,x:Math.round(x),y:Math.round(y),amount:1+Math.floor(random()*2)});
  }
  return out;
 }
 function streamNear(seed,x,y,radius=2000,collected=[]){
  const taken=new Set(collected),nodes=[];
  if(!stream)return [];
  for(const {cx,cy} of stream.near(x,y,radius)){
   const chunk=stream.generate(seed,cx,cy,ecology);
   for(const node of chunk.resources){
    if(!taken.has(node.id)&&Math.hypot(node.x-x,node.y-y)<=radius)nodes.push(node);
   }
  }
  return nodes;
 }
 function nearby(nodes,x,y,radius=260,collected=[]){
  const taken=new Set(collected);
  return nodes.filter(node=>!taken.has(node.id)&&(node.x-x)**2+(node.y-y)**2<=radius**2);
 }
 function eligible(node,x,y,ownedTools={},radius=115){
  if(!node||!Number.isFinite(x)||!Number.isFinite(y))return {ok:false,reason:'invalid-position'};
  if(Math.hypot(node.x-x,node.y-y)>radius)return {ok:false,reason:'too-far'};
  const required=config.RESOURCES[node.type]?.tool;
  if(required&&!(Number(ownedTools[required])>0))return {ok:false,reason:'tool-required',tool:required};
  return {ok:true};
 }
 return Object.freeze({create,streamNear,nearby,eligible});
});
