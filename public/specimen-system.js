(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalSpecimenSystem=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_PROGRESS=5000;
 const BASE_COOLDOWN=10;
 const BASE_RESPAWN=20;
 const MAX_COOLDOWN_REDUCTION=5;
 const MAX_ATTRIBUTE_BONUS=.05;
 const MAX_RANGE_BONUS=.20;
 const MAX_RESPAWN_REDUCTION=10;
 function clamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0));}
 function progress(points){return clamp(points,0,MAX_PROGRESS)/MAX_PROGRESS;}
 function pointsForKill(boss=false){return boss?10:1;}
 function stats(points){
  const p=progress(points);
  return Object.freeze({
   points:Math.round(clamp(points,0,MAX_PROGRESS)),
   progress:p,
   percent:p*100,
   cooldown:BASE_COOLDOWN-MAX_COOLDOWN_REDUCTION*p,
   cooldownReduction:MAX_COOLDOWN_REDUCTION*p,
   attributeBonus:MAX_ATTRIBUTE_BONUS*p,
   rangeMultiplier:1+MAX_RANGE_BONUS*p,
   rangeBonus:MAX_RANGE_BONUS*p,
   respawnSeconds:BASE_RESPAWN-MAX_RESPAWN_REDUCTION*p,
   respawnReduction:MAX_RESPAWN_REDUCTION*p
  });
 }
 function normalizeMap(value){
  const out=Object.create(null);
  if(value&&typeof value==='object')for(const [id,raw] of Object.entries(value)){
   const n=Math.round(clamp(raw,0,MAX_PROGRESS));if(n>0)out[String(id)]=n;
  }
  return out;
 }
 function addKill(map,id,boss=false){
  const next=normalizeMap(map),key=String(id||'default');
  next[key]=Math.round(clamp((Number(next[key])||0)+pointsForKill(boss),0,MAX_PROGRESS));
  return next;
 }
 function pointsFor(map,id){return Math.round(clamp(map&&map[String(id||'default')],0,MAX_PROGRESS));}
 function passiveMultiplier(profile,points,alive=true){
  if(!alive||!profile)return 1;
  const extra=stats(points).attributeBonus;
  const amount=(Math.max(0,Number(profile.percent)||0)/100)+extra;
  return profile.attribute==='defense'?Math.max(.1,1-amount):1+amount;
 }
 function abilityRange(baseRange,points){return Math.max(0,Number(baseRange)||0)*stats(points).rangeMultiplier;}
 function abilityCooldown(points){return stats(points).cooldown;}
 function respawnSeconds(points){return stats(points).respawnSeconds;}
 return Object.freeze({MAX_PROGRESS,BASE_COOLDOWN,BASE_RESPAWN,MAX_COOLDOWN_REDUCTION,MAX_ATTRIBUTE_BONUS,MAX_RANGE_BONUS,MAX_RESPAWN_REDUCTION,progress,pointsForKill,stats,normalizeMap,addKill,pointsFor,passiveMultiplier,abilityRange,abilityCooldown,respawnSeconds});
});