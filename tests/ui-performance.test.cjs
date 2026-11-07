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

test('menu monster keeps its frightening toothed grin after public chat removal', () => {
  const css = read('public/style.css');
  assert.match(css, /#menuScreen \.creature-core span\{[\s\S]*?display:block/);
  assert.match(css, /#menuScreen \.creature-core span:before/);
  assert.match(css, /#menuScreen \.creature-core span:after/);
  assert.match(css, /#menuScreen \.menu-creature\{[\s\S]*?top:45%/);
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
  assert.match(simulation, /const movementNavigationTargets=\[movementNavigationProxy\]/);
  assert.match(simulation, /EnemyAI\.moveTowardTarget\(enemy,\s*movementTargets,\s*dt,\s*movementOptions,\s*movementResult\)/);
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
  assert.match(server, /playerMotionIntervalMs=1000\/30/);
  assert.match(online, /now-lastPositionAt<1000\/30/);
  assert.match(online, /interpDuration:Math\.max\(16,Math\.min\(40,sampleMs\*\.8\)\)/);
});

test('electric eel rendering is deterministic per frame sample', async () => {
  const game = fs.readFileSync(path.join(__dirname, '..', 'public', 'game.js'), 'utf8');
  const eelStart=game.indexOf("} else if(id==='electriceel'){");
  const snakeStart=game.indexOf("} else if(id==='greensnake'){");
  assert.ok(eelStart>0&&snakeStart>eelStart);
  assert.doesNotMatch(game.slice(eelStart,snakeStart), /Math\.random/);
  assert.doesNotMatch(game, /sparkX = \(-1\.4 \+ k \* 0\.65\) \* r \+ rand/);
});


test('multiplayer hot-path avoids repeated full-array work under horde pressure', () => {
  const game = read('public/game.js');
  assert.match(game, /const defeatedIds=new Set\(\)/);
  assert.match(game, /if\(defeatedIds\.size\)enemies=enemies\.filter/);
  assert.match(game, /lastMusicIntensitySampleAt<200/);
  assert.match(game, /collectEnemyCandidatesNear\(bubble\.x,bubble\.y/);
});

test('monster death does not rebuild hidden account screens or retain animation state', () => {
  const game = read('public/game.js');
  const online = read('public/online.js');
  const server = read('server.js');
  const purchaseHandlerAt = game.indexOf("window.addEventListener('abyssal-purchase-result'");
  const accountHandlerAt = game.lastIndexOf("window.addEventListener('abyssal-account-data'", purchaseHandlerAt);
  const accountHandler = game.slice(accountHandlerAt, purchaseHandlerAt);
  assert.match(accountHandler, /shopScreen&&!shopScreen\.hidden\)renderShop\(\)/);
  assert.doesNotMatch(accountHandler, /saveCosmeticsLocalOnly\(\);\s*renderShop\(\)/);
  assert.match(online, /socket\.on\('title-progress'/);
  assert.match(online, /profileScreen'\)\&&!\$\('profileScreen'\)\.hidden\)renderProfile/);
  assert.doesNotMatch(server, /else socket\.emit\('account-data',publicUser\(killer\)\)/);
  // Single kills share one small title update per short window; boss kills flush immediately.
  assert.match(server, /else sendKillTitleProgress\(socket,boss\)/);
  assert.match(server, /const pendingKillTitleProgress=new WeakMap\(\)/);
  assert.match(server, /const timer=setTimeout\(emit,350\)/);
  assert.match(server, /if\(immediate\)\{emit\(\);return;\}/);
  assert.match(server, /sendKillTitleProgress\(socket,batch\.defeated\.some\(enemy=>enemy\.boss\)\)/);
  assert.match(game, /aquaticMotionTracker\?\.forget\?\.\(e\.id\)/);
  assert.match(game, /aquaticMotionTracker\?\.forget\?\.\(id\)/);
});

test('service worker respects game script revisions but keeps an offline fallback', () => {
  const sw = read('public/offline-sw.js');
  const html = read('public/index.html');
  assert.match(sw, /const versionedAsset = inShell && !isNavigation && url\.searchParams\.has\('v'\)/);
  assert.match(sw, /cachePath \+ \(versionedAsset \? url\.search : ''\)/);
  assert.match(sw, /const cached = await cache\.match\(cacheRequest\)/);
  assert.match(sw, /if \(offlineFallback\) return offlineFallback/);
  assert.doesNotMatch(sw, /cache\.match\(cacheRequest, \{ ignoreSearch: true \}\)/);
  assert.match(html, /game\.js\?v=2026\.11\.7\.\d+/);
});

test('single enemy death does not allocate another enemy-array copy', () => {
  const game = read('public/game.js');
  const single = game.slice(game.indexOf("window.addEventListener('abyssal-world-defeated'"), game.indexOf("window.addEventListener('abyssal-world-defeated-batch'"));
  const batch = game.slice(game.indexOf("window.addEventListener('abyssal-world-defeated-batch'"), game.indexOf("function renderShop()", game.indexOf("window.addEventListener('abyssal-world-defeated-batch'")));
  assert.match(single, /const deadIndex=enemies\.findIndex\(/);
  assert.match(single, /if\(deadIndex>=0\)enemies\.splice\(deadIndex,1\)/);
  assert.doesNotMatch(single, /enemies=enemies\.filter\(/);
  assert.match(batch, /if\(defeatedIds\.size\)enemies=enemies\.filter/);
});
