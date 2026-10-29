/* Shared Abyssal enemy rules used by solo rendering and the authoritative co-op server.
 * All movement coordinates are WORLD UNITS (3600 x 2200), never viewport pixels or normalized values.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AbyssalEnemyAI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const WORLD_WIDTH = 3600;
  const WORLD_HEIGHT = 2200;
  const WORLD_ZOOM = 0.78;
  const BOSS_KINDS = Object.freeze(['boss', 'leviathan', 'maw', 'angler']);
  const ENEMY_STATS = Object.freeze({
    drifter: Object.freeze({ r: 10, hp: 22, speed: 51, damage: 8, color: '#ff769d', value: 1 }),
    stinger: Object.freeze({ r: 7, hp: 13, speed: 88, damage: 6, color: '#ffbc78', value: 2 }),
    brute: Object.freeze({ r: 16, hp: 65, speed: 30, damage: 15, color: '#bd88ff', value: 4 }),
    lurker: Object.freeze({ r: 20, hp: 100, speed: 43, damage: 18, color: '#6e8dff', value: 6 }),
    boss: Object.freeze({ r: 40, hp: 2820, speed: 22, damage: 25, color: '#ff315f', value: 55 }),
    leviathan: Object.freeze({ r: 54, hp: 4700, speed: 16, damage: 34, color: '#4ce0d1', value: 90 }),
    maw: Object.freeze({ r: 45, hp: 3750, speed: 25, damage: 31, color: '#c16cff', value: 75 }),
    angler: Object.freeze({ r: 35, hp: 3260, speed: 30, damage: 28, color: '#ffb45e', value: 65 })
  });

  function statsForKind(kind) {
    const stats = ENEMY_STATS[kind] || ENEMY_STATS.drifter;
    return { ...stats };
  }

  function chooseCommonKind(random = Math.random) {
    const roll = random();
    return roll < 0.56 ? 'drifter' : roll < 0.78 ? 'stinger' : roll < 0.94 ? 'brute' : 'lurker';
  }

  function chooseBossKind(activeKinds = [], random = Math.random) {
    const available = BOSS_KINDS.filter(kind => !activeKinds.includes(kind));
    if (!available.length) return null;
    return available[Math.min(available.length - 1, Math.floor(random() * available.length))];
  }

  function chooseSpawnPoint(random = Math.random, cornerOverride = null, width = WORLD_WIDTH, height = WORLD_HEIGHT) {
    const corner = Number.isInteger(cornerOverride) ? ((cornerOverride % 4) + 4) % 4 : Math.floor(random() * 4);
    const insetX = 100 + random() * 190;
    const insetY = 90 + random() * 160;
    const left = corner === 0 || corner === 2;
    const top = corner === 0 || corner === 1;
    return {
      x: clamp(left ? insetX : width - insetX, 70 / WORLD_ZOOM, width - 70 / WORLD_ZOOM),
      y: clamp(top ? insetY : height - insetY, 70 / WORLD_ZOOM, height - 70 / WORLD_ZOOM),
      corner
    };
  }

  /** Move one enemy toward the nearest target. x, y, speed and target coordinates all use world units. */
  function moveTowardTarget(enemy, targets, dt, options = {}) {
    if (!enemy || !Array.isArray(targets) || !targets.length || !Number.isFinite(dt) || dt <= 0) {
      return { moved: false, target: null, distance: Infinity };
    }
    let target = null, dx = 0, dy = 0, distance = Infinity;
    for (const candidate of targets) {
      const x = Number(candidate?.x), y = Number(candidate?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const cx = x - Number(enemy.x), cy = y - Number(enemy.y), d = Math.hypot(cx, cy);
      if (d < distance) { distance = d; dx = cx; dy = cy; target = candidate; }
    }
    if (!target || !Number.isFinite(distance)) return { moved: false, target: null, distance: Infinity };

    enemy.angle = Math.atan2(dy, dx);
    enemy.phase = (Number(enemy.phase) || 0) + dt * (enemy.kind === 'stinger' ? 7 : 3);
    const speed = Math.max(0, Number(enemy.speed) || 0);
    const stopDistance = Math.max(0, Number(options.stopDistance) || 0);
    const oldX = Number(enemy.x) || 0, oldY = Number(enemy.y) || 0;
    let x = oldX, y = oldY;
    if (distance > stopDistance && speed > 0) {
      const step = Math.min(distance - stopDistance, speed * dt);
      x += (dx / (distance || 1)) * step;
      y += (dy / (distance || 1)) * step;
    }
    x = clamp(x, Number.isFinite(options.minX) ? options.minX : 0, Number.isFinite(options.maxX) ? options.maxX : WORLD_WIDTH);
    y = clamp(y, Number.isFinite(options.minY) ? options.minY : 0, Number.isFinite(options.maxY) ? options.maxY : WORLD_HEIGHT);
    enemy.x = x; enemy.y = y;
    enemy.vx = (x - oldX) / Math.max(dt, 0.001);
    enemy.vy = (y - oldY) / Math.max(dt, 0.001);
    return { moved: Math.abs(x - oldX) > 1e-8 || Math.abs(y - oldY) > 1e-8, target, distance, dx, dy };
  }

  return { WORLD_WIDTH, WORLD_HEIGHT, WORLD_ZOOM, BOSS_KINDS, ENEMY_STATS, statsForKind, chooseCommonKind, chooseBossKind, chooseSpawnPoint, moveTowardTarget };
});
