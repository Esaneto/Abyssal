'use strict';
const EnemyAI = require('./public/enemy-ai.js');
const { WORLD_WIDTH, WORLD_HEIGHT, WORLD_ZOOM, BOSS_KINDS } = EnemyAI;
const MAX_ENEMIES = 50;
const MAX_BOSSES = 4;
const MAX_COMMON_ENEMIES = MAX_ENEMIES - MAX_BOSSES;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function createWorldState(now = Date.now()) {
  return {
    initialized: false, elapsed: 0, enemies: [], nextEnemyId: 0,
    nextBossAt: 60, bossSpawnCount: 0, lastBossKind: null,
    lastBossMaxHp: 0, lastBossDamage: 0, lastBossSpeed: 0, lastBossSpawnAt: 0,
    commonSpawnTimer: 0.8, lastTick: now, snapshotTimer: 0,
    playerSnapshotTimer: 0, tickCount: 0, lastMovementAt: 0,
    movingEnemyCount: 0, movementRecoveryCount: 0, playerDamageCount: 0, playerDefeatCount: 0
  };
}

function countBosses(world) { return world.enemies.filter(e => BOSS_KINDS.includes(e.kind)); }
function countCommons(world) { return world.enemies.length - countBosses(world).length; }

function forceAdvanceEnemy(enemy, players, dt) {
  if (!enemy || !players.length || dt <= 0) return false;
  let target = null, nearest = Infinity;
  for (const player of players) {
    const d = Math.hypot(Number(player.x) - Number(enemy.x), Number(player.y) - Number(enemy.y));
    if (Number.isFinite(d) && d < nearest) { nearest = d; target = player; }
  }
  if (!target) return false;
  const oldX = Number(enemy.x) || 0, oldY = Number(enemy.y) || 0;
  const speed = Math.max(20, Number(enemy.speed) || (EnemyAI.statsForKind(enemy.kind).speed / WORLD_ZOOM) || 35);
  const stopDistance = Math.max(24, ((Number(enemy.r) || 10) + 13) / WORLD_ZOOM * 0.9);
  let x = oldX, y = oldY;
  if (nearest > stopDistance + 1) {
    const dx = Number(target.x) - oldX, dy = Number(target.y) - oldY;
    const step = Math.min(speed * dt, nearest - stopDistance);
    x += dx / (nearest || 1) * step; y += dy / (nearest || 1) * step;
  } else {
    const id = Math.abs(Math.floor(Number(enemy.id) || 1));
    const lane = id % 6;
    const radius = stopDistance * (0.78 + lane * 0.12);
    let angle = Math.atan2(oldY - Number(target.y), oldX - Number(target.x));
    if (!Number.isFinite(angle) || nearest < 0.001) angle = Number(enemy.orbitAngle) || ((id % 2) ? Math.PI : 0);
    const direction = Number(enemy.orbitDirection) || ((id % 2) ? 1 : -1);
    enemy.orbitDirection = direction;
    angle += direction * Math.max(0.025, Math.min(1.8, speed * 0.62 / Math.max(radius, 12))) * dt;
    enemy.orbitAngle = angle;
    const desiredX = Number(target.x) + Math.cos(angle) * radius;
    const desiredY = Number(target.y) + Math.sin(angle) * radius;
    const dx = desiredX - oldX, dy = desiredY - oldY, d = Math.hypot(dx, dy);
    const step = Math.min(d, speed * dt);
    if (d > 1e-8) { x += dx / d * step; y += dy / d * step; }
  }
  const margin = 8 / WORLD_ZOOM;
  x = clamp(x, margin, WORLD_WIDTH - margin); y = clamp(y, margin, WORLD_HEIGHT - margin);
  if (Math.hypot(x - oldX, y - oldY) < 0.05) {
    // Boundary-safe tangential nudge; never leave an active enemy frozen because its
    // desired orbit point happens to clamp back to its current coordinate.
    const id = Math.abs(Math.floor(Number(enemy.id) || 1));
    const dir = (id % 2) ? 1 : -1;
    const a = Math.atan2(oldY - Number(target.y), oldX - Number(target.x)) + dir * Math.PI / 2;
    const step = Math.max(0.3, Math.min(speed * dt, 5));
    x = clamp(oldX + Math.cos(a) * step, margin, WORLD_WIDTH - margin);
    y = clamp(oldY + Math.sin(a) * step, margin, WORLD_HEIGHT - margin);
  }
  enemy.x = x; enemy.y = y;
  enemy.vx = (x - oldX) / Math.max(dt, 0.001); enemy.vy = (y - oldY) / Math.max(dt, 0.001);
  return Math.hypot(x - oldX, y - oldY) >= 0.05;
}

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
    stats.hp = world.lastBossMaxHp > 0 ? Math.max(stats.hp, world.lastBossMaxHp * 1.5) : stats.hp;
    stats.damage = world.lastBossDamage > 0 ? Math.max(stats.damage, Math.round(world.lastBossDamage * 1.12)) : stats.damage;
    stats.speed = Math.min(90, world.lastBossSpeed > 0 ? Math.max(stats.speed, world.lastBossSpeed * 1.05) : stats.speed);
    world.lastBossMaxHp = stats.hp;
    world.lastBossSpawnAt = Date.now();
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
    hit: 0, attackCd: 0.6, vx: 0, vy: 0, damageRevision: 0, threat: world.bossSpawnCount,
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
  world.lastBossMaxHp = 0; world.lastBossDamage = 0; world.lastBossSpeed = 0; world.lastBossSpawnAt = 0;
  world.enemies = []; world.commonSpawnTimer = 0.8;
  world.lastTick = now; world.snapshotTimer = 0; world.playerSnapshotTimer = 0;
  return [spawnEnemy(world, { type: 'common', initial: true, random }), spawnEnemy(world, { type: 'common', initial: true, random }), spawnEnemy(world, { type: 'common', initial: true, random })].filter(Boolean);
}

function tickWorld(world, players, now = Date.now(), random = Math.random) {
  const validPlayers = Array.isArray(players)
    ? players.filter(p => p && p.alive !== false && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
    : [];
  if (validPlayers.length === 0) {
    // No living participants means no world time, spawning, movement, or attacks.
    // The server stops its ticker as well; state is cleared when the last participant leaves.
    world.lastTick = now;
    world.movingEnemyCount = 0;
    return { active: false, dt: 0, movedEnemyCount: 0, spawnedBosses: [], playerHits: [], playerHeals: [], defeatedPlayers: [], sendSnapshot: false, sendPlayers: false };
  }

  const initialSpawns = initializeWorld(world, now, random);
  const previousTick = Number(world.lastTick) || now;
  // The server runs this ticker independently of browser rendering. Clamp a single
  // catch-up step to avoid huge jumps after GC or brief event-loop contention.
  const dt = Math.max(0, Math.min(0.1, (now - previousTick) / 1000));
  world.lastTick = now;
  world.elapsed += dt;
  world.tickCount++;

  // Server-authoritative passive regeneration: it continues even if a player's tab is hidden.
  const playerHeals = [];
  for (const p of validPlayers) {
    const regenLevel = clamp(Math.floor(Number(p.regenLevel) || 0), 0, 3);
    if (regenLevel <= 0 || Number(p.hp) >= Number(p.maxHp)) continue;
    p.regenAccumulator = (Number(p.regenAccumulator) || 0) + dt * regenLevel * 0.25;
    let healed = 0;
    while (p.regenAccumulator >= 1 && Number(p.hp) < Number(p.maxHp)) {
      p.regenAccumulator -= 1;
      p.hp = Math.min(Number(p.maxHp) || 100, (Number(p.hp) || 0) + 1);
      healed++;
    }
    if (healed > 0) playerHeals.push({
      playerId: p.id, hp: p.hp, maxHp: p.maxHp,
      shieldCharges: clamp(Math.floor(Number(p.shieldCharges) || 0), 0, 3),
      alive: p.alive !== false, healed,
      invulnerabilityMs: Math.max(0, (Number(p.invulnerableUntil) || 0) - now)
    });
  }

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
    const activeBossCount = countBosses(world).length;
    if (activeBossCount < MAX_BOSSES && world.enemies.length < MAX_ENEMIES) {
      const boss = spawnEnemy(world, { type: 'boss', random });
      if (boss) {
        spawnedBosses.push(boss);
        world.nextBossAt = world.elapsed + 60;
      } else {
        world.nextBossAt = world.elapsed + 3;
      }
    } else if (activeBossCount >= MAX_BOSSES) {
      world.nextBossAt = world.elapsed + 60;
    } else {
      world.nextBossAt = world.elapsed + 3;
    }
  }

  let movedEnemyCount = 0;
  const playerHits = [];
  const defeatedPlayers = [];
  for (const enemy of world.enemies) {
    enemy.hit = Math.max(0, (enemy.hit || 0) - dt);
    enemy.attackCd = Math.max(0, (enemy.attackCd || 0) - dt);
    const movement = EnemyAI.moveTowardTarget(enemy, validPlayers, dt, {
      minX: 8 / WORLD_ZOOM, maxX: WORLD_WIDTH - 8 / WORLD_ZOOM,
      minY: 8 / WORLD_ZOOM, maxY: WORLD_HEIGHT - 8 / WORLD_ZOOM,
      stopDistance: Math.max(1, ((Number(enemy.r) || 10) + 13) / WORLD_ZOOM * 0.9)
    });
    if (!movement.moved && validPlayers.length && dt > 0) {
      movement.moved = forceAdvanceEnemy(enemy, validPlayers, dt);
      if (movement.moved) world.movementRecoveryCount = (world.movementRecoveryCount || 0) + 1;
    }
    if (movement.moved) movedEnemyCount++;

    // Contact attacks are resolved here on the server, not in requestAnimationFrame.
    // A minimized client therefore cannot pause damage or make itself invulnerable by
    // stopping its local game loop. We keep the last validated player coordinates.
    const target = movement.target;
    if (!target || target.alive === false || enemy.attackCd > 0) continue;
    const contactDistance = Math.hypot(Number(target.x) - Number(enemy.x), Number(target.y) - Number(enemy.y));
    const enemyRadiusWorld = Math.max(1, Number(enemy.r) || 10) / WORLD_ZOOM;
    const playerRadiusWorld = Math.max(1, Number(target.r) || (13 / WORLD_ZOOM));
    const contactRadius = enemyRadiusWorld + playerRadiusWorld + 6 / WORLD_ZOOM;
    if (contactDistance > contactRadius) continue;

    // Spend the attack cooldown even when blocked by invulnerability so a pack cannot
    // repeatedly evaluate the same contact every frame.
    const attackInterval = BOSS_KINDS.includes(enemy.kind) ? 1.15 : enemy.kind === 'stinger' ? 0.72 : 0.92;
    enemy.attackCd = attackInterval;
    if ((Number(target.invulnerableUntil) || 0) > now) continue;

    let appliedDamage = 0, blocked = false;
    const shieldCharges = clamp(Math.floor(Number(target.shieldCharges) || 0), 0, 3);
    if (shieldCharges > 0) {
      target.shieldCharges = shieldCharges - 1;
      target.invulnerableUntil = now + 700;
      blocked = true;
    } else {
      const requestedDamage = Math.max(1, Math.min(100, Number(enemy.damage) || 8));
      const hpBefore = Number.isFinite(Number(target.hp)) ? Number(target.hp) : (Number(target.maxHp) || 100);
      target.maxHp = Math.max(1, Number(target.maxHp) || 100);
      target.hp = Math.max(0, Math.min(target.maxHp, hpBefore) - requestedDamage);
      appliedDamage = Math.min(requestedDamage, Math.max(0, hpBefore));
      target.invulnerableUntil = now + 800;
      if (target.hp <= 0) {
        target.alive = false;
        world.playerDefeatCount = (world.playerDefeatCount || 0) + 1;
        defeatedPlayers.push(target);
      }
    }
    world.playerDamageCount = (world.playerDamageCount || 0) + 1;
    playerHits.push({
      playerId: target.id, enemyId: enemy.id, enemyKind: enemy.kind,
      damage: appliedDamage, blocked, hp: Math.max(0, Number(target.hp) || 0),
      maxHp: Math.max(1, Number(target.maxHp) || 100),
      shieldCharges: clamp(Math.floor(Number(target.shieldCharges) || 0), 0, 3),
      alive: target.alive !== false,
      invulnerabilityMs: Math.max(0, (Number(target.invulnerableUntil) || 0) - now)
    });
  }

  if (movedEnemyCount) world.lastMovementAt = now;
  world.movingEnemyCount = movedEnemyCount;
  world.snapshotTimer -= dt;
  world.playerSnapshotTimer -= dt;
  const sendSnapshot = world.snapshotTimer <= 0;
  const sendPlayers = world.playerSnapshotTimer <= 0;
  if (sendSnapshot) world.snapshotTimer = 0.1;
  if (sendPlayers) world.playerSnapshotTimer = 0.1;
  return {
    active: true, dt, movedEnemyCount,
    spawnedBosses: [...initialSpawns.filter(e => BOSS_KINDS.includes(e.kind)), ...spawnedBosses],
    playerHits, playerHeals, defeatedPlayers, sendSnapshot, sendPlayers,
    tickCount: world.tickCount, elapsed: world.elapsed
  };
}

function resetWorldState(world, now = Date.now()) {
  const fresh = createWorldState(now);
  for (const key of Object.keys(world || {})) delete world[key];
  Object.assign(world || {}, fresh);
  return world;
}

module.exports = { MAX_ENEMIES, MAX_BOSSES, MAX_COMMON_ENEMIES, createWorldState, initializeWorld, spawnEnemy, tickWorld, resetWorldState, countBosses, countCommons, forceAdvanceEnemy };
