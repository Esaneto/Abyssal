'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const A=require('../public/abyssal-sample-audio.js');
test('combat samples and attack shapes map to requested sounds',()=>{
 for(const id of ['player-hit','enemy-hit','specimen-hit'])assert.equal(A.cueAsset(id),'damage');
 for(const id of ['push','pulse','wildlife-push','wildlife-pulse','bio-shock','gulper-chomp'])assert.equal(A.abilityCue(id),'pulse');
 for(const id of ['shot','slowShot','wildlife-shot','wildlife-slowShot','pressure-lance'])assert.equal(A.abilityCue(id),'echo');
 assert.equal(A.abilityCue('shield'),null);
 for(const id of ['damage','pulse','echo','dash','cloud'])assert.ok(fs.existsSync('public/audio/'+A.ASSETS[id].file));
});
test('confirmed damage and shared casts have dedicated audio hooks',()=>{
 const game=fs.readFileSync('public/game.js','utf8'),sw=fs.readFileSync('public/offline-sw.js','utf8');
 assert.match(game,/enemy\.hp-=appliedDamage;playWorldSound\('enemy-hit'/);
 assert.match(game,/Number\(data\.damage\)>0&&Number\.isFinite\(hitPosition\.x\)/);
 assert.match(game,/\['hit','defeated'\]\.includes\(d\.reason\)/);
 assert.match(game,/if\(!onlineMode\)playCombatAbilitySound\(spec\.id/);
 assert.match(game,/playCombatAbilitySound\(active,\{x:px,y:py\}/);
 for(const file of ['dano.wav','pulsos.wav','investida.ogg','nuvem_toxica.wav','eco_da_mare.wav'])assert.ok(sw.includes('audio/effects/'+file));
});
