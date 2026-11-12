'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const AI=require('../public/enemy-ai.js');

test('shark vision is half as wide and shark/predator biology is strengthened',()=>{
 assert.equal(AI.SHARK_VISION.halfAngle,0.275);
 assert.equal(AI.ENEMY_STATS.whiteShark.hp,2400);
 assert.equal(AI.ENEMY_STATS.whiteShark.damage,30);
 assert.ok(AI.ENEMY_STATS.lurker.hp>=115);
 assert.ok(AI.ENEMY_STATS.whiteSharkBoss.hp>=13200);
});

test('solo and open sea unlit regions are darker',()=>{
 const solo=read('public/abyssal-solo-cavern.js'),sea=read('public/abyssal-open-sea-lighting.js');
 assert.match(solo,/rgba\(0,5,9,\.74\)/);
 assert.match(sea,/lamp\.darkness\*\.20/);
 assert.match(sea,/const dark=\.28\*/);
});

test('cockpit is the only visible main menu and utility buttons inherit shop/codex themes',()=>{
 const html=read('public/index.html'),runtime=read('public/abyssal-exploration-runtime.js'),css=read('public/abyssal-submarine-laboratory.css');
 assert.match(html,/id="menuScreen"[^>]*style="visibility:hidden"/);
 assert.match(css,/body:not\(\.game-active\) #menuScreen\{visibility:hidden!important/);
 assert.match(css,/#submarineWorkshop #submarineWorkshopClose\{display:none!important/);
 assert.match(runtime,/abyss-shop-action/);assert.match(runtime,/abyss-codex-action/);
 assert.match(css,/\.abyss-shop-action/);assert.match(css,/\.abyss-codex-action/);
});

test('solo shark collision recovery probes free space instead of remaining stuck',()=>{
 const game=read('public/game.js');
 assert.match(game,/offsets=\[-\.95,\.95,-1\.45,1\.45,Math\.PI\]/);
 assert.match(game,/SOLO_CAVERN\.rayDistance\(arenaRocks,e\.x,e\.y/);
 assert.match(game,/e\.sharkAlertUntil=0/);
});

test('shop and Abyssario prioritize purchased, then discovered, then unknown specimens',()=>{
 const game=read('public/game.js');
 assert.match(game,/ownedSkins\.includes\(skin\.id\)\?0:\(skin\.id==='default'\|\|discoveredSpecimens\.has\(skin\.id\)\?1:2\)/);
 assert.match(game,/const journalSkins=\[\.\.\.skinData\]\.sort/);
 assert.match(game,/const known=skin\.id==='default'\|\|ownedSkins\.includes\(skin\.id\)\|\|discoveredSpecimens\.has\(skin\.id\)/);
});

test('boss progression remains seven bosses per cycle with rewards at first and final milestones',()=>{
 const game=read('public/game.js'),server=read('server.js');
 assert.match(game,/PROGRESSION_CYCLE_BOSS_SEQUENCE = \['boss', 'angler', 'maw', 'leviathan', 'whiteSharkBoss', 'kraken', 'devourer'\]/);
 assert.match(game,/PROGRESSION_MAX_CYCLES = 5/);
 assert.match(server,/bossesKilled\)>=7&&grantFirstProgressionReward/);
 assert.match(server,/bossesKilled\)>=42&&grantFinalConquest/);
 assert.match(server,/u\.coins=\(Number\(u\.coins\)\|\|0\)\+100/);
});
