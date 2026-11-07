/* Shared Mar Aberto density and progression rules.
 * Both the browser solo simulation and the Node multiplayer simulation use
 * this file so one mode cannot spawn stronger or more monsters than the other.
 * Fossas (rift) encounters and boss-specific scaling are intentionally untouched.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalSeaProgression=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAX_SEA_ENEMIES=100;
 const RESERVED_BOSS_SLOTS=4;
 const MAX_SEA_COMMON_ENEMIES=MAX_SEA_ENEMIES-RESERVED_BOSS_SLOTS;
 const MAX_PROGRESS_MINUTES=25;
 const HP_GROWTH_PER_MINUTE=.12;
 const XP_GROWTH_PER_MINUTE=.08;
 function progression(elapsedSeconds=0){
  const seconds=Number(elapsedSeconds);
  const minutes=Math.min(MAX_PROGRESS_MINUTES,Math.max(0,Number.isFinite(seconds)?seconds:0)/60);
  return {hp:1+HP_GROWTH_PER_MINUTE*minutes,xp:1+XP_GROWTH_PER_MINUTE*minutes};
 }
 function strengthenCommon(stats,elapsedSeconds=0){
  if(!stats)return stats;
  const scale=progression(elapsedSeconds);
  return {...stats,
   hp:Math.max(1,Math.round((Number(stats.hp)||1)*scale.hp)),
   seaXpMultiplier:scale.xp};
 }
 function scaleXp(baseValue,spawnMultiplier=1){
  const value=Number(baseValue),multiplier=Number(spawnMultiplier);
  return Math.max(1,Math.round((Math.max(0,Number.isFinite(value)?value:0))*
   Math.max(1,Number.isFinite(multiplier)?multiplier:1)*100)/100);
 }
 return Object.freeze({MAX_SEA_ENEMIES,RESERVED_BOSS_SLOTS,MAX_SEA_COMMON_ENEMIES,
  MAX_PROGRESS_MINUTES,HP_GROWTH_PER_MINUTE,XP_GROWTH_PER_MINUTE,
  progression,strengthenCommon,scaleXp});
});
