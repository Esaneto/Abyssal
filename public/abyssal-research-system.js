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
 const toCount=v=>Number.isFinite(Number(v))?Math.max(0,Math.floor(Number(v))):0;
 function sanitizeLevels(raw={}){
  const result=Object.create(null);
  for(const [id,def] of Object.entries(DEFINITIONS))result[id]=Math.min(def.max,toCount(raw?.[id]));
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
 function study(id,levels={},inventory={}){
  const definition=DEFINITIONS[id];
  if(!definition)return {ok:false,reason:'unknown-research'};
  const safeLevels=sanitizeLevels(levels),safeInventory=sanitizeInventory(inventory);
  const level=safeLevels[id],cost=costFor(id,level);
  if(level>=definition.max)return {ok:false,reason:'max-level'};
  if(definition.requires.some(prerequisite=>safeLevels[prerequisite]<1))return {ok:false,reason:'prerequisite'};
  if(Object.entries(cost).some(([material,amount])=>safeInventory[material]<amount))
   return {ok:false,reason:'resources',cost};
  const nextInventory={...safeInventory};
  for(const [material,amount] of Object.entries(cost))nextInventory[material]-=amount;
  const nextLevels={...safeLevels,[id]:level+1};
  return {ok:true,levels:nextLevels,inventory:nextInventory,cost,level:level+1};
 }
 // Owners retain benefits already purchased with coins even when shop sales
 // are retired. Migration never spends resources or degrades owned levels.
 function migrateLegacy(levels={}){return {levels:sanitizeLevels(levels),transferred:[]};}
 function unlocked(id,levels={},legacy={}){
  const definition=DEFINITIONS[id];if(!definition)return false;
  return toCount(levels[id])>0||Boolean(definition.legacyMeta&&toCount(legacy[definition.legacyMeta])>0);
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
 return Object.freeze({VERSION:1,DEFINITIONS,sanitizeLevels,sanitizeInventory,costFor,study,migrateLegacy,unlocked,equipActives});
});
