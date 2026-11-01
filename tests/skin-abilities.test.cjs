'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const abilities = require('../skin-abilities');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('skin damage passives are deterministic and preserve boss/range conditions', () => {
  assert.equal(abilities.damageMultiplier('toxic','common',500,1),1.12);
  assert.equal(abilities.damageMultiplier('leviathan','kraken',500,1),1.25);
  assert.equal(abilities.damageMultiplier('leviathan','common',500,1),1);
  assert.equal(abilities.damageMultiplier('thorn','common',100,1),1.24);
  assert.equal(abilities.damageMultiplier('thorn','common',220,1),1);
  assert.equal(abilities.damageMultiplier('bloodmoon','common',500,.35),1.3);
  assert.equal(abilities.damageMultiplier('angler','common',300,1),1.1);
  assert.equal(abilities.damageMultiplier('maw','common',100,1),1.12);
});

test('passive movement, defense, targeting, XP and magnet bonuses are centralized', () => {
  assert.equal(abilities.incomingDamageMultiplier('deepwarden'),.82);
  assert.equal(abilities.incomingDamageMultiplier('abysscroc'),.85);
  assert.equal(abilities.enemySpeedMultiplier('glacier',200),.74);
  assert.equal(abilities.enemySpeedMultiplier('glacier',300),1);
  assert.equal(abilities.movementMultiplier('voidwing'),1.18);
  assert.equal(abilities.targetRangeMultiplier('abyssaleye'),1.2);
  assert.equal(abilities.fireRateMultiplier('solar'),1.18);
  assert.equal(abilities.orbExperienceMultiplier('default'),1.12);
  assert.equal(abilities.orbExperienceMultiplier('royal'),1.25);
  assert.equal(abilities.magnetRangeMultiplier('hammerhead'),1.5);
});

test('Violet resonance has client trigger and server-authoritative cooldown/range/target limits', () => {
  const game=read('public/game.js'), server=read('server.js'), html=read('public/index.html');
  assert.match(game,/violet-resonance/);
  assert.match(game,/player\.violetCooldown=10/);
  assert.match(server,/player\.skinId!=='violet'/);
  assert.match(server,/violetResonanceReadyAt=now\+10000/);
  assert.match(server,/violetResonanceTargetIds\.size>=4/);
  assert.match(html,/skin-abilities\.js/);
});

test('predator abilities have client triggers and server-side validation', () => {
 const game=read('public/game.js'),server=read('server.js');
 for(const id of ['reefshark-dash','abysscroc-lunge','armoredgator-spin']){assert.match(game,new RegExp(id));assert.match(server,new RegExp(id));}
});
test('browser and server use the same skin ability module', () => {
  assert.equal(read('skin-abilities.js'),read('public/skin-abilities.js'));
  assert.match(read('server.js'),/require\('\.\/skin-abilities'\)/);
  assert.match(read('world-simulation.js'),/SkinAbilities\.magnetRangeMultiplier/);
  assert.match(read('world-simulation.js'),/SkinAbilities\.orbExperienceMultiplier/);
});
