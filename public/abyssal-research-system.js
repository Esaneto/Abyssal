/* Pure research transactions, shared by client and authoritative server.
 * No database writes, purchases, awards or client claims are trusted here.
 */
(function(root,factory){
 const config=typeof module==='object'&&module.exports?require('./abyssal-exploration-config.js'):root.AbyssalExplorationConfig;
 const api=factory(config);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalResearchSystem=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(config){
 'use strict';
 const DEFINITIONS=config.RESEARCH;
 const COMBAT_ENERGY=Object.freeze({pulse:400,dash:400});
 const toCount=v=>Number.isFinite(Number(v))?Math.max(0,Math.floor(Number(v))):0;
 // Only Q/E survived the retired shop as real research. Never grant the four old starting passives.
 function sanitizeLegacyActives(raw={}){const result={};for(const id of Object.keys(COMBAT_ENERGY))if(toCount(raw?.[id])>0)result[id]=1;return result;}
 function sanitizeLevels(raw={}){
  const result=Object.create(null);
  for(const [id,def] of Object.entries(DEFINITIONS))result[id]=def.starter?Math.max(1,Math.min(def.max,toCount(raw?.[id]))):Math.min(def.max,toCount(raw?.[id]));
  return result;
 }
 function sanitizeInventory(raw={}){
  const result=Object.create(null);
  for(const id of Object.keys(config.RESOURCES))result[id]=Math.min(1000000,toCount(raw?.[id]));
  return result;
 }
 function costFor(id,currentLevel=0){
  const definition=DEFINITIONS[id];if(!definition)return null;
  const level=toCount(currentLevel),scale=1+level;
  return Object.fromEntries(Object.entries(definition.cost).map(([resource,amount])=>[resource,Math.max(1,amount*scale)]));
 }
 function offshoreCostFor(id,currentLevel=0){
  const definition=DEFINITIONS[id];if(!definition)return null;
  const multiplier=1+toCount(currentLevel);
  return Object.fromEntries(Object.entries(definition.offshoreCost||{}).map(([type,amount])=>[type,Math.max(0,toCount(amount)*multiplier)]));
 }
 function study(id,levels={},inventory={},offshore=null){
  const definition=DEFINITIONS[id];
  if(!definition)return {ok:false,reason:'unknown-research'};
  if(Object.hasOwn(COMBAT_ENERGY,id))return {ok:false,reason:'energy-required',cost:COMBAT_ENERGY[id]};
  const safeLevels=sanitizeLevels(levels),safeInventory=sanitizeInventory(inventory);
  const level=safeLevels[id],cost=costFor(id,level),offshoreCost=offshoreCostFor(id,level)||{};
  if(level>=definition.max)return {ok:false,reason:'max-level'};
  if(definition.requires.some(prerequisite=>safeLevels[prerequisite]<1))return {ok:false,reason:'prerequisite'};
  if(Object.entries(cost).some(([material,amount])=>safeInventory[material]<amount))
   return {ok:false,reason:'resources',cost,offshoreCost};
  if(Object.entries(offshoreCost).some(([material,amount])=>!offshore||Number(offshore[material])<amount))
   return {ok:false,reason:'offshore-resources',cost,offshoreCost};
  const nextInventory={...safeInventory};
  for(const [material,amount] of Object.entries(cost))nextInventory[material]-=amount;
  const nextLevels={...safeLevels,[id]:level+1};
  const nextOffshore=offshore&&Object.keys(offshoreCost).length?
   {...offshore,...Object.fromEntries(Object.entries(offshoreCost).map(([type,amount])=>[type,Math.max(0,Number(offshore[type])-amount)]))}:null;
  return {ok:true,levels:nextLevels,inventory:nextInventory,cost,offshoreCost,level:level+1,...(nextOffshore?{offshore:nextOffshore}:{})};
 }
 // Energy alternative for the classic campaign; no unavailable Mar Aberto materials needed.
 function studyCombatEnergy(id,levels={},legacy={},balance=0){
  if(!Object.hasOwn(COMBAT_ENERGY,id))return {ok:false,reason:'unknown-research'};
  const next=migrateLegacy(levels,legacy).levels,cost=COMBAT_ENERGY[id],energy=toCount(balance);
  if(next[id]>=1)return {ok:false,reason:'owned'};
  if(energy<cost)return {ok:false,reason:'energy',cost};
  return {ok:true,levels:{...next,[id]:1},level:1,cost,energy:energy-cost};
 }
 // Preserve the two legitimate purchased Q/E unlocks without charging twice.
 // Retired permanent combat buffs are not research, even if present in old saves.
 function migrateLegacy(levels={},legacy={}){
  const next=sanitizeLevels(levels),transferred=[];
  for(const [id,owned] of Object.entries(sanitizeLegacyActives(legacy))){
   if(owned>next[id]){next[id]=owned;transferred.push(id);}
  }
  return {levels:next,transferred};
 }
 function unlocked(id,levels={},legacy={}){
  const definition=DEFINITIONS[id];if(!definition)return false;
  return Boolean(definition.starter)||toCount(levels[id])>0||Boolean(sanitizeLegacyActives(legacy)[id]);
 }
 function equipActives(selected=[],levels={},legacy={}){
  const valid=[];
  for(const id of selected||[]){
   if(valid.includes(id))continue;
   const def=DEFINITIONS[id];
   if(!def||def.group!=='active'||!unlocked(id,levels,legacy))continue;
   if(valid.length<2)valid.push(id);
  }
  return valid;
 }
 return Object.freeze({VERSION:1,DEFINITIONS,COMBAT_ENERGY,studyCombatEnergy,sanitizeLevels,sanitizeInventory,costFor,offshoreCostFor,study,sanitizeLegacyActives,migrateLegacy,unlocked,equipActives});
});
