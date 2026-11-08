'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('player is rendered as diver with a separate following specimen',()=>{
 const game=read('public/game.js');
 assert.match(game,/function drawDiver\(/);
 assert.match(game,/player\.specimen=\{/);
 assert.match(game,/drawDiver\(player\.x,player\.y/);
 assert.match(game,/drawCreature\(player\.specimen\.x,player\.specimen\.y/);
 assert.match(game,/updateSpecimenRuntime\(dt\)/);
});

test('specimen has independent hitbox death respawn and disables active ability',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.match(game,/function hurtSpecimenSolo\(/);
 assert.match(game,/function updateSoloSpecimenContact\(/);
 assert.match(game,/if\(!player\|\|gameState!=='playing'\|\|!specimenAlive\(\)\)return false/);
 assert.match(server,/specimenHp:55/);
 assert.match(server,/specimenAlive:true/);
 assert.match(server,/player\.specimenAlive=false/);
 assert.match(server,/SpecimenSystem\.stats\(Number\(player\?\.specimenPoints\)/);
 assert.match(server,/if\(player\.specimenAlive===false\)return ack\(false,'specimen-defeated'\)/);
});

test('specimen abilities originate at specimen and option two is manually aimed',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.match(game,/function specimenOrigin\(/);
 assert.match(game,/function specimenAbilityAngle\(/);
 assert.match(game,/isPcMouseAimMode\(\).*controlSettings\.mobile==='dual-stick'/s);
 assert.match(game,/const origin=specimenOrigin\(\)/);
 assert.match(server,/const specimenPos=specimenPositionFor\(player\),originX=specimenPos\.x,originY=specimenPos\.y/);
});

test('catalog previews show diver and specimen together',()=>{
 const game=read('public/game.js');
 assert.match(game,/if\(kind==='player'&&skin\)/);
 assert.match(game,/shop-specimen:/);
 assert.match(game,/CATÁLOGO DE<br><em>ESPÉCIMES<\/em>/);
});

test('profile exposes adaptation bar and ocean menu uses navigable portals',()=>{
 const html=read('public/index.html'),css=read('public/style.css'),menu=read('public/abyssal-menu-ocean.js');
 for(const id of ['profileSpecimenCanvas','profileAdaptationFill','profileAdaptationPoints','profileAdaptCooldown','profileAdaptAttribute','profileAdaptRange','profileAdaptRespawn'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('id="riftPortalBtn"'));
 assert.match(read('public/abyssal-menu-v2.css'),/#menuScreen\.ocean-menu-v2 #riftPortalBtn/);
 assert.match(menu,/keyMap=\{w:'up'/);
 assert.match(menu,/stage\.addEventListener\('pointerdown'/);
 assert.match(read('public/abyssal-rebuild.js'),/window\.AbyssalPreferredRoomMode='rift'/);
 assert.doesNotMatch(html,/abyss-orbit-navigation|menu-fauna|menu-secondary-actions/);
});
