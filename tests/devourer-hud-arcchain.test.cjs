'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Devourer is a 15,000 HP boss and is slower than the Kraken', () => {
  const ai = require('../public/enemy-ai');
  assert.ok(ai.BOSS_KINDS.includes('devourer'));
  assert.equal(ai.ENEMY_STATS.devourer.hp, 15000);
  assert.ok(ai.ENEMY_STATS.devourer.speed < ai.ENEMY_STATS.kraken.speed);
});

test('Devourer suction pulls from range and weakens as a target approaches its mouth', () => {
  const ai = require('../public/enemy-ai');
  const boss = { kind: 'devourer', x: 0, y: 0, suctionActive: true };
  const edge = ai.suctionPullDelta({ x: 1540, y: 0 }, boss, 0.1);
  const far = ai.suctionPullDelta({ x: 600, y: 0 }, boss, 0.1);
  const near = ai.suctionPullDelta({ x: 300, y: 0 }, boss, 0.1);
  const safe = ai.suctionPullDelta({ x: 170, y: 0 }, boss, 0.1);
  assert.ok(edge.dx < -55, 'the doubled outer field pulls faster than a player can normally swim');
  assert.ok(far.dx < 0, 'the force points toward the boss');
  assert.ok(Math.abs(near.dx) < Math.abs(far.dx), 'pull strength decreases near the mouth');
  assert.deepEqual(safe, { dx: 0, dy: 0, strength: 0 }, 'the inner safe zone allows escape');
  const source = read('public/enemy-ai.js');
  assert.match(source, /Number\(options\.range\) \|\| 1240 \/ WORLD_ZOOM/);
  assert.match(source, /Number\(options\.maxSpeed\) \|\| 520 \/ WORLD_ZOOM/);
});

test('authoritative co-op simulation activates suction and reports player displacement', () => {
  const ai = require('../public/enemy-ai');
  const simulation = require('../world-simulation');
  const now = 100000;
  const world = simulation.createWorldState(now);
  world.initialized = true;
  world.lastTick = now - 50;
  world.elapsed = 0;
  world.nextBossAt = 1000;
  world.commonSpawnTimer = 100;
  world.snapshotTimer = 10;
  world.reliableSnapshotTimer = 10;
  world.playerSnapshotTimer = 10;
  const boss = {
    id: 1, kind: 'devourer', x: 500, y: 600, r: ai.ENEMY_STATS.devourer.r,
    hp: 15000, maxHp: 15000, speed: ai.ENEMY_STATS.devourer.speed / ai.WORLD_ZOOM,
    damage: 42, color: '#39d8c4', value: 260, phase: 0, angle: 0,
    hit: 0, attackCd: 100, suctionActive: false, suctionTimer: 0,
    suctionCooldown: 0, suctionPulse: 0
  };
  world.enemies = [boss, {
    id: 2, kind: 'drifter', x: 600, y: 900, r: 10, hp: 22, maxHp: 22,
    speed: 51 / ai.WORLD_ZOOM, damage: 8, color: '#ff769d', value: 1,
    phase: 0, angle: 0, hit: 0, attackCd: 100
  }];
  const player = {
    id: 'player-1', x: 1000, y: 600, r: 13 / ai.WORLD_ZOOM,
    moveSpeed: 150 / ai.WORLD_ZOOM, alive: true, hp: 100, maxHp: 100,
    shieldCharges: 0, regenLevel: 0, magnetStrength: 1, skinId: 'default',
    lastPositionAt: now, clientHidden: false, velocityX: 0, velocityY: 0,
    invulnerableUntil: 0, skillSelectingUntil: 0
  };
  const result = simulation.tickWorld(world, [player], now);
  assert.equal(boss.suctionActive, true);
  assert.equal(boss.suctionTimer, 4);
  assert.equal(boss.suctionCooldown, 20);
  assert.ok(player.x < 1000, 'authoritative player position is pulled toward the boss');
  assert.equal(result.playerSuctionPulls.length, 1);
  assert.ok(result.playerSuctionPulls[0].dx < 0);
});

test('Arc Chain has twice the base reach and can hit twelve monsters', () => {
  const game = read('public/game.js');
  assert.match(game, /const fieldRange=588\*\(upgrades\.range\|\|1\)/);
  assert.match(game, /sort\(\(a,b\)=>dist\(player,a\)-dist\(player,b\)\)\.slice\(0,12\)/);
  assert.match(game, /até 12 inimigos em um raio duas vezes maior/);
});

test('in-game HUD can be collapsed without hiding its arrow and uses 60% opacity', () => {
  const html = read('public/index.html');
  const css = read('public/style.css');
  const game = read('public/game.js');
  assert.match(html, /id="toggleHudBtn"/);
  assert.match(game, /function setHudCollapsed\(collapsed\)/);
  assert.match(game, /toggleHudBtn.*setHudCollapsed/);
  assert.match(css, /body\.hud-collapsed #selectedSkillsPanel/);
  assert.match(css, /opacity:\.6!important/);
  assert.match(css, /\.hud-toggle-btn/);
});

test('mobile camera zoom is separated from player base speed and world combat scale', () => {
  const game = read('public/game.js');
  assert.match(game, /const GAME_WORLD_ZOOM=\.78/);
  assert.match(game, /moveSpeed:150\/GAME_WORLD_ZOOM/);
  assert.match(game, /desiredWorldZoom\(\)\{return isMobileDevice\(\) \? \.5 : \.78;\}/);
  assert.doesNotMatch(game, /oldZoom>0\?oldZoom\/worldZoom/);
});

test('online gameplay uses compact motion deltas between reliable full snapshots', () => {
  const server = read('server.js');
  const online = read('public/online.js');
  const game = read('public/game.js');
  assert.match(server, /function getRoomMotionSnapshot\(room, options = \{\}\)/);
  assert.match(server, /volatile\.emit\('enemy-motion',motion\)/);
  assert.match(online, /socket\.on\('enemy-motion'/);
  assert.match(game, /function applySharedMotion\(data\)/);
  assert.match(game, /applyMotion:applySharedMotion/);
  assert.match(server, /const simulatingRooms = new Set\(\)/);
  assert.match(server, /for\(const room of simulatingRooms\)/);
});
