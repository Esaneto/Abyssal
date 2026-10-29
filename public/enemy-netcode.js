/*
 * Abyssal enemy snapshot watchdog.
 * The server remains authoritative for enemy creation, health and kills. The client
 * predicts the shared AI for presentation until authoritative snapshots prove that
 * a meaningful portion of the horde is moving. This prevents a frozen snapshot stream
 * from freezing every creature on screen.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AbyssalEnemyNetcode = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createMotionWatchdog(options = {}) {
    const motionEpsilon = Math.max(0.05, Number(options.motionEpsilon) || 0.35);
    const healthyRatio = Math.max(0.05, Math.min(1, Number(options.healthyRatio) || 0.18));
    const resumeAfter = Math.max(2, Math.floor(Number(options.resumeAfter) || 4));
    const stallAfter = Math.max(2, Math.floor(Number(options.stallAfter) || 3));
    let previous = new Map();
    let predicting = true;
    let healthyStreak = 0;
    let stalledStreak = 0;
    let lastMetrics = { predicting: true, compared: 0, moved: 0, ratio: 0, healthyStreak: 0, stalledStreak: 0 };

    function reset() {
      previous = new Map();
      predicting = true;
      healthyStreak = 0;
      stalledStreak = 0;
      lastMetrics = { predicting, compared: 0, moved: 0, ratio: 0, healthyStreak, stalledStreak };
      return lastMetrics;
    }

    function observe(enemies) {
      const list = Array.isArray(enemies) ? enemies : [];
      const next = new Map();
      let compared = 0;
      let moved = 0;
      for (const enemy of list) {
        if (!enemy || enemy.id == null) continue;
        const x = Number(enemy.x), y = Number(enemy.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        next.set(enemy.id, { x, y });
        const old = previous.get(enemy.id);
        if (!old) continue;
        compared++;
        if (Math.hypot(x - old.x, y - old.y) >= motionEpsilon) moved++;
      }
      previous = next;
      const ratio = compared ? moved / compared : 0;
      // Use hysteresis. A single moving creature must not mask a frozen horde.
      if (compared > 0 && ratio >= healthyRatio) {
        healthyStreak++;
        stalledStreak = 0;
        if (healthyStreak >= resumeAfter) predicting = false;
      } else {
        healthyStreak = 0;
        stalledStreak++;
        if (stalledStreak >= stallAfter) predicting = true;
      }
      lastMetrics = { predicting, compared, moved, ratio, healthyStreak, stalledStreak };
      return lastMetrics;
    }

    return {
      observe,
      reset,
      get predicting() { return predicting; },
      get diagnostics() { return { ...lastMetrics }; }
    };
  }

  /**
   * Merge an authoritative enemy snapshot into the local presentation state.
   * The first snapshot seeds a new creature's world position. Later snapshots update
   * gameplay fields (HP, kind, color, deaths/spawns) but NEVER overwrite local x/y.
   * Both modes then advance x/y through the same shared enemy AI each render update.
   * `interpTargetX/Y` must be NaN: game.js's renderer treats finite values as a hard
   * target and would otherwise put a newly spawned enemy back at its spawn every frame.
   */
  function reconcileSnapshot(previousEnemies, incomingEnemies, options = {}) {
    const previous = new Map((Array.isArray(previousEnemies) ? previousEnemies : []).map(e => [e.id, e]));
    const radiusScale = Number.isFinite(Number(options.radiusScale)) ? Number(options.radiusScale) : 1;
    const maxX = Number.isFinite(Number(options.maxX)) ? Number(options.maxX) : 3600;
    const maxY = Number.isFinite(Number(options.maxY)) ? Number(options.maxY) : 2200;
    const minX = Number.isFinite(Number(options.minX)) ? Number(options.minX) : 0;
    const minY = Number.isFinite(Number(options.minY)) ? Number(options.minY) : 0;
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
    const list = Array.isArray(incomingEnemies) ? incomingEnemies : [];
    return list.filter(e => e && e.id != null).map(raw => {
      const old = previous.get(raw.id);
      const serverX = clamp(Number(raw.x) || 0, minX, maxX);
      const serverY = clamp(Number(raw.y) || 0, minY, maxY);
      const localX = old && Number.isFinite(Number(old.x)) ? Number(old.x) : serverX;
      const localY = old && Number.isFinite(Number(old.y)) ? Number(old.y) : serverY;
      const oldDamageRevision = Math.max(0, Number(old?.damageRevision) || 0);
      const incomingDamageRevision = Math.max(0, Number(raw.damageRevision) || 0);
      // A delayed snapshot is allowed to move no local coordinates and must not undo
      // an HP update that was already confirmed by the reliable damage event/ACK.
      const preserveConfirmedHealth = Boolean(old && oldDamageRevision > incomingDamageRevision);
      return {
        ...(old || {}),
        ...raw,
        hp: preserveConfirmedHealth ? old.hp : raw.hp,
        damageRevision: Math.max(oldDamageRevision, incomingDamageRevision),
        x: localX,
        y: localY,
        r: Math.max(2, Number(raw.r) || 12) * radiusScale,
        serverX,
        serverY,
        interpFromX: NaN,
        interpFromY: NaN,
        interpTargetX: NaN,
        interpTargetY: NaN,
        interpAt: NaN,
        interpDuration: 0
      };
    });
  }

  return { createMotionWatchdog, reconcileSnapshot };
});
