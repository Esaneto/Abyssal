'use strict';
const EnemyAI = require('./public/enemy-ai.js');
const { WORLD_WIDTH, WORLD_HEIGHT, WORLD_ZOOM, BOSS_KINDS } = EnemyAI;
const MAX_ENEMIES = 50;
const MAX_BOSSES = 4;
const MAX_COMMON_ENEMIES = MAX_ENEMIES - MAX_BOSSES;

function createWorldState(now = Date.now()) {
  return {
    initialized: false, elapsed: 0, enemies: [], nextEnemyId: 0,
    nextBossAt: 60, bossSpawnCount: 0, lastBossKind: null,
    lastBossMaxHp: 0, lastBossDamage: 0, lastBossSpeed: 0,
    commonSpawnTimer: 0.8, lastTick: now, snapshotTimer: 0,
    playerSnapshotTimer: 0, tickCount: 0, lastMovementAt: 0,
    movingEnemyCount: 0
  };
}

function countBosses(world) { return world.enemies.filter(e => BOSS_KINDS.includes(e.kind)); }
function countCommons(world) { return world.enemies.length - countBosses(world).length; }

function spawnEnemy(world, { type = 'common', initial = false, random = Math.random } = {}) {
  if (!world || world.enemies.length >= MAX_ENEMIES) return null;
  const bosses = countBosses(world);
  if (type === 'boss' && bosses.length >= MAX_BOSSES) return null;
  if (type !== 'boss' && countCommons(world) >= MAX_COMMON_ENEMIES) return null;

  let kind;
  if (type === 'boss') {
    kind = EnemyAI.chooseBossKind(bosses.map(e => e.kind), random);
    if (!kind) return null;
  } else kind = EnemyAI.chooseCommonKind(random);

  const stats = EnemyAI.statsForKind(kind);
  if (type === 'boss') {
    stats.hp = world.lastBossMaxHp > 0 ? world.lastBossMaxHp * 1.5 : stats.hp;
    stats.damage = world.lastBossDamage > 0 ? Math.max(stats.damage, Math.round(world.lastBossDamage * 1.12)) : stats.damage;
    stats.speed = Math.min(90, world.lastBossSpeed > 0 ? Math.max(stats.speed, world.lastBossSpeed * 1.05) : stats.speed);
    world.lastBossMaxHp = stats.hp;
    world.lastBossDamage = stats.damage;
    world.lastBossSpeed = stats.speed;
    world.bossSpawnCount++;
    world.lastBossKind = kind;
  }
  // First wave deliberately enters through different fixed corner vortices. Later waves choose a current randomly.
  const corner = initial ? world.nextEnemyId % 4 : null;
  const point = EnemyAI.chooseSpawnPoint(random, corner, WORLD_WIDTH, WORLD_HEIGHT);
  const id = ++world.nextEnemyId;
  const enemy = {
    id, kind, x: point.x, y: point.y, r: stats.r, hp: stats.hp, maxHp: stats.hp,
    speed: stats.speed / WORLD_ZOOM, damage: stats.damage, color: stats.color,
    value: stats.value, angle: random() * Math.PI * 2, phase: random() * Math.PI * 2,
    hit: 0, attackCd: 0.6, vx: 0, vy: 0, threat: world.bossSpawnCount,
    spawnCorner: point.corner
  };
  world.enemies.push(enemy);
  return enemy;
}

function initializeWorld(world, now = Date.now(), random = Math.random) {
  if (world.initialized) return [];
  world.initialized = true;
  world.elapsed = 0; world.nextEnemyId = 0; world.nextBossAt = 60;
  world.bossSpawnCount = 0; world.lastBossKind = null;
  world.lastBossMaxHp = 0; world.lastBossDamage = 0; world.lastBossSpeed = 0;
  world.enemies = []; world.commonSpawnTimer = 0.8;
  world.lastTick = now; world.snapshotTimer = 0; world.playerSnapshotTimer = 0;
  return [spawnEnemy(world, { type: 'common', initial: true, random }), spawnEnemy(world, { type: 'common', initial: true, random }), spawnEnemy(world, { type: 'common', initial: true, random })].filter(Boolean);
}

function tickWorld(world, players, now = Date.now(), random = Math.random) {
  if (!Array.isArray(players) || players.length === 0) {
    // Empty arenas are paused. The server normally destroys them immediately; this protects the engine if called directly.
    world.lastTick = now;
    world.movingEnemyCount = 0;
    return { active: false, dt: 0, movedEnemyCount: 0, spawnedBosses: [], sendSnapshot: false, sendPlayers: false };
  }
  const initialSpawns = initializeWorld(world, now, random);
  const previousTick = Number(world.lastTick) || now;
  const dt = Math.max(0, Math.min(0.1, (now - previousTick) / 1000));
  world.lastTick = now;
  world.elapsed += dt;
  world.tickCount++;

  world.commonSpawnTimer -= dt;
  let commonCount = countCommons(world);
  if (commonCount === 0 && world.enemies.length < MAX_ENEMIES) {
    spawnEnemy(world, { type: 'common', random });
    commonCount = countCommons(world);
    world.commonSpawnTimer = 0.6;
  } else if (world.commonSpawnTimer <= 0) {
    if (commonCount < MAX_COMMON_ENEMIES && world.enemies.length < MAX_ENEMIES) spawnEnemy(world, { type: 'common', random });
    commonCount = countCommons(world);
    world.commonSpawnTimer = commonCount < MAX_COMMON_ENEMIES ? Math.max(0.38, 1.02 - world.elapsed * 0.0015) : 0.15;
  }

  const spawnedBosses = [];
  if (world.elapsed >= world.nextBossAt) {
    if (countBosses(world).length < MAX_BOSSES && world.enemies.length < MAX_ENEMIES) {
      const boss = spawnEnemy(world, { type: 'boss', random });
      if (boss) spawnedBosses.push(boss);
    }
    world.nextBossAt = world.elapsed + 60;
  }

  const validPlayers = players.filter(p => Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)));
  let movedEnemyCount = 0;
  for (const enemy of world.enemies) {
    enemy.hit = Math.max(0, (enemy.hit || 0) - dt);
    enemy.attackCd = Math.max(0, (enemy.attackCd || 0) - dt);
    const movement = EnemyAI.moveTowardTarget(enemy, validPlayers, dt, {
      minX: 8 / WORLD_ZOOM, maxX: WORLD_WIDTH - 8 / WORLD_ZOOM,
      minY: 8 / WORLD_ZOOM, maxY: WORLD_HEIGHT - 8 / WORLD_ZOOM,
      // Keep each creature visible at contact instead of letting it hide exactly under the player sprite.
      // Solo applies the same 62% contact radius in game.js. Enemy r is stored in base render units here.
      stopDistance: Math.max(0, ((Number(enemy.r) || 10) + 13) / WORLD_ZOOM * 0.62)
    });
    if (movement.moved) movedEnemyCount++;
  }
  if (movedEnemyCount) world.lastMovementAt = now;
  world.movingEnemyCount = movedEnemyCount;
  world.snapshotTimer -= dt;
  world.playerSnapshotTimer -= dt;
  const sendSnapshot = world.snapshotTimer <= 0;
  const sendPlayers = world.playerSnapshotTimer <= 0;
  if (sendSnapshot) world.snapshotTimer = 0.1;
  if (sendPlayers) world.playerSnapshotTimer = 0.1;
  return { active: true, dt, movedEnemyCount, spawnedBosses: [...initialSpawns.filter(e => BOSS_KINDS.includes(e.kind)), ...spawnedBosses], sendSnapshot, sendPlayers, tickCount: world.tickCount, elapsed: world.elapsed };
}

function resetWorldState(world, now = Date.now()) {
  const fresh = createWorldState(now);
  for (const key of Object.keys(world || {})) delete world[key];
  Object.assign(world || {}, fresh);
  return world;
}

module.exports = { MAX_ENEMIES, MAX_BOSSES, MAX_COMMON_ENEMIES, createWorldState, initializeWorld, spawnEnemy, tickWorld, resetWorldState, countBosses, countCommons };
