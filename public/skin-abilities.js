'use strict';

// Regras passivas de skins: funções puras compartilhadas entre cliente e servidor.
// Balance baseline v2: one signature trait per skin, with no dominant
// combination of +damage, +movement and large mitigation. This pure module
// remains identical on the client and authoritative Node server.
// Distâncias são recebidas em unidades do mundo; não dependem de Canvas ou Socket.IO.
const BOSS_KINDS = new Set(['boss','angler','maw','leviathan','whiteSharkBoss','kraken','devourer','riftSmile']);
const curated=typeof module!=='undefined'&&module.exports?require('./abyssal-curated-skins.js'):globalThis.AbyssalCuratedSkins;
const trait=(id,stat)=>curated?.byId?.[id]?.bonuses?.[stat]??(curated?.byId?.[id]?.stat===stat?curated.byId[id].multiplier:1);
const CLOSE_RANGE = 170;
const LONG_RANGE = 260;

function damageMultiplier(skinId, enemyKind, distance, hpRatio) {
  let multiplier = trait(skinId,'damage');
  if(skinId==='saltcroc'&&Number(distance)<=CLOSE_RANGE)multiplier*=1.24;
  if(skinId==='saltcroc'&&BOSS_KINDS.has(String(enemyKind)))multiplier*=1.12;
  const boss = BOSS_KINDS.has(String(enemyKind || ''));
  const d = Number.isFinite(Number(distance)) ? Number(distance) : Infinity;
  if (skinId === 'reefshark' && !boss) multiplier *= 1.08;
  if (skinId === 'leviathan' && boss) multiplier *= 1.20;
  if (skinId === 'thorn' && d <= CLOSE_RANGE) multiplier *= 1.16;
  if (skinId === 'bloodmoon' && Number(hpRatio) <= 0.35) multiplier *= 1.20;
  if (skinId === 'maw' && d <= CLOSE_RANGE) multiplier *= 1.16;
  if (skinId === 'devourer' && boss) multiplier *= 1.12;
  if (skinId === 'riftSmileRelic' && boss) multiplier *= 1.10;
  // Damage-over-time and paralysis do not affect other players directly.
  // These small PvP alternatives keep their skins viable without crowd-control lockout.
  if (enemyKind === 'player' && skinId === 'greensnake') multiplier *= 1.06;
  if (enemyKind === 'player' && skinId === 'electriceel') multiplier *= 1.05;
  return multiplier;
}

function incomingDamageMultiplier(skinId) {
  if(trait(skinId,'defense')!==1)return trait(skinId,'defense');
  if (skinId === 'blackcaiman') return 0.85;
  if (skinId === 'deepwarden') return 0.86;
  if (skinId === 'abysscroc') return 0.90;
  if (skinId === 'leviathan') return 0.95;
  if (skinId === 'maw') return 0.96;
  if (skinId === 'kraken') return 0.94;
  return 1;
}
function enemySpeedMultiplier(skinId, distance) {
  return skinId === 'glacier' && Number(distance) <= 240 ? 0.84 : 1;
}
function movementMultiplier(skinId) { if(trait(skinId,'movement')!==1)return trait(skinId,'movement'); if(skinId==='blackcaiman')return 1.10; return skinId === 'voidwing' ? 1.12 : 1; }
function targetRangeMultiplier(skinId) { if(trait(skinId,'range')!==1)return trait(skinId,'range'); return skinId === 'abyssaleye' ? 1.15 : 1; }
function fireRateMultiplier(skinId) { if(trait(skinId,'fireRate')!==1)return trait(skinId,'fireRate'); return skinId === 'solar' ? 1.12 : 1; }
function orbExperienceMultiplier(skinId) {
 // Older magnet/attraction traits now reward direct XP, since XP orbs no
 // longer exist. Convert a former +30% attraction into +15% personal XP.
 const experience=trait(skinId,'experience')!==1?trait(skinId,'experience'):skinId==='default'?1.12:skinId==='royal'?1.18:1;
 const attraction=trait(skinId,'magnet')!==1?trait(skinId,'magnet'):skinId==='hammerhead'?1.30:skinId==='devourer'?1.25:1;
 return experience*(1+Math.max(0,attraction-1)*.5);
}
function magnetRangeMultiplier(skinId) { if(trait(skinId,'magnet')!==1)return trait(skinId,'magnet'); return skinId === 'hammerhead' ? 1.30 : skinId === 'devourer' ? 1.25 : 1; }

const api = Object.freeze({ BOSS_KINDS, CLOSE_RANGE, LONG_RANGE, damageMultiplier, incomingDamageMultiplier, enemySpeedMultiplier, movementMultiplier, targetRangeMultiplier, fireRateMultiplier, orbExperienceMultiplier, magnetRangeMultiplier });
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.AbyssalSkinAbilities = api;
