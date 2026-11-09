/* Open-sea ecology, deterministic and shared by solo and multiplayer.
 * This module owns habitat selection and decisions, never networking or damage.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalOpenSeaEcology=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
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
 const PREDATORS=new Set(['reefshark','goblin','frilled','viperfish','blackdragon','angler','zebramoray']);
 const SMART=new Set(['bigfin','whiplash','nautilus','spidercrab']);
 function habitatAt(x,y){
  // Repeat ecology across a 5x3 ocean as neighboring biogeographical provinces.
  // Depth band affects species selection: sunlit shelf, twilight, deep water.
  const tileX=Math.floor(Math.max(0,x)/4800),tileY=Math.floor(Math.max(0,y)/3000);
  const localX=((x%4800)+4800)%4800,localY=((y%3000)+3000)%3000;
  let best=ZONES[0],d2=Infinity;
  for(const zone of ZONES){const d=((localX-zone.x)/zone.rx)**2+((localY-zone.y)/zone.ry)**2;if(d<d2){best=zone;d2=d;}}
  const depthBand=tileY===0?'shelf':tileY===1?'twilight':'deep';
  const province=tileX+':'+tileY;
  return {...best,id:best.id,province,depthBand,x:best.x+tileX*4800,y:best.y+tileY*3000};
 }
 function speciesAt(x,y,random=Math.random){
  const zone=habitatAt(x,y);
  // Rare, non-hostile ocean giants. Existing oarfish and siphonophore
  // silhouettes provide distinct anatomy without introducing new assets.
  const roll=clamp(Number(random())||0,0,.999999);
  if(zone.depthBand==='deep'&&roll<.012)return 'leviathan';
  if(zone.depthBand!=='shelf'&&roll<.035)return 'siphonophore';
  const fauna=zone.depthBand==='deep'?['seapig','whiplash','bigfin','angler','viperfish','blackdragon','yeticrab']:
   zone.depthBand==='twilight'?['nautilus','goblin','frilled','bigfin','viperfish','spidercrab']:
   zone.fauna;
  return fauna[Math.min(fauna.length-1,Math.floor(clamp(Number(random())||0,0,.999999)*fauna.length))];
 }
 function temperament(id){
  return PREDATORS.has(id)?'aggressive':SMART.has(id)?'smart':'passive';
 }
 function canSee(entity,target,range=530,halfAngle=Math.PI*.44){
  const dx=target.x-entity.x,dy=target.y-entity.y,d2=dx*dx+dy*dy;if(d2>range*range)return false;
  const a=Math.atan2(dy,dx)-(Number(entity.angle)||0);
  return Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<=halfAngle;
 }
 function decide(entity,players,seconds=0,now=Date.now()){
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
