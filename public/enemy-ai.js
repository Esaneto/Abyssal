/* Shared enemy pursuit logic for solo rendering and the online authoritative world.
 * Positions are world units on the client; the server can use normalized coordinates
 * by setting `normalized: true` and supplying the world dimensions.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AbyssalEnemyAI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function moveTowardTarget(enemy, targets, dt, options = {}) {
    if (!enemy || !Array.isArray(targets) || !targets.length || !Number.isFinite(dt) || dt <= 0) {
      return { moved: false, target: null, distance: Infinity };
    }

    const normalized = Boolean(options.normalized);
    const worldWidth = normalized ? Math.max(1, Number(options.worldWidth) || 1) : 1;
    const worldHeight = normalized ? Math.max(1, Number(options.worldHeight) || 1) : 1;
    let target = null;
    let dx = 0;
    let dy = 0;
    let distance = Infinity;

    for (const candidate of targets) {
      if (!candidate || !Number.isFinite(Number(candidate.x)) || !Number.isFinite(Number(candidate.y))) continue;
      const cx = (Number(candidate.x) - Number(enemy.x)) * worldWidth;
      const cy = (Number(candidate.y) - Number(enemy.y)) * worldHeight;
      const d = Math.hypot(cx, cy);
      if (d < distance) {
        distance = d;
        dx = cx;
        dy = cy;
        target = candidate;
      }
    }

    if (!target || !Number.isFinite(distance)) return { moved: false, target: null, distance: Infinity };

    enemy.angle = Math.atan2(dy, dx);
    enemy.phase = (Number(enemy.phase) || 0) + dt * (enemy.kind === 'stinger' ? 7 : 3);
    const speed = Math.max(0, Number(enemy.speed) || 0);
    const stopDistance = Math.max(0, Number(options.stopDistance) || 0);
    let moved = false;

    if (distance > stopDistance && speed > 0) {
      const step = Math.min(distance - stopDistance, speed * dt);
      const oldX = Number(enemy.x) || 0;
      const oldY = Number(enemy.y) || 0;
      const minX = Number.isFinite(options.minX) ? options.minX : -Infinity;
      const maxX = Number.isFinite(options.maxX) ? options.maxX : Infinity;
      const minY = Number.isFinite(options.minY) ? options.minY : -Infinity;
      const maxY = Number.isFinite(options.maxY) ? options.maxY : Infinity;
      enemy.x = clamp(oldX + (dx / (distance || 1)) * step / worldWidth, minX, maxX);
      enemy.y = clamp(oldY + (dy / (distance || 1)) * step / worldHeight, minY, maxY);
      enemy.vx = (enemy.x - oldX) / Math.max(dt, 0.001);
      enemy.vy = (enemy.y - oldY) / Math.max(dt, 0.001);
      moved = Math.abs(enemy.x - oldX) > 1e-10 || Math.abs(enemy.y - oldY) > 1e-10;
    } else {
      enemy.vx = 0;
      enemy.vy = 0;
    }

    return { moved, target, distance, dx, dy };
  }

  return { moveTowardTarget };
});
