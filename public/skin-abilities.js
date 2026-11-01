'use strict';

// Regras passivas de skins: funções puras compartilhadas entre cliente e servidor.
// Distâncias são recebidas em unidades do mundo; não dependem de Canvas ou Socket.IO.
const BOSS_KINDS = new Set(['boss','angler','maw','leviathan','kraken','devourer']);
const CLOSE_RANGE = 150; // reduzido para balanceamento
const LONG_RANGE = 280; // aumentado para habilidades de longo alcance
const LONG_RANGE = 260;

function damageMultiplier(skinId, enemyKind, distance, hpRatio) {
  let multiplier = 1;
  const boss = BOSS_KINDS.has(String(enemyKind || ''));
  const d = Number.isFinite(Number(distance)) ? Number(distance) : Infinity;
  if (skinId === 'toxic') multiplier *= 1.12;
  if (skinId === 'reefshark' && !boss) multiplier *= 1.15;
  if (skinId === 'leviathan' && boss) multiplier *= 1.25;
  if (skinId === 'thorn' && d <= CLOSE_RANGE) multiplier *= 1.24;
  if (skinId === 'bloodmoon' && Number(hpRatio) <= 0.35) multiplier *= 1.30;
  if (skinId === 'angler' && d >= LONG_RANGE) multiplier *= 1.10;
  if (skinId === 'maw' && d <= CLOSE_RANGE) multiplier *= 1.12;
  return multiplier;
}

function incomingDamageMultiplier(skinId) {
  if (skinId === 'deepwarden') return 0.82;
  if (skinId === 'abysscroc') return 0.85;
  return 1;
}
function enemySpeedMultiplier(skinId, distance) {
  return skinId === 'glacier' && Number(distance) <= 240 ? 0.74 : 1;
}
function movementMultiplier(skinId) { return skinId === 'voidwing' ? 1.18 : 1; }
function targetRangeMultiplier(skinId) { return skinId === 'abyssaleye' ? 1.20 : 1; }
function fireRateMultiplier(skinId) { return skinId === 'solar' ? 1.18 : 1; }
function orbExperienceMultiplier(skinId) { return skinId === 'default' ? 1.12 : skinId === 'royal' ? 1.25 : 1; }
function magnetRangeMultiplier(skinId) { return skinId === 'hammerhead' ? 1.5 : 1; }

const api = Object.freeze({ BOSS_KINDS, CLOSE_RANGE, LONG_RANGE, damageMultiplier, incomingDamageMultiplier, enemySpeedMultiplier, movementMultiplier, targetRangeMultiplier, fireRateMultiplier, orbExperienceMultiplier, magnetRangeMultiplier });
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.AbyssalSkinAbilities = api;
