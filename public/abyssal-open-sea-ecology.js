/* Open-sea ecology, deterministic and shared by solo and multiplayer.
 * This module owns habitat selection and decisions, never networking or damage.
 */
(function(root,factory){
 const geo=typeof module==='object'&&module.exports?require('./abyssal-ocean-geography.js'):root.AbyssalOceanGeography;
 const api=factory(geo);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalOpenSeaEcology=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(geo){
 'use strict';
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const ZONES=Object.freeze([
  {id:'reef',label:'RECIFE VIVO',x:560,y:650,rx:790,ry:540,fauna:['reefshark','hawksbill','butterflyray','eagleray'],resources:['coralSample','seaMineral']},
  {id:'kelp',label:'FLORESTA DE ALGAS',x:1810,y:680,rx:850,ry:510,fauna:['leatherback','stingray','zebramoray'],resources:['kelpFiber','seaMineral']},
  {id:'rocks',label:'COSTA ROCHOSA',x:3780,y:710,rx:850,ry:640,fauna:['spidercrab','nautilus','zebramoray'],resources:['salvageMetal','seaMineral']},
  {id:'canyon',label:'CÂNION SUBMARINO',x:820,y:2240,rx:900,ry:670,fauna:['goblin','frilled','bigfin','whiplash'],resources:['deepCrystal','salvageMetal']},
  {id:'deep',label:'ÁGUAS PROFUNDAS',x:2740,y:2230,rx:940,ry:670,fauna:['angler','viperfish','blackdragon','seapig'],resources:['deepCrystal','bioSample']},
  {id:'wreck',label:'DESTROÇOS AFUNDADOS',x:4110,y:2200,rx:700,ry:680,fauna:['spidercrab','goblin','nautilus'],resources:['salvageMetal','bioSample']}
 ]);
 const REGION_VARIANTS=Object.freeze({
  open:{id:'open',label:'ÁGUAS LIVRES',fauna:['leatherback','eagleray','butterflyray'],resources:['seaMineral','bioSample']},
  twilight:{id:'twilight',label:'ZONA CREPUSCULAR',fauna:['nautilus','bigfin','frilled','goblin'],resources:['bioSample','deepCrystal']},
  abyss:{id:'abyss',label:'PLANÍCIE ABISSAL',fauna:['seapig','yeticrab','whiplash','angler'],resources:['abyssCrystal','bioSample']}
 });
 const PREDATORS=new Set(['reefshark','goblin','frilled','viperfish','blackdragon','angler','zebramoray']);
 const SMART=new Set(['bigfin','whiplash','nautilus','spidercrab']);
 function habitatAt(x,y){
  // Side-view geological habitats replace the repeated six-ellipse pattern.
  const type=geo?.classify?.(x,y)||'open';
  const base=ZONES.find(z=>z.id===type)||REGION_VARIANTS[type]||REGION_VARIANTS.open;
  const depthBand=y>7100?'deep':y>3400?'twilight':'shelf';
  return {...base,depthBand,province:Math.floor(x/4800)+':'+Math.floor(y/3000),
   x:Number(x)||0,y:Number(y)||0};
 }
 function speciesAt(x,y,random=Math.random){
  const zone=habitatAt(x,y),roll=clamp(Number(random())||0,0,.999999);
  // Rare giants and gelatinous filter-feeders remain passive and non-farming.
  if((zone.id==='open'||zone.id==='twilight')&&roll<.007)return 'leviathan';
  if(zone.depthBand!=='shelf'&&roll<.024)return 'siphonophore';
  const fauna=zone.fauna||REGION_VARIANTS.open.fauna;
  return fauna[Math.min(fauna.length-1,Math.floor(clamp(Number(random())||0,0,.999999)*fauna.length))];
 }
 function temperament(id){
  return PREDATORS.has(id)?'aggressive':SMART.has(id)?'smart':'passive';
 }
 function canSee(entity,target,range=530,halfAngle=Math.PI*.44){
  const dx=target.x-entity.x,dy=target.y-entity.y,d2=dx*dx+dy*dy;if(d2>range*range)return false;
  const a=Math.atan2(dy,dx)-(Number(entity.angle)||0);
  return Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<=halfAngle&&(!geo||geo.segmentClear(entity.x,entity.y,target.x,target.y,2));
 }
 function decide(entity,players,seconds=0,now=Date.now(),neighbors=[]){
  const mode=entity.wildlifeMode||temperament(entity.specimenSkinId);
  const homeX=Number.isFinite(entity.homeX)?entity.homeX:entity.x;
  const homeY=Number.isFinite(entity.homeY)?entity.homeY:entity.y;
  // Fish in the same school synchronize migration heading while keeping
  // slight individual offsets. No leader entity or cross-chunk simulation.
  let schoolSeed=0;
  for(const ch of String(entity.schoolId||entity.id||1))schoolSeed=(Math.imul(schoolSeed,31)+ch.charCodeAt(0))>>>0;
  const theta=seconds*.16+(schoolSeed%628)/100;
  const offset=((Number(entity.id)||1)%5-2)*22;
  const patrol={x:clamp(homeX+Math.cos(theta)*170+offset,32,23968),y:clamp(homeY+Math.sin(theta*.83)*125+offset*.4,32,8968),alive:true,moveSpeed:115};
  let target=null,dist=Infinity;
  for(const player of players||[]){
   if(!player||player.alive===false)continue;
   const d=Math.hypot(player.x-entity.x,player.y-entity.y);
   if(d<dist&&canSee(entity,player)){target=player;dist=d;}
  }
  const provoked=(Number(entity.provokedUntil)||0)>now;
  if(!target&&provoked){
   for(const p of players||[]){
    const d=Math.hypot((p?.x||0)-entity.x,(p?.y||0)-entity.y);
    if(p&&p.alive!==false&&d<260&&d<dist){target=p;dist=d;}
   }
  }
  // Lightweight trophic behavior: threatened smaller species move away from
  // nearby predators; predators inspect possible prey while keeping player
  // combat strictly separate. All candidates are already active AOI entities.
  if(!target&&Array.isArray(neighbors)&&neighbors.length){
   let candidate=null,closest=Infinity;
   for(const other of neighbors){
    if(!other||other===entity||other.hp<=0||other.schoolId===entity.schoolId)continue;
    const d=Math.hypot(other.x-entity.x,other.y-entity.y);
    if(d>300||d>=closest)continue;
    if(mode==='aggressive'&&other.wildlifeMode==='passive'){candidate=other;closest=d;}
    if(mode!=='aggressive'&&other.wildlifeMode==='aggressive'){candidate=other;closest=d;}
   }
   if(candidate&&mode==='aggressive')
    return {mode:'forage',target:{x:candidate.x,y:candidate.y,alive:true,moveSpeed:80},aggressive:false};
   if(candidate){
    const dx=entity.x-candidate.x,dy=entity.y-candidate.y,d=Math.hypot(dx,dy)||1;
    return {mode:'evade-predator',target:{x:clamp(entity.x+dx/d*250,25,23975),y:clamp(entity.y+dy/d*250,25,8975),alive:true,moveSpeed:180},aggressive:false};
   }
  }
  if(!target)return {mode:'patrol',target:patrol,aggressive:false};
  const endangered=Number(entity.hp)<Number(entity.maxHp||entity.hp)*.45;
  if(mode==='passive'&&!provoked||mode==='smart'&&(endangered||dist<140)&&!provoked){
   const dx=entity.x-target.x,dy=entity.y-target.y,d=Math.hypot(dx,dy)||1;
   return {mode:'flee',target:{x:clamp(entity.x+dx/d*320,25,23975),y:clamp(entity.y+dy/d*320,25,8975),alive:true,moveSpeed:200},aggressive:false};
  }
  if(mode==='aggressive'&&!provoked&&dist>245)return {mode:'alert',target:patrol,aggressive:false};
  if(mode==='smart'&&!provoked&&dist>175)return {mode:'alert',target:patrol,aggressive:false};
  return {mode:'attack',target,aggressive:true};
 }
 return Object.freeze({ZONES,habitatAt,speciesAt,temperament,canSee,decide});
});
