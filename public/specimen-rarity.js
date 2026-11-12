(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./skin-standard.js'):root.AbyssalSkinStandard);
 if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.AbyssalSpecimenRarity=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(standard){
 'use strict';
 const WEIGHTS=Object.freeze({common:40,uncommon:30,rare:15,epic:10,legendary:5});
 const LABELS=Object.freeze({common:'Comum',uncommon:'Incomum',rare:'Rara',epic:'Épica',legendary:'Lendária'});
 const TIER_FIXED=Object.freeze({brl199:'rare',brl499:'epic',brl999:'legendary',mission:'legendary',promo:'rare'});
 function hash(id){let h=2166136261;for(const ch of String(id||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
 function coinRarityFor(id){
  if(id==='default')return 'common';
  const n=hash(id)%100;
  return n<40?'common':n<70?'uncommon':n<85?'rare':n<95?'epic':'legendary';
 }
 function rarityFor(id){
  const key=String(id||'default'),tier=standard?.profile?.(key)?.tier;
  if(key==='electriceel')return 'legendary';
  return TIER_FIXED[tier]||coinRarityFor(key);
 }
 function roll(ids,rng=Math.random){
  const pools={common:[],uncommon:[],rare:[],epic:[],legendary:[]};
  for(const id of ids||[]){const tier=standard?.profile?.(id)?.tier;if(tier==='mission'||tier==='promo')continue;const rarity=rarityFor(id);if(rarity&&pools[rarity])pools[rarity].push(id);}
  const valid=Object.keys(WEIGHTS).filter(r=>pools[r].length);if(!valid.length)return null;
  const total=valid.reduce((sum,r)=>sum+WEIGHTS[r],0);let number=Math.min(.999999999,Math.max(0,Number(rng())||0))*total;
  for(const rarity of valid){number-=WEIGHTS[rarity];if(number<0){const pool=pools[rarity];return pool[Math.min(pool.length-1,Math.floor(Math.max(0,Math.min(.999999999,Number(rng())||0))*pool.length))];}}
  return pools[valid[valid.length-1]][0];
 }
 return Object.freeze({WEIGHTS,LABELS,rarityFor,coinRarityFor,roll});
});