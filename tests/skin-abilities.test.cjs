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
  assert.equal(abilities.movementMultiplier('electriceel'),1);
  assert.equal(abilities.movementMultiplier('greensnake'),1);
  assert.equal(abilities.damageMultiplier('electriceel','common',500,1),1);
  assert.equal(abilities.damageMultiplier('greensnake','common',500,1),1);
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

test('predator skins trigger client events and have server-side validation', () => {
 const game=read('public/game.js'),server=read('server.js');
 assert.match(game, /\['reefshark','abysscroc','armoredgator'\]\.includes\(equippedSkin\)/);
 assert.match(game, /sendSkinAbility\(\{skin: equippedSkin/);
 for(const id of ['reefshark-dash','abysscroc-lunge','armoredgator-spin']) assert.match(server,new RegExp(id));
 for(const id of ['abysscroc-lunge','armoredgator-spin']) assert.match(game,new RegExp(id));
});
test('browser and server use the same skin ability module', () => {
  assert.equal(read('skin-abilities.js'),read('public/skin-abilities.js'));
  assert.match(read('server.js'),/require\('\.\/skin-abilities'\)/);
  assert.match(read('world-simulation.js'),/SkinAbilities\.magnetRangeMultiplier/);
  assert.match(read('world-simulation.js'),/SkinAbilities\.orbExperienceMultiplier/);
});


test('eel remains deterministic while emerald serpent keeps its original swimming identity', () => {
  const game=read('public/game.js');
  const eelStart=game.indexOf("} else if(id==='electriceel'){");
  const snakeStart=game.indexOf("} else if(id==='greensnake'){");
  const defaultStart=game.indexOf("} else if(id==='default'){");
  assert.ok(eelStart>0&&snakeStart>eelStart&&defaultStart>snakeStart);
  assert.doesNotMatch(game.slice(eelStart,snakeStart),/Math\\.random/);
  assert.ok(game.slice(snakeStart,defaultStart).includes('const segWave = Math.sin(t * 0.006) * 0.15;'));
  assert.match(game,/Veneno corrosivo: ataques envenenam criaturas atingidas/);
  assert.match(game,/Descarga Estática: ataques paralisam brevemente as criaturas atingidas/);
});


test('named premium skins retain reachable render branches', () => {
 const game=read('public/game.js');
 for(const id of ['bloodmoon','thorn','abyssaleye']){
  assert.match(game,new RegExp("else if\\\\(id==='"+id+"'\\\\)\\\\{(?!\\\\s*\\\\})"));
 }
 assert.equal((game.match(/else if\\(id==='aberration'\\|\\|id==='angler'\\|\\|id==='maw'\\|\\|id==='devourer'\\)\\{/g)||[]).length,1);
});

test('Photon Ray auto-targets nearest in-range target without mouse steering', () => {
 const game=read('public/game.js');
 const start=game.indexOf("if(upgrades.photonRay>0){"),end=game.indexOf("if(upgrades.nova>0)",start);
 const block=game.slice(start,end);
 assert.match(block,/d<=beamRange&&d<targetDistance/);
 assert.doesNotMatch(block,/mouseAimMode|updateMouseAimFromCursor|controlAimAngle/);
 assert.match(block,/Math\\.atan2/);
});

test('Kraken skin uses animated contact-damage tentacles', () => {
 const game=read('public/game.js'),ai=read('public/enemy-ai.js');
 assert.match(game,/touchesKrakenTentacle\\?\\.\\(krakenProxy,target,1\\)/);
 assert.match(game,/dealEnemyDamage\\(target,18,'kraken-contact'\\)/);
 assert.match(ai,/const length = 3\\.35 \\+ 0\\.32/);
});
