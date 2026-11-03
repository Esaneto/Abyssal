'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('download control is outside the menu column and docked discreetly at the upper right', () => {
  const html = read('public/index.html');
  const css = read('public/style.css');
  const contentStart = html.indexOf('<div class="menu-content">');
  const download = html.indexOf('<button id="downloadBtn"');
  const contentEnd = html.indexOf('</div>', contentStart);
  assert.ok(contentStart >= 0 && download > contentStart);
  assert.match(html.slice(contentStart, download), /<\/div>\s*$/);
  assert.match(css, /#menuScreen \.download-cta\{[\s\S]*?top:12px;right:14px/);
  assert.match(css, /min-height:29px;height:29px/);
  assert.match(html, /style\.css\?v=\d+\.\d+\.\d+/);
});

test('menu monster has a frightening toothed grin and the chat is docked beneath its face', () => {
  const css = read('public/style.css');
  assert.match(css, /#menuScreen \.creature-core span\{[\s\S]*?display:block/);
  assert.match(css, /#menuScreen \.creature-core span:before/);
  assert.match(css, /#menuScreen \.creature-core span:after/);
  assert.match(css, /#menuScreen \.menu-creature\{[\s\S]*?top:45%/);
  assert.match(css, /#menuScreen \.global-chat-panel\{[\s\S]*?bottom:34px/);
  assert.match(css, /#menuScreen \.global-chat-panel\.chat-expanded\{display:flex/);
});

test('render work is capped to 60 FPS in combat and 30 FPS while idle', () => {
  const game = read('public/game.js');
  assert.match(game, /minFrameInterval=active\?1000\/60:1000\/30/);
  assert.match(game, /t-lastPaintAt<minFrameInterval-1/);
  assert.match(game, /lowPowerRendering=mobileViewport\|\|cores<=4/);
  assert.match(game, /Math\.min\(window\.devicePixelRatio\|\|1,lowPowerRendering\?1:1\.45\)/);
});

test('canvas rendering caches static gradients and removes repeated terrain and HUD work', () => {
  const game = read('public/game.js');
  const background = game.slice(game.indexOf('function drawBackground(t){'), game.indexOf('function drawCreature(', game.indexOf('function drawBackground(t){')));
  const terrain = game.slice(game.indexOf('function drawArenaTerrain(t){'), game.indexOf('function draw(t){'));
  assert.match(background, /if\(!backgroundGradientCache\)/);
  assert.match(background, /if\(!backgroundBloomCache\)/);
  assert.doesNotMatch(terrain, /createLinearGradient\(-rock\.r/);
  assert.match(game, /function setTextIfChanged\(/);
  assert.match(game, /PROFILE_TITLE_NAMES=Object\.freeze/);
  assert.match(game, /const enemyFrameNow=performance\.now\(\),localTarget=/);
});


test('combat updates only rebuild changed HUD sections and cache active-skill storage reads', () => {
  const game = read('public/game.js');
  assert.match(game, /function renderSoloEnergyRanking\(\)[\s\S]*?if\(value!==lastSoloRankingValue\)/);
  assert.match(game, /panel\.dataset\.skillsSignature===signature/);
  assert.match(game, /let equippedActiveSkillsCache=null/);
  assert.match(game, /function updateAbilityButtons\(force=false\)/);
  assert.match(game, /if\(!force&&now-lastAbilityUiAt<100\)return/);
  assert.match(game, /updateHud\(false\)/);
});

test('horde hot paths reuse collision buckets and movement results', () => {
  const game = read('public/game.js');
  const ai = read('public/enemy-ai.js');
  const simulation = read('world-simulation.js');
  assert.match(game, /enemyCollisionBuckets\[enemyCollisionBucketCount\]/);
  assert.match(game, /key=gy\*65536\+gx/);
  assert.match(ai, /reusableResult\s*=\s*null/);
  assert.match(simulation, /EnemyAI\.moveTowardTarget\(enemy,\s*targetablePlayers,\s*dt,\s*movementOptions,\s*movementResult\)/);
  assert.match(simulation, /resolvedContactTarget/);
});

test('runtime performance snapshot measures update, drawing, long tasks and entity counts', () => {
  const game = read('public/game.js');
  assert.match(game, /window\.AbyssalPerformance=\{snapshot:getAbyssalPerformanceSnapshot\}/);
  assert.match(game, /longTaskObserver\.observe\(\{type:'longtask',buffered:true\}\)/);
  assert.match(game, /lastUpdateMs/);
  assert.match(game, /lastDrawMs/);
  assert.match(game, /frameP95Ms/);
  assert.match(game, /heapUsedMb/);
});

test('menu title scales to narrow and short screens', () => {
  const css = read('public/style.css');
  assert.match(css, /#menuScreen h1\{[\s\S]*?font-size:clamp\(28px,min\(9\.5vw,6\.4vh\),58px\)/);
  assert.match(css, /@media\(max-width:420px\)[\s\S]*?#menuScreen h1/);
  assert.match(css, /@media\(max-height:560px\)[\s\S]*?#menuScreen h1/);
});


test('network cadence keeps PvP motion responsive without 60 Hz broadcast pressure', async () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const online = fs.readFileSync(path.join(__dirname, '..', 'public', 'online.js'), 'utf8');
  assert.match(server, /playerMotionIntervalMs=room\.mode==='pvp'\?40:75/);
  assert.match(online, /isPvp\?1000\/30:1000\/20/);
  assert.match(online, /interpDuration:isPvp\?58:105/);
});

test('electric eel rendering is deterministic per frame sample', async () => {
  const game = fs.readFileSync(path.join(__dirname, '..', 'public', 'game.js'), 'utf8');
  const eelStart=game.indexOf("} else if(id==='electriceel'){");
  const snakeStart=game.indexOf("} else if(id==='greensnake'){");
  assert.ok(eelStart>0&&snakeStart>eelStart);
  assert.doesNotMatch(game.slice(eelStart,snakeStart), /Math\.random/);
  assert.doesNotMatch(game, /sparkX = \(-1\.4 \+ k \* 0\.65\) \* r \+ rand/);
});
