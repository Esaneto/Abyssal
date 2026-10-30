'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('level-up choice uses the shared codex cache and cannot fail on an undefined codex variable', () => {
  const game = read('public/game.js');
  const start = game.indexOf('function chooseUpgrade(u){');
  const end = game.indexOf('function spawnEnemy(', start);
  assert.ok(start >= 0 && end > start, 'upgrade handlers are present');
  const handlers = game.slice(start, end);
  assert.match(handlers, /discoverCodexSkill\(u\.id\)/);
  assert.doesNotMatch(handlers, /codex\.skills/);
});

test('level-up shows a 25-second countdown and picks a random option if time expires', () => {
  const game = read('public/game.js');
  const html = read('public/index.html');
  assert.match(html, /id="upgradeTimerText"/);
  assert.match(html, /id="upgradeTimerFill"/);
  assert.match(game, /upgradeDeadlineAt=performance\.now\(\)\+10000/);
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
