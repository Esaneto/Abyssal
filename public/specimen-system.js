(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const curated=node?require('./abyssal-curated-skins.js'):root.AbyssalCuratedSkins;
 const standard=node?require('./skin-standard.js'):root.AbyssalSkinStandard;
 const rarity=node?require('./specimen-rarity.js'):root.AbyssalSpecimenRarity;
 const api=factory(curated,standard,rarity);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalSpecimenSystem=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(curated,standard,rarity){
 'use strict';
 // Shared family-level creature vitals. Shop prices and active skills stay unchanged.
 const FAMILY_BASE=Object.freeze({
  signature:{hp:60,speed:172,damage:10},fish:{hp:70,speed:177,damage:9},
  shark:{hp:96,speed:196,damage:15},eel:{hp:68,speed:187,damage:11},
  ray:{hp:72,speed:174,damage:10},octopus:{hp:80,speed:164,damage:12},
  squid:{hp:78,speed:172,damage:12},jelly:{hp:46,speed:151,damage:7},
  crustacean:{hp:112,speed:138,damage:14},mollusc:{hp:88,speed:151,damage:13},
  reptile:{hp:108,speed:166,damage:15},benthic:{hp:90,speed:145,damage:12}
 });
 const FAMILY_LABELS=Object.freeze({
  signature:'Organismo singular',fish:'Peixe',shark:'Tubarão',
  eel:'Enguia / moreia',ray:'Raia',octopus:'Polvo',
  squid:'Cefalópode',jelly:'Medusa',crustacean:'Crustáceo',
  mollusc:'Molusco',reptile:'Réptil',benthic:'Bentônico'
 });
 const BUILTIN_FAMILIES=Object.freeze({
  default:'signature',violet:'jelly',solar:'benthic',toxic:'benthic',
  thorn:'benthic',abyssking:'mollusc',royal:'mollusc',glacier:'signature',
  coral:'benthic',bloodmoon:'squid',voidwing:'ray',
  abyssaleye:'fish',deepwarden:'crustacean',riftSmileRelic:'octopus',
  kraken:'squid',aberration:'octopus',angler:'fish',maw:'eel',
  leviathan:'fish',devourer:'squid',saltcroc:'reptile',
  blackcaiman:'reptile',reefshark:'shark',hammerhead:'shark',
  abysscroc:'shark',armoredgator:'crustacean',greensnake:'eel',
  electriceel:'ray',electriceellegacy:'eel'
 });
 function familyFor(id){
  const key=String(id||'default'),family=curated?.byId?.[key]?.family||BUILTIN_FAMILIES[key]||'fish';
  return Object.hasOwn(FAMILY_BASE,family)?family:'fish';
 }
 const RARITY_MULTIPLIER=Object.freeze({common:1,uncommon:1.08,rare:1.16,epic:1.25,legendary:1.35});
 const RARITY_BASE=Object.freeze({common:{hp:300,damage:30,speed:190},uncommon:{hp:400,damage:35,speed:205},rare:{hp:500,damage:40,speed:220},epic:{hp:600,damage:45,speed:235},legendary:{hp:700,damage:50,speed:250}});
 const BIOLOGICAL_STATS_CACHE=Object.create(null);
 function biologicalStats(id){
  const key=String(id||'default');
  if(Object.hasOwn(BIOLOGICAL_STATS_CACHE,key))return BIOLOGICAL_STATS_CACHE[key];
  const family=familyFor(key),rarityId=rarity?.rarityFor?.(key)||'common',base=RARITY_BASE[rarityId]||RARITY_BASE.common;
  const active=standard?.activeSpec?.(key);
  return BIOLOGICAL_STATS_CACHE[key]=Object.freeze({
   family,rarity:rarityId,hp:base.hp,speed:base.speed,damage:base.damage,
   activeDamage:Math.max(0,Number(active?.damage)||0),
   attack:String(active?.name||'Sem ataque ativo'),
   effect:String(active?.effect||'Nenhum efeito ativo')
  });
 }
 const MAX_PROGRESS=5000;
 const BASE_COOLDOWN=10;
 const BASE_RESPAWN=20;
 const MAX_COOLDOWN_REDUCTION=5;
 const MAX_ATTRIBUTE_BONUS=.10;
 const MAX_RANGE_BONUS=.20;
 const MAX_RESPAWN_REDUCTION=10; // Equipped companion: 20s base, reduced linearly by adaptation to 10s at maximum proficiency. Wild fauna uses the separate five-minute tracker.
 function clamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0));}
 function progress(points){return clamp(points,0,MAX_PROGRESS)/MAX_PROGRESS;}
 function pointsForKill(boss=false){return boss?10:1;}
 function stats(points){
  const p=progress(points);
  return Object.freeze({
   points:Math.round(clamp(points,0,MAX_PROGRESS)),
   progress:p,
   percent:p*100,
   cooldown:BASE_COOLDOWN,
   cooldownReduction:0,
   attributeBonus:MAX_ATTRIBUTE_BONUS*p,
   rangeMultiplier:1,
   rangeBonus:0,
   respawnSeconds:BASE_RESPAWN-MAX_RESPAWN_REDUCTION*p,
   respawnReduction:MAX_RESPAWN_REDUCTION*p
  });
 }
 function effectiveStats(id,points=0){const base=biologicalStats(id),factor=1+stats(points).attributeBonus;return {...base,hp:Math.round(base.hp*factor*100)/100,damage:Math.round(base.damage*factor*100)/100,speed:Math.round(base.speed*factor*100)/100};}
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
  const amount=Math.max(0,Number(profile.percent)||0)/100;
  return profile.attribute==='defense'?Math.max(.1,1-amount):1+amount;
 }
 function abilityRange(baseRange,_points){return Math.max(0,Number(baseRange)||0);}
 function abilityCooldown(_points){return BASE_COOLDOWN;}
 function respawnSeconds(points){return stats(points).respawnSeconds;}
 return Object.freeze({FAMILY_BASE,FAMILY_LABELS,RARITY_MULTIPLIER,RARITY_BASE,familyFor,biologicalStats,effectiveStats,MAX_PROGRESS,BASE_COOLDOWN,BASE_RESPAWN,MAX_COOLDOWN_REDUCTION,MAX_ATTRIBUTE_BONUS,MAX_RANGE_BONUS,MAX_RESPAWN_REDUCTION,progress,pointsForKill,stats,normalizeMap,addKill,pointsFor,passiveMultiplier,abilityRange,abilityCooldown,respawnSeconds});
});