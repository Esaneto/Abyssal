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
  // Bosses ordered from the lowest base HP to the highest.
  const BOSS_KINDS = Object.freeze(['boss', 'angler', 'maw', 'leviathan', 'kraken']);
  const ENEMY_STATS = Object.freeze({
    drifter: Object.freeze({ r: 10, hp: 22, speed: 51, damage: 8, color: '#ff769d', value: 1 }),
    stinger: Object.freeze({ r: 7, hp: 13, speed: 88, damage: 6, color: '#ffbc78', value: 2 }),
    brute: Object.freeze({ r: 16, hp: 65, speed: 30, damage: 15, color: '#bd88ff', value: 4 }),
    lurker: Object.freeze({ r: 20, hp: 100, speed: 43, damage: 18, color: '#6e8dff', value: 6 }),
    boss: Object.freeze({ r: 40, hp: 2820, speed: 52, damage: 25, color: '#ff315f', value: 55 }),
    leviathan: Object.freeze({ r: 54, hp: 4700, speed: 44, damage: 34, color: '#4ce0d1', value: 90 }),
    maw: Object.freeze({ r: 45, hp: 3750, speed: 58, damage: 31, color: '#c16cff', value: 75 }),
    angler: Object.freeze({ r: 35, hp: 3260, speed: 66, damage: 28, color: '#ffb45e', value: 65 }),
    kraken: Object.freeze({ r: 80, hp: 9200, speed: 20, damage: 38, color: '#8b5cf6', value: 180 })
  });

  // Radius in screen-logical pixels. Both solo and online convert it once into world units.
  // Higher XP values (especially bosses) create visibly larger resonance orbs.
  function xpOrbRadius(value) {
    const amount = Math.max(1, Number(value) || 1);
    return clamp(3.4 + Math.sqrt(amount) * 1.35, 4.5, 15.5);
  }

  function statsForKind(kind) {
    const stats = ENEMY_STATS[kind] || ENEMY_STATS.drifter;
    return { ...stats };
  }

  function chooseCommonKind(random = Math.random) {
    const roll = random();
    return roll < 0.56 ? 'drifter' : roll < 0.78 ? 'stinger' : roll < 0.94 ? 'brute' : 'lurker';
  }

  function chooseBossKind(activeKinds = [], random = Math.random, spawnIndex = 0) {
    const active = new Set(activeKinds);
    if (active.size >= BOSS_KINDS.length) return null;
    const start = Math.max(0, Math.floor(Number(spawnIndex) || 0)) % BOSS_KINDS.length;
    for (let offset = 0; offset < BOSS_KINDS.length; offset++) {
      const kind = BOSS_KINDS[(start + offset) % BOSS_KINDS.length];
      if (!active.has(kind)) return kind;
    }
    return null;
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

  // Eight deterministic, animated arms shared by the renderer and collision code.
  // Coordinates are relative to the body's radius; the base is thick and each tip tapers.
  function krakenTentaclePose(index, phase = 0) {
    const i = ((Math.floor(Number(index) || 0) % 8) + 8) % 8;
    const angle = -Math.PI / 2 + i * (Math.PI * 2 / 8);
    const sway = Math.sin((Number(phase) || 0) * 0.88 + i * 1.73);
    const length = 2.16 + 0.16 * Math.sin((Number(phase) || 0) * 0.43 + i * 0.91);
    const sx = Math.cos(angle) * 0.44;
    const sy = 0.25 + Math.sin(angle) * 0.21;
    return {
      sx, sy,
      c1x: sx + Math.cos(angle - 0.35) * 0.58,
      c1y: sy + Math.sin(angle - 0.35) * 0.68,
      c2x: Math.cos(angle + sway * 0.18) * (length * 0.68),
      c2y: 0.25 + Math.sin(angle + sway * 0.18) * (length * 0.67),
      ex: Math.cos(angle + sway * 0.24) * length,
      ey: 0.20 + Math.sin(angle + sway * 0.24) * (length * 0.94)
    };
  }

  function pointSegmentDistance(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 1e-9) return Math.hypot(px - ax, py - ay);
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  }

  /** True when a player overlaps an animated kraken arm, not only its central body. */
  function touchesKrakenTentacle(enemy, target, enemyRadiusScale = 1) {
    if (!enemy || enemy.kind !== 'kraken' || !target) return false;
    const radius = Math.max(1, Number(enemy.r) || 80) * Math.max(0.001, Number(enemyRadiusScale) || 1);
    const px = Number(target.x), py = Number(target.y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return false;
    const targetRadius = Math.max(1, Number(target.r) || 13 / WORLD_ZOOM);
    const margin = 8 / WORLD_ZOOM;
    const facing = Number(enemy.angle) || 0, cs = Math.cos(facing), sn = Math.sin(facing);
    const phase = Number(enemy.phase) || 0;
    for (let arm = 0; arm < 8; arm++) {
      const p = krakenTentaclePose(arm, phase);
      let prevX = Number(enemy.x) + (p.sx * cs - p.sy * sn) * radius;
      let prevY = Number(enemy.y) + (p.sx * sn + p.sy * cs) * radius;
      for (let step = 1; step <= 12; step++) {
        const t = step / 12, mt = 1 - t;
        const nx = mt*mt*mt*p.sx + 3*mt*mt*t*p.c1x + 3*mt*t*t*p.c2x + t*t*t*p.ex;
        const ny = mt*mt*mt*p.sy + 3*mt*mt*t*p.c1y + 3*mt*t*t*p.c2y + t*t*t*p.ey;
        const x = Number(enemy.x) + (nx * cs - ny * sn) * radius;
        const y = Number(enemy.y) + (nx * sn + ny * cs) * radius;
        const armRadius = radius * (0.125 * (1 - (t - 1 / 24)) + 0.035);
        if (pointSegmentDistance(px, py, prevX, prevY, x, y) <= targetRadius + armRadius + margin) return true;
        prevX = x; prevY = y;
      }
    }
    return false;
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
    const baseSpeed = Math.max(0, Number(enemy.speed) || 0);
    // Bosses begin slowly at full health and accelerate as they take damage.
    // The hard cap is 79% of the player's base movement speed (before environmental
    // slows), so even a nearly defeated boss cannot match the player's raw speed.
    let pursuitSpeed = baseSpeed;
    if (BOSS_KINDS.includes(enemy.kind)) {
      const maxHp = Math.max(1, Number(enemy.maxHp) || Number(enemy.hp) || 1);
      const healthRatio = clamp((Number(enemy.hp) || 0) / maxHp, 0, 1);
      const playerSpeed = Math.max(1, Number(target.moveSpeed) || 150 / WORLD_ZOOM);
      const slowSpeed = Math.min(baseSpeed, playerSpeed * 0.25);
      const fastSpeed = playerSpeed * 0.79;
      pursuitSpeed = slowSpeed + (fastSpeed - slowSpeed) * (1 - healthRatio);
      pursuitSpeed = Math.min(pursuitSpeed, playerSpeed * 0.79);
    }
    // Glacier skin gives nearby enemies a readable slow field without altering their attack cadence.
    const reducedPursuitSpeed = pursuitSpeed * 0.85;
    const speed = target.skinId === 'glacier' && distance < 260 / WORLD_ZOOM ? reducedPursuitSpeed * 0.74 : reducedPursuitSpeed;
    const stopDistance = Math.max(0, Number(options.stopDistance) || 0);
    const oldX = Number(enemy.x) || 0, oldY = Number(enemy.y) || 0;
    let x = oldX, y = oldY;
    if (speed > 0 && distance > stopDistance + 0.5) {
      // Same pursuit steering in solo and co-op: approach the nearest live player.
      const step = Math.min(distance - stopDistance, speed * dt);
      x += (dx / (distance || 1)) * step;
      y += (dy / (distance || 1)) * step;
    } else if (speed > 0 && stopDistance > 0) {
      // A small horde should not collapse into one static pile at the player's feet.
      // Stable ID-based lanes spread creatures around the prey while they keep moving.
      const id = Math.abs(Math.floor(Number(enemy.id) || 1));
      const lane = id % 6;
      const orbitRadius = stopDistance * (0.78 + lane * 0.12);
      let theta = Math.atan2(oldY - Number(target.y), oldX - Number(target.x));
      if (!Number.isFinite(theta) || distance < 0.001) theta = (Number(enemy.angle) || 0) + Math.PI;
      let direction = Number(enemy.orbitDirection);
      if (!direction) direction = (id % 2) ? 1 : -1;
      enemy.orbitDirection = direction;
      // The orbit speed is world-units/second compatible with the solo simulation.
      const angularSpeed = clamp((speed * 0.62) / Math.max(orbitRadius, 12), 0.35, 1.8);
      theta += direction * angularSpeed * dt;
      const desiredX = Number(target.x) + Math.cos(theta) * orbitRadius;
      const desiredY = Number(target.y) + Math.sin(theta) * orbitRadius;
      // Move toward the next point on the orbit instead of teleporting to its radius.
      const ox = desiredX - oldX, oy = desiredY - oldY, od = Math.hypot(ox, oy);
      const orbitStep = Math.min(od, speed * dt);
      if (od > 1e-8) { x += ox / od * orbitStep; y += oy / od * orbitStep; }
      // Face the prey while strafing around it.
      enemy.angle = Math.atan2(Number(target.y) - y, Number(target.x) - x);
    }
    x = clamp(x, Number.isFinite(options.minX) ? options.minX : 0, Number.isFinite(options.maxX) ? options.maxX : WORLD_WIDTH);
    y = clamp(y, Number.isFinite(options.minY) ? options.minY : 0, Number.isFinite(options.maxY) ? options.maxY : WORLD_HEIGHT);
    enemy.x = x; enemy.y = y;
    enemy.vx = (x - oldX) / Math.max(dt, 0.001);
    enemy.vy = (y - oldY) / Math.max(dt, 0.001);
    return { moved: Math.abs(x - oldX) > 1e-8 || Math.abs(y - oldY) > 1e-8, target, distance, dx, dy };
  }

  return { WORLD_WIDTH, WORLD_HEIGHT, WORLD_ZOOM, BOSS_KINDS, ENEMY_STATS, statsForKind, xpOrbRadius, chooseCommonKind, chooseBossKind, chooseSpawnPoint, krakenTentaclePose, touchesKrakenTentacle, moveTowardTarget };
});
