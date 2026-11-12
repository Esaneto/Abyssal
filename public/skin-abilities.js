'use strict';

const Standard=typeof module!=='undefined'&&module.exports?require('./skin-standard.js'):globalThis.AbyssalSkinStandard;
const Specimens=typeof module!=='undefined'&&module.exports?require('./specimen-system.js'):globalThis.AbyssalSpecimenSystem;
const BOSS_KINDS = new Set(['boss','angler','maw','leviathan','whiteSharkBoss','kraken','devourer','riftSmile']);
const CLOSE_RANGE = 170;
const LONG_RANGE = 260;
const mul=(id,attr,points=0,alive=true)=>{
 const profile=Standard?.profile?.(id);
 if(!profile||profile.attribute!==attr||alive===false)return 1;
 return Specimens?.passiveMultiplier?.(profile,points,true)??Standard?.passiveMultiplier?.(id,attr)??1;
};

function damageMultiplier(skinId,enemyKind,_distance,_hpRatio,points=0,alive=true){
 let out=mul(skinId,'damage',points,alive);
 if(BOSS_KINDS.has(String(enemyKind||'')))out*=mul(skinId,'bossDamage',points,alive);
 return out;
}
function incomingDamageMultiplier(skinId,points=0,alive=true){return mul(skinId,'defense',points,alive);}
function enemySpeedMultiplier(){return 1;}
function movementMultiplier(skinId,points=0,alive=true){return mul(skinId,'movement',points,alive);}
function targetRangeMultiplier(skinId,points=0,alive=true){return mul(skinId,'range',points,alive);}
function fireRateMultiplier(skinId,points=0,alive=true){return mul(skinId,'fireRate',points,alive);}
function orbExperienceMultiplier(skinId,points=0,alive=true){return 1;}
function endDiveEnergyBonus(skinId){const p=Standard?.profile?.(skinId);return p?.attribute==='energy'?Math.max(0,Number(p.percent)||0)/100:0;}
function magnetRangeMultiplier(){return 1;}
function activeCooldownMultiplier(skinId,points=0,alive=true){return mul(skinId,'activeCooldown',points,alive)===1?1:1/(mul(skinId,'activeCooldown',points,alive));}
function activeSpec(skinId){return Standard?.activeSpec?.(skinId)||null;}
function profile(skinId){return Standard?.profile?.(skinId)||null;}

const api=Object.freeze({BOSS_KINDS,CLOSE_RANGE,LONG_RANGE,damageMultiplier,incomingDamageMultiplier,enemySpeedMultiplier,movementMultiplier,targetRangeMultiplier,fireRateMultiplier,orbExperienceMultiplier,endDiveEnergyBonus,magnetRangeMultiplier,activeCooldownMultiplier,activeSpec,profile});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof window!=='undefined')window.AbyssalSkinAbilities=api;
