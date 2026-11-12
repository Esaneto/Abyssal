(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.AbyssalShopEconomy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MODEL=Object.freeze({seconds:600,shotDamage:11,fireInterval:.52,hitRate:.82,expectedLevel:10,expectedBosses:1,bossCoins:100});
 const PRICE_BY_RARITY=Object.freeze({common:2500,uncommon:5000});
 function estimateTenMinuteCoins(){
  const score=MODEL.shotDamage*(MODEL.seconds/MODEL.fireInterval)*MODEL.hitRate;
  const completion=Math.max(5,Math.floor(score/35)+MODEL.expectedLevel*2);
  const bossCoins=MODEL.expectedBosses*MODEL.bossCoins;
  return Object.freeze({score:Math.floor(score),completion,totalOffline:completion,bossCoins,totalOnline:completion+bossCoins});
 }
 function priceForRarity(rarity){return PRICE_BY_RARITY[String(rarity||'common')]||0;}
 return Object.freeze({MODEL,PRICE_BY_RARITY,estimateTenMinuteCoins,priceForRarity});
});