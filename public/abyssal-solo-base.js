/* Persistent Solo submarine and resonance research.
 * Uses the same Solo Energy earned from purple XP orbs.
 */
(function(root,factory){
 const api=factory(typeof localStorage==='undefined'?null:localStorage,root?.AbyssalSoloProgress);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.AbyssalSoloBase=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(storage,progress){
 'use strict';
 const KEY='abyssalSoloBaseV1';
 const STARTERS=Object.freeze(['photon','range','regen']);
 const SHOTS=Object.freeze(['electric','pierce','photon','photonRay','nova','echoShot']);
 const PASSIVES=Object.freeze(['burst','ricochet','spread']);
 const BUFFS=Object.freeze(['power','rate','speed','range','magnet','regen','shield','shell','ward','lastStand','pressureCocoon','vitality','predator','closePressure']);
 const COSTS=Object.freeze({shot:100,passive:80,buff:60,submarineShield:100});
 const POWER=Object.freeze({duration:300,light:20,weapon:10});
 const MAX_WEAPONS=3;
 function sanitize(raw){
  const unlocked=new Set(STARTERS);
  for(const id of raw?.unlocked||[])if(SHOTS.includes(id)||PASSIVES.includes(id)||BUFFS.includes(id))unlocked.add(id);
  const valid=ids=>[...new Set((Array.isArray(ids)?ids:[]).filter(id=>SHOTS.includes(id)))];
  const legacy=valid(Array.isArray(raw?.weapons)?raw.weapons:raw?.unlocked);
  const researched=valid(['photon',...legacy,...valid(raw?.researchedWeapons)]);
  const installed=raw?.weaponSlotsVersion===1?valid(raw.weapons).filter(id=>researched.includes(id)):valid(['photon',...legacy]);
  return {unlocked:[...unlocked],weapons:installed.slice(0,MAX_WEAPONS),researchedWeapons:researched,weaponSlotsVersion:1,submarineShield:Boolean(raw?.submarineShield)};
 }
 function create(store=storage,energy=progress){
  let state=sanitize(null);
  try{state=sanitize(JSON.parse(store?.getItem(KEY)||'null'));}catch(_){}
  const save=()=>{try{store?.setItem(KEY,JSON.stringify(state));}catch(_){}return get();};
  const get=()=>({unlocked:[...state.unlocked],weapons:[...state.weapons],researchedWeapons:[...state.researchedWeapons],weaponSlotsVersion:1,submarineShield:state.submarineShield});
  const category=id=>String(id).startsWith('weapon:')&&SHOTS.includes(String(id).slice(7))?'shot':SHOTS.includes(id)?'shot':PASSIVES.includes(id)?'passive':BUFFS.includes(id)?'buff':id==='submarineShield'?'submarineShield':null;
  const cost=id=>COSTS[category(id)]||0;
  const unlocked=id=>String(id).startsWith('weapon:')?state.researchedWeapons.includes(String(id).slice(7)):id==='submarineShield'?state.submarineShield:STARTERS.includes(id)||state.unlocked.includes(id);
  function research(id){
   if(unlocked(id))return {ok:false,reason:'owned',cost:0,...get()};
   const price=cost(id);if(!price)return {ok:false,reason:'unknown',cost:0,...get()};
   const wallet=energy?.get?.().energy||0;if(wallet<price)return {ok:false,reason:'energy',cost:price,...get()};
   const paid=energy.debit(price);if(!paid.ok)return {ok:false,reason:'energy',cost:price,...get()};
   if(String(id).startsWith('weapon:'))state.researchedWeapons.push(String(id).slice(7));else if(id==='submarineShield')state.submarineShield=true;else state.unlocked=[...new Set([...state.unlocked,id])];
   save();return {ok:true,cost:price,energy:energy.get().energy,...get()};
  }
  const unlockedShots=()=>SHOTS.filter(unlocked);
  const installedWeapons=()=>[...state.weapons];
  function installWeapon(id){if(!SHOTS.includes(id)||!state.researchedWeapons.includes(id))return {ok:false,reason:'research',...get()};if(state.weapons.includes(id))return {ok:false,reason:'installed',...get()};if(state.weapons.length>=MAX_WEAPONS)return {ok:false,reason:'full',...get()};state.weapons.push(id);return {ok:true,...save()};}
  function uninstallWeapon(id){if(!state.weapons.includes(id))return {ok:false,reason:'not-installed',...get()};state.weapons=state.weapons.filter(v=>v!==id);return {ok:true,...save()};}
  const fullPowerCost=()=>POWER.light+installedWeapons().length*POWER.weapon;
  function topUp(secondsRemaining=0){
   const missing=Math.max(0,POWER.duration-Math.max(0,Number(secondsRemaining)||0));if(missing<=.01)return {ok:false,reason:'full',secondsAdded:0,cost:0,remaining:POWER.duration};
   const full=fullPowerCost(),needed=Math.max(1,Math.ceil(full*missing/POWER.duration)),wallet=Math.max(0,Number(energy?.get?.().energy)||0);
   if(wallet<=0)return {ok:false,reason:'energy',secondsAdded:0,cost:needed,remaining:secondsRemaining};
   const spend=Math.min(needed,wallet),paid=energy.debit(spend),secondsAdded=POWER.duration*(paid.spent/full);
   return {ok:paid.spent>0,cost:paid.spent,secondsAdded,remaining:Math.min(POWER.duration,Math.max(0,Number(secondsRemaining)||0)+secondsAdded),fullCost:full,energy:energy.get().energy};
  }
  return Object.freeze({KEY,STARTERS,SHOTS,PASSIVES,BUFFS,COSTS,POWER,MAX_WEAPONS,get,category,cost,unlocked,research,unlockedShots,installedWeapons,installWeapon,uninstallWeapon,fullPowerCost,topUp,create});
 }
 return create();
});