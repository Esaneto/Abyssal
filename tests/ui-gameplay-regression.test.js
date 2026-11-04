'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('browser scripts parse before menu event handlers are wired', () => {
  assert.doesNotThrow(() => new vm.Script(read('public/game.js'), { filename: 'public/game.js' }));
  assert.doesNotThrow(() => new vm.Script(read('public/online.js'), { filename: 'public/online.js' }));
});

test('mobile gameplay retains a touch pause button when the top bar is hidden', () => {
  const html = read('public/index.html');
  const game = read('public/game.js');
  const css = read('public/style.css');
  const mobilePauseStyle = css.slice(css.indexOf('.mobile-pause-btn'), css.indexOf('@media(max-width:700px){body.game-active #mobilePauseBtn'));
  assert.match(html, /id="mobilePauseBtn"/);
  assert.match(game, /mobilePauseBtn[^\n]*addEventListener\('click',pauseGame\)/);
  assert.match(css, /@media\(max-width:700px\)\{body\.game-active #mobilePauseBtn\{display:grid\}/);
  assert.match(mobilePauseStyle, /right:max\(56px,calc\(env\(safe-area-inset-right\) \+ 56px\)\)/);
});

test('level-up choice uses the shared codex cache and cannot fail on an undefined codex variable', () => {
  const game = read('public/game.js');
  const start = game.indexOf('function chooseUpgrade(u){');
  const end = game.indexOf('function spawnEnemy(', start);
  assert.ok(start >= 0 && end > start, 'upgrade handlers are present');
  const handlers = game.slice(start, end);
  assert.match(handlers, /discoverCodexSkill\(u\.id\)/);
  assert.doesNotMatch(handlers, /codex\.skills/);
});

test('paid predator skins render species-specific great white, black caiman, and Nile crocodile silhouettes', () => {
  const game = read('public/game.js');
  const start = game.indexOf('function drawCreature(');
  const end = game.indexOf('\nfunction ', start + 1);
  const renderer = game.slice(start, end < 0 ? undefined : end);
  const white = renderer.slice(renderer.indexOf("id==='reefshark'"), renderer.indexOf("id==='hammerhead'"));
  const caiman = renderer.slice(renderer.indexOf("id==='abysscroc'"), renderer.indexOf("id==='armoredgator'"));
  const nile = renderer.slice(renderer.indexOf("id==='armoredgator'"), renderer.indexOf("id==='default'"));
  assert.match(white, /countershading/);
  assert.match(white, /crescent tail/);
  assert.match(caiman, /Black caiman/);
  assert.match(caiman, /rounded head/);
  assert.match(nile, /Nile crocodile/);
  assert.match(nile, /visible teeth/);
  assert.notEqual(caiman, nile, 'the two crocodilians must not share one silhouette branch');
});

test('level-up shows a 25-second countdown and picks a random option if time expires', () => {
  const game = read('public/game.js');
  const html = read('public/index.html');
  assert.match(html, /id="upgradeTimerText"/);
  assert.match(html, /id="upgradeTimerFill"/);
  assert.match(game, /upgradeDeadlineAt=performance\.now\(\)\+25000/);
  assert.match(game, /Math\.floor\(Math\.random\(\)\*available\.length\)/);
  assert.match(game, /clearUpgradeCountdown\(\)/);
});

test('co-op XP orbs visibly move toward the nearest player inside magnet range', () => {
  const sim = require('../world-simulation');
  const ai = require('../public/enemy-ai');
  const world = sim.createWorldState(10000);
  world.initialized = true;
  world.lastTick = 10000;
  world.nextBossAt = 100000;
  world.commonSpawnTimer = 100000;
  world.snapshotTimer = 100000;
  world.reliableSnapshotTimer = 100000;
  world.playerSnapshotTimer = 100000;
  const zoom = Number(ai.WORLD_ZOOM) || 1;
  const distance = 0.65 * 140 / zoom;
  const initialX = 500 + distance;
  world.orbs = [{ id: 1, x: initialX, y: 500, r: 4, value: 2, life: 25, phase: 0 }];
  const player = {
    id: 'magnet-test-player', x: 500, y: 500, r: 10 / zoom,
    alive: true, hp: 100, maxHp: 100, magnetStrength: 1,
    shieldCharges: 0, regenLevel: 0, invulnerableUntil: 0, regenAccumulator: 0
  };
  sim.tickWorld(world, [player], 10100, () => 0.5);
  assert.equal(world.orbs.length, 1, 'test orb should remain available rather than being collected immediately');
  assert.ok(world.orbs[0].x < initialX - 2, 'a distant orb should move noticeably toward the player in one server tick');
});

test('responsive screens avoid visible scrollbars and keep three skill cards in one row', () => {
  const css = read('public/style.css');
  assert.match(css, /\*::-webkit-scrollbar\{display:none!important/);
  assert.match(css, /#upgradeScreen \.upgrade-choices\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /grid-template-columns:minmax\(0,1\.08fr\) minmax\(250px,\.72fr\)/);
});


test('profile back button uses the shared modal close contract', () => {
  const html = read('public/index.html');
  assert.match(html, /id="profileCloseBtn"[^>]*data-close-screen="profileScreen"/);
});


test('closing the online lobby from a finished run restores an interactive main menu', () => {
  const game = read('public/game.js');
  assert.match(game, /function handleRoomsClosed\(\)\{onlineMode=false;if\(gameState==='menu'\)/);
  assert.match(game, /\$\('menuScreen'\)\.hidden=false/);
  assert.match(game, /abyssal-modal-closed[^\n]*handleRoomsClosed\(\)/);
});

test('desktop level-up UI is enlarged without changing the mobile breakpoint', () => {
  const css = read('public/style.css');
  const marker = css.indexOf('Desktop-only level-up readability');
  assert.ok(marker >= 0);
  const desktopRules = css.slice(marker);
  assert.match(desktopRules, /@media\(min-width:701px\)/);
  assert.match(desktopRules, /#upgradeScreen \.modal-card\{width:min\(1040px,94vw\)/);
  assert.match(desktopRules, /#upgradeScreen \.upgrade-card p\{font-size:13px/);
});


test('paid skin ownership survives session restoration and shop refreshes authoritative account', () => {
  const game = read('public/game.js');
  assert.doesNotMatch(game, /ownedSkins=ownedSkins\.filter\(id=>!premiumIds\.has\(id\)\)/);
  assert.match(game, /shopBtn[^\n]*refreshAccount/);
  assert.match(game, /if\(r\.account\)\{window\.dispatchEvent\(new CustomEvent\('abyssal-account-data'/);
  assert.match(game, /equipped\?\(english\?'EQUIPPED':'EQUIPADA'\):owned\?\(english\?'EQUIP':'EQUIPAR'\)/);
});


test('maintenance overlay cannot remain latched after transport reconnect', () => {
  const online = read('public/online.js');
  assert.match(online, /socket\.on\('connect',\(\)=>\{connected=true;everConnected=true;hideMaintenanceOverlay\(\)/);
  assert.match(online, /!sessionToken\)\{failReconnect\('Servidor reconectado/);
  assert.match(online, /if\(reconnectPending\)failReconnect\('Servidor reconectado, mas sua sessão precisa ser validada novamente\.'/);
});
