'use strict';

const Standard=typeof module!=='undefined'&&module.exports?require('./skin-standard.js'):globalThis.AbyssalSkinStandard;
const BOSS_KINDS = new Set(['boss','angler','maw','leviathan','whiteSharkBoss','kraken','devourer','riftSmile']);
const CLOSE_RANGE = 170;
const LONG_RANGE = 260;
const mul=(id,attr)=>Standard?.passiveMultiplier?.(id,attr)||1;

function damageMultiplier(skinId,enemyKind){
 let out=mul(skinId,'damage');
 if(BOSS_KINDS.has(String(enemyKind||'')))out*=mul(skinId,'bossDamage');
 return out;
}
function incomingDamageMultiplier(skinId){return mul(skinId,'defense');}
function enemySpeedMultiplier(){return 1;}
function movementMultiplier(skinId){return mul(skinId,'movement');}
function targetRangeMultiplier(skinId){return mul(skinId,'range');}
function fireRateMultiplier(skinId){return mul(skinId,'fireRate');}
function orbExperienceMultiplier(skinId){return mul(skinId,'experience');}
function magnetRangeMultiplier(){return 1;}
function activeCooldownMultiplier(skinId){return mul(skinId,'activeCooldown')===1?1:1/(mul(skinId,'activeCooldown'));}
function activeSpec(skinId){return Standard?.activeSpec?.(skinId)||null;}
function profile(skinId){return Standard?.profile?.(skinId)||null;}

const api=Object.freeze({BOSS_KINDS,CLOSE_RANGE,LONG_RANGE,damageMultiplier,incomingDamageMultiplier,enemySpeedMultiplier,movementMultiplier,targetRangeMultiplier,fireRateMultiplier,orbExperienceMultiplier,magnetRangeMultiplier,activeCooldownMultiplier,activeSpec,profile});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof window!=='undefined')window.AbyssalSkinAbilities=api;
