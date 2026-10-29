/* Authoritative enemy snapshots + diagnostic watchdog for Abyssal co-op. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AbyssalEnemyNetcode = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  // Snapshot delivery is intentionally lossy for routine positions. Keep the latest
  // authoritative velocity moving the sprite briefly through a dropped packet, then
  // stop extrapolation quickly so hit geometry does not diverge from the server.
  const MAX_EXTRAPOLATION_MS = 180;

  function createMotionWatchdog(options = {}) {
    const motionEpsilon = Math.max(0.05, Number(options.motionEpsilon) || 0.35);
    const healthyRatio = Math.max(0.05, Math.min(1, Number(options.healthyRatio) || 0.18));
    const resumeAfter = Math.max(2, Math.floor(Number(options.resumeAfter) || 4));
    const stallAfter = Math.max(2, Math.floor(Number(options.stallAfter) || 3));
    let previous = new Map();
    let predicting = false;
    let healthyStreak = 0;
    let stalledStreak = 0;
    let lastMetrics = { predicting, compared: 0, moved: 0, ratio: 0, healthyStreak, stalledStreak };
    function reset() {
      previous = new Map(); predicting = false; healthyStreak = 0; stalledStreak = 0;
      lastMetrics = { predicting, compared: 0, moved: 0, ratio: 0, healthyStreak, stalledStreak };
      return lastMetrics;
    }
    function observe(enemies) {
      const list = Array.isArray(enemies) ? enemies : [];
      const next = new Map(); let compared = 0, moved = 0;
      for (const enemy of list) {
        if (!enemy || enemy.id == null) continue;
        const x = Number(enemy.x), y = Number(enemy.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        next.set(enemy.id, { x, y });
        const old = previous.get(enemy.id); if (!old) continue;
        compared++;
        if (Math.hypot(x - old.x, y - old.y) >= motionEpsilon) moved++;
      }
      previous = next;
      const ratio = compared ? moved / compared : 0;
      if (compared > 0 && ratio >= healthyRatio) {
        healthyStreak++; stalledStreak = 0;
        if (healthyStreak >= resumeAfter) predicting = false;
      } else {
        healthyStreak = 0; stalledStreak++;
      }
      lastMetrics = { predicting, compared, moved, ratio, healthyStreak, stalledStreak };
      return lastMetrics;
    }
    return { observe, reset, get predicting() { return predicting; }, get diagnostics() { return { ...lastMetrics }; } };
  }

  function renderedPosition(enemy, now) {
    if (!enemy) return { x: 0, y: 0 };
    const x = Number(enemy.x), y = Number(enemy.y);
    const fromX = Number(enemy.interpFromX), fromY = Number(enemy.interpFromY);
    const toX = Number(enemy.interpTargetX), toY = Number(enemy.interpTargetY);
    const at = Number(enemy.interpAt), duration = Number(enemy.interpDuration);
    if ([fromX, fromY, toX, toY, at, duration].every(Number.isFinite) && duration > 0) {
      const elapsed = Math.max(0, now - at);
      if (elapsed <= duration) {
        const t = clamp(elapsed / duration, 0, 1);
        return { x: fromX + (toX - fromX) * t, y: fromY + (toY - fromY) * t };
      }
      const extraSeconds = Math.min(MAX_EXTRAPOLATION_MS, elapsed - duration) / 1000;
      const vx = clamp(Number(enemy.vx) || 0, -220, 220);
      const vy = clamp(Number(enemy.vy) || 0, -220, 220);
      return { x: toX + vx * extraSeconds, y: toY + vy * extraSeconds };
    }
    if (Number.isFinite(toX) && Number.isFinite(toY)) return { x: toX, y: toY };
    return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
  }

  /**
   * Co-op has one source of truth: server positions. Keep the previous rendered point
   * as the interpolation origin and approach each new server snapshot over one tick.
   * This deliberately disables the second, divergent client-side enemy simulation,
   * which could put sprites away from the server position used for contact damage.
   */
  function reconcileSnapshot(previousEnemies, incomingEnemies, options = {}) {
    const previous = new Map((Array.isArray(previousEnemies) ? previousEnemies : []).map(e => [String(e.id), e]));
    const radiusScale = Number.isFinite(Number(options.radiusScale)) ? Number(options.radiusScale) : 1;
    const maxX = Number.isFinite(Number(options.maxX)) ? Number(options.maxX) : 3600;
    const maxY = Number.isFinite(Number(options.maxY)) ? Number(options.maxY) : 2200;
    const minX = Number.isFinite(Number(options.minX)) ? Number(options.minX) : 0;
    const minY = Number.isFinite(Number(options.minY)) ? Number(options.minY) : 0;
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const interpolationMs = clamp(Number(options.interpolationMs) || 100, 50, 160);
    const list = Array.isArray(incomingEnemies) ? incomingEnemies : [];
    const criticalIds = new Set((Array.isArray(options.criticalIds) ? options.criticalIds : []).map(String));
    return list.filter(raw => raw && raw.id != null).map(raw => {
      const old = previous.get(String(raw.id));
      const serverX = clamp(Number(raw.x) || 0, minX, maxX);
      const serverY = clamp(Number(raw.y) || 0, minY, maxY);
      const critical = criticalIds.has(String(raw.id));
      const current = old && !critical ? renderedPosition(old, now) : { x: serverX, y: serverY };
      const oldDamageRevision = Math.max(0, Number(old?.damageRevision) || 0);
      const incomingDamageRevision = Math.max(0, Number(raw.damageRevision) || 0);
      const preserveConfirmedHealth = Boolean(old && oldDamageRevision > incomingDamageRevision);
      return {
        ...(old || {}), ...raw,
        hp: preserveConfirmedHealth ? old.hp : raw.hp,
        damageRevision: Math.max(oldDamageRevision, incomingDamageRevision),
        x: current.x, y: current.y,
        r: Math.max(2, Number(raw.r) || 12) * radiusScale,
        serverX, serverY,
        interpFromX: current.x, interpFromY: current.y,
        interpTargetX: serverX, interpTargetY: serverY,
        interpAt: now,
        interpDuration: old && !critical ? interpolationMs : 0,
        snapshotReceivedAt: now,
        authoritativePosition: true
      };
    });
  }
  return { createMotionWatchdog, reconcileSnapshot, renderedPosition, MAX_EXTRAPOLATION_MS };
});
