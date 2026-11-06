'use strict';
const {randomInt,randomUUID}=require('node:crypto');
const curated=require('./public/abyssal-curated-skins');
const COIN_SKINS=Object.freeze(['solar','toxic','thorn','abyssking','royal','glacier','coral','bloodmoon','voidwing','abyssaleye','deepwarden',...curated.items.filter(s=>!s.paid&&s.price>0).map(s=>s.id)]);
const COINS=Object.freeze([300,500,700,900,1000,1200]);
const SKIN_CHANCE=3; // 3%, versus 97% divided equally between six coin outcomes.
const FINAL_SKIN='riftSmileRelic';
function grant(account,key,options={}){
 account.riftChests ||= [];
 let chest=account.riftChests.find(c=>c.key===key);
 if(!chest){chest={id:randomUUID(),key,createdAt:Date.now(),reward:null,final:Boolean(options.final)};account.riftChests.push(chest);}
 return chest;
}
function open(account,id,rng=randomInt){
 const chest=account.riftChests?.find(c=>c.id===id);if(!chest)return {ok:false,message:'Baú não encontrado.'};
 if(chest.reward)return {ok:true,duplicate:true,reward:chest.reward};
 const available=COIN_SKINS.filter(id=>!(account.ownedSkins||['default']).includes(id));
 let reward;
 if(chest.final){
   // Final chests always award exactly 100,000 coins and a skin item, never a coin-only roll.
   const pool=available.length?available:[FINAL_SKIN];
   const skin=pool[rng(pool.length)];
   const duplicate=(account.ownedSkins||[]).includes(skin);
   account.ownedSkins=[...new Set([...(account.ownedSkins||['default']),skin])];
   account.coins=(Number(account.coins)||0)+100000;
   reward={type:'final',amount:100000,skinId:skin,duplicate};
 }else if(rng(100)<SKIN_CHANCE&&available.length){const skin=available[rng(available.length)];account.ownedSkins=[...(account.ownedSkins||['default']),skin];reward={type:'skin',id:skin};}
 else {const amount=COINS[rng(COINS.length)];account.coins=(account.coins||0)+amount;reward={type:'coins',amount};}
 chest.reward=reward;chest.openedAt=Date.now();return {ok:true,reward};
}
module.exports={COIN_SKINS,COINS,SKIN_CHANCE,FINAL_SKIN,grant,open};
