const test = require('node:test');
const assert = require('node:assert/strict');
const AI = require('../public/enemy-ai.js');
const Sim = require('../world-simulation.js');

test('initial co-op horde enters through three distinct fixed corner vortices', () => {
  const world = Sim.createWorldState(1000);
  Sim.initializeWorld(world, 1000, () => 0.25);
  assert.equal(world.enemies.length, 3);
  assert.deepEqual(world.enemies.map(e => e.spawnCorner), [0, 1, 2]);
  assert.ok(world.enemies.every(e => e.x < 500 || e.x > AI.WORLD_WIDTH - 500));
  assert.ok(world.enemies.every(e => e.y < 500 || e.y > AI.WORLD_HEIGHT - 500));
});

test('authoritative online simulation moves enemies continuously toward a world-unit player', () => {
  const world = Sim.createWorldState(1000);
  Sim.initializeWorld(world, 1000, Math.random);
  const player = { id: 'p1', x: AI.WORLD_WIDTH / 2, y: AI.WORLD_HEIGHT / 2 };
  const first = world.enemies.map(e => ({ id: e.id, x: e.x, y: e.y }));
  for (let i = 1; i <= 20; i++) Sim.tickWorld(world, [player], 1000 + i * 50, Math.random);
  for (const original of first) {
    const next = world.enemies.find(e => e.id === original.id);
    assert.ok(next, `enemy ${original.id} must still exist`);
    assert.ok(Math.hypot(next.x - original.x, next.y - original.y) > 20, `enemy ${original.id} did not move`);
    assert.ok(Math.hypot(player.x - next.x, player.y - next.y) < Math.hypot(player.x - original.x, player.y - original.y), `enemy ${original.id} failed to approach player`);
  }
  assert.ok(world.movingEnemyCount > 0);
});

test('regular mobs keep spawning when bosses are active; boss types never duplicate while alive', () => {
  const world = Sim.createWorldState(1000);
  Sim.initializeWorld(world, 1000, Math.random);
  const player = { id: 'p1', x: AI.WORLD_WIDTH / 2, y: AI.WORLD_HEIGHT / 2 };
  world.elapsed = 59.98; world.nextBossAt = 60; world.commonSpawnTimer = 0;
  Sim.tickWorld(world, [player], 1050, Math.random);
  assert.equal(Sim.countBosses(world).length, 1);
  const bosses = Sim.countBosses(world);
  assert.equal(new Set(bosses.map(e => e.kind)).size, bosses.length);
  const commonsBefore = Sim.countCommons(world);
  for (let i = 1; i <= 30; i++) Sim.tickWorld(world, [player], 1050 + i * 50, Math.random);
  assert.ok(Sim.countCommons(world) > commonsBefore);
  assert.equal(Sim.countBosses(world).length, 1);
});

test('boss health grows by 50 percent per spawn and caps active bosses at four', () => {
  const world = Sim.createWorldState(1000);
  Sim.initializeWorld(world, 1000);
  const first = Sim.spawnEnemy(world, { type: 'boss', random: () => 0.3 });
  const second = Sim.spawnEnemy(world, { type: 'boss', random: () => 0.3 });
  assert.ok(second);
  assert.equal(second.maxHp, first.maxHp * 1.5);
  Sim.spawnEnemy(world, { type: 'boss', random: () => 0.3 });
  Sim.spawnEnemy(world, { type: 'boss', random: () => 0.3 });
  assert.equal(Sim.countBosses(world).length, 4);
  assert.equal(Sim.spawnEnemy(world, { type: 'boss' }), null);
  assert.equal(new Set(Sim.countBosses(world).map(e => e.kind)).size, 4);
});

test('empty rooms do not advance time or simulate, and reset releases their enemies', () => {
  const world = Sim.createWorldState(1000);
  Sim.initializeWorld(world, 1000);
  const before = world.elapsed;
  const result = Sim.tickWorld(world, [], 5000);
  assert.equal(result.active, false);
  assert.equal(world.elapsed, before);
  Sim.resetWorldState(world, 6000);
  assert.equal(world.initialized, false);
  assert.equal(world.enemies.length, 0);
  assert.equal(world.elapsed, 0);
});

test('online mobs keep the same 62% contact radius as solo and remain visible beside the player', () => {
  const world = Sim.createWorldState(1000);
  world.initialized = true;
  world.lastTick = 1000;
  world.nextBossAt = 99999;
  world.commonSpawnTimer = 99999;
  const stats = AI.statsForKind('drifter');
  const enemy = { id: 1, kind: 'drifter', x: 1000, y: 1000, r: stats.r, speed: stats.speed / AI.WORLD_ZOOM, hp: stats.hp, maxHp: stats.hp, phase: 0, attackCd: 0 };
  world.enemies = [enemy];
  world.nextEnemyId = 1;
  const player = { id: 'p1', x: 1100, y: 1000 };
  for (let i = 1; i <= 40; i++) Sim.tickWorld(world, [player], 1000 + i * 50, Math.random);
  const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
  const sharedContactRadius = (stats.r + 13) / AI.WORLD_ZOOM;
  assert.ok(distance > 0, 'enemy must not settle at the exact player coordinate');
  assert.ok(distance < sharedContactRadius, 'enemy remains within contact/damage range');
  assert.ok(distance >= sharedContactRadius * 0.55, 'enemy remains outside the exact player center');
  assert.ok(distance < sharedContactRadius, 'enemy circles inside player contact range');
  assert.ok(world.movingEnemyCount > 0, 'enemy continues orbiting instead of freezing after contact');
});


test('a stationary player does not cause the whole online horde to freeze at contact', () => {
  const world = Sim.createWorldState(1000);
  world.initialized = true;
  world.lastTick = 1000;
  world.nextBossAt = 999999;
  world.commonSpawnTimer = 999999;
  const stats = AI.statsForKind('drifter');
  const enemy = { id: 7, kind: 'drifter', x: 900, y: 1000, r: stats.r, speed: stats.speed / AI.WORLD_ZOOM, hp: stats.hp, maxHp: stats.hp, phase: 0, attackCd: 0 };
  world.enemies = [enemy];
  world.nextEnemyId = 7;
  const player = { id: 'p1', x: 1000, y: 1000 };
  for (let i = 1; i <= 700; i++) Sim.tickWorld(world, [player], 1000 + i * 50, Math.random);
  assert.ok(world.movingEnemyCount > 0, 'enemy keeps moving even after reaching a stationary player');
  assert.ok(Math.hypot(enemy.x - player.x, enemy.y - player.y) < 30, 'enemy remains inside attack distance');
});
