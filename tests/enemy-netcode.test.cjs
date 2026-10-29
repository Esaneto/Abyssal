const test = require('node:test');
const assert = require('node:assert/strict');
const { createMotionWatchdog, reconcileSnapshot, renderedPosition } = require('../public/enemy-netcode.js');

function enemyFrame(positions) { return positions.map(([id, x, y]) => ({ id, x, y })); }

test('motion watchdog diagnoses static snapshots without enabling a second client simulation', () => {
  const watch = createMotionWatchdog({ stallAfter: 3, resumeAfter: 4, healthyRatio: 0.18, motionEpsilon: 0.35 });
  const frame = enemyFrame([[1, 100, 100], [2, 200, 200], [3, 300, 300], [4, 400, 400]]);
  watch.observe(frame); watch.observe(frame); const result = watch.observe(frame);
  assert.equal(result.stalledStreak, 3);
  assert.equal(result.moved, 0);
  assert.equal(result.predicting, false, 'server-authoritative mode never falls back to duplicate local movement');
});

test('watchdog reports a healthy server snapshot stream', () => {
  const watch = createMotionWatchdog({ motionEpsilon: .35, healthyRatio: .18, resumeAfter: 4, stallAfter: 3 });
  let frame = enemyFrame([[1, 100, 100], [2, 200, 200]]); watch.observe(frame);
  for (let i=0;i<4;i++) { frame=frame.map(e=>({...e,x:e.x+4})); watch.observe(frame); }
  assert.equal(watch.diagnostics.moved, 2);
  assert.equal(watch.diagnostics.ratio, 1);
  assert.equal(watch.predicting, false);
});

test('first snapshot seeds enemy exactly at authoritative server coordinates', () => {
  const first = reconcileSnapshot([], [{ id: 11, kind: 'drifter', x: 250, y: 300, r: 10, hp: 22, maxHp: 22 }], { radiusScale: 1 / .78, now: 10 });
  assert.equal(first.length, 1);
  assert.equal(first[0].x, 250); assert.equal(first[0].y, 300);
  assert.equal(first[0].interpTargetX, 250); assert.equal(first[0].interpTargetY, 300);
  assert.equal(first[0].interpDuration, 0);
  assert.equal(first[0].authoritativePosition, true);
});

test('new server coordinates are smoothly interpolated instead of being left at a divergent client prediction', () => {
  const first = reconcileSnapshot([], [{ id: 11, kind: 'drifter', x: 250, y: 300, r: 10, hp: 22, maxHp: 22 }], { radiusScale: 1 / .78, now: 10 });
  const second = reconcileSnapshot(first, [{ id: 11, kind: 'drifter', x: 450, y: 500, r: 10, hp: 8, maxHp: 22 }], { radiusScale: 1 / .78, now: 110, interpolationMs: 100 });
  assert.equal(second[0].x, 250); assert.equal(second[0].y, 300, 'interpolation starts from last displayed position');
  assert.equal(second[0].interpTargetX, 450); assert.equal(second[0].interpTargetY, 500);
  assert.equal(second[0].hp, 8);
  const halfway = renderedPosition(second[0], 160);
  assert.equal(halfway.x, 350); assert.equal(halfway.y, 400);
  const arrived = renderedPosition(second[0], 220);
  assert.equal(arrived.x, 450); assert.equal(arrived.y, 500);
});

test('repeated snapshots converge to the latest authoritative position without a ghost hit position', () => {
  let state = reconcileSnapshot([], [{ id: 25, kind: 'drifter', x: 260, y: 320, r: 10, hp: 22, maxHp: 22 }], { now: 0 });
  state = reconcileSnapshot(state, [{ id: 25, kind: 'drifter', x: 360, y: 320, r: 10, hp: 22, maxHp: 22 }], { now: 100, interpolationMs: 100 });
  const midway = renderedPosition(state[0], 150);
  assert.equal(midway.x, 310);
  const next = reconcileSnapshot([{...state[0],x:midway.x,y:midway.y}], [{ id: 25, kind: 'drifter', x: 420, y: 320, r: 10, hp: 22, maxHp: 22 }], { now: 150, interpolationMs: 100 });
  assert.equal(next[0].interpFromX, 310);
  assert.equal(next[0].interpTargetX, 420);
  assert.equal(renderedPosition(next[0], 250).x, 420);
});

test('a delayed older snapshot cannot restore HP after a confirmed server hit', () => {
  const damaged = [{ id: 81, kind: 'drifter', x: 420, y: 530, r: 10, hp: 12, maxHp: 22, damageRevision: 2, interpFromX: 420, interpFromY:530, interpTargetX:420,interpTargetY:530,interpAt:10,interpDuration:0 }];
  const delayed = reconcileSnapshot(damaged, [{ id: 81, kind: 'drifter', x: 250, y: 300, r: 10, hp: 22, maxHp: 22, damageRevision: 1 }], { radiusScale: 1 / .78, now: 20 });
  assert.equal(delayed[0].hp, 12);
  assert.equal(delayed[0].damageRevision, 2);
  const fresh = reconcileSnapshot(delayed, [{ id: 81, kind: 'drifter', x: 240, y: 290, r: 10, hp: 7, maxHp: 22, damageRevision: 3 }], { radiusScale: 1 / .78, now: 30 });
  assert.equal(fresh[0].hp, 7);
  assert.equal(fresh[0].damageRevision, 3);
});
