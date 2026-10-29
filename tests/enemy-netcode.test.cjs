const test = require('node:test');
const assert = require('node:assert/strict');
const { createMotionWatchdog } = require('../public/enemy-netcode.js');

function enemyFrame(positions) { return positions.map(([id, x, y]) => ({ id, x, y })); }

test('the online presentation predicts enemy movement when server snapshots are static', () => {
  const watch = createMotionWatchdog({ stallAfter: 3, resumeAfter: 4, healthyRatio: 0.18, motionEpsilon: 0.35 });
  const frame = enemyFrame([[1, 100, 100], [2, 200, 200], [3, 300, 300], [4, 400, 400]]);
  watch.observe(frame);
  watch.observe(frame);
  const result = watch.observe(frame);
  assert.equal(result.predicting, true, 'static server snapshots must activate local shared-AI prediction');
  assert.equal(result.stalledStreak, 3);
});

test('the watchdog reports a sustained healthy server snapshot stream', () => {
  const watch = createMotionWatchdog({ stallAfter: 3, resumeAfter: 4, healthyRatio: 0.18, motionEpsilon: 0.35 });
  let frame = enemyFrame([[1, 100, 100], [2, 200, 200], [3, 300, 300], [4, 400, 400]]);
  watch.observe(frame);
  for (let i = 0; i < 3; i++) {
    frame = frame.map(e => ({ ...e, x: e.x + 4 }));
    assert.equal(watch.observe(frame).predicting, true, 'one or two moving snapshots must not prematurely disable prediction');
  }
  frame = frame.map(e => ({ ...e, x: e.x + 4 }));
  assert.equal(watch.observe(frame).predicting, false, 'four consecutive healthy snapshots restore authoritative interpolation');
});

test('one moving monster cannot hide a frozen horde', () => {
  const watch = createMotionWatchdog({ stallAfter: 3, resumeAfter: 4, healthyRatio: 0.5, motionEpsilon: 0.35 });
  let frame = enemyFrame([[1, 100, 100], [2, 200, 200], [3, 300, 300], [4, 400, 400]]);
  watch.observe(frame);
  frame = frame.map((e, i) => ({ ...e, x: e.x + (i === 0 ? 5 : 0) }));
  watch.observe(frame); watch.observe(frame);
  const result = watch.observe(frame);
  assert.equal(result.predicting, true);
  assert.ok(result.ratio < 0.5);
});


test('first online snapshot seeds spawn coordinates without a hard render target', () => {
  const { reconcileSnapshot } = require('../public/enemy-netcode.js');
  const first = reconcileSnapshot([], [{ id: 11, kind: 'drifter', x: 250, y: 300, r: 10, hp: 22, maxHp: 22 }], { radiusScale: 1 / 0.78 });
  assert.equal(first.length, 1);
  assert.equal(first[0].x, 250);
  assert.equal(first[0].y, 300);
  assert.equal(Number.isFinite(first[0].interpTargetX), false, 'renderer must not reset a new enemy to its spawn every frame');
  assert.equal(Number.isFinite(first[0].interpTargetY), false);
});

test('new server snapshots update gameplay fields without resetting locally predicted x/y', () => {
  const { reconcileSnapshot } = require('../public/enemy-netcode.js');
  const local = [{ id: 11, kind: 'drifter', x: 440, y: 510, r: 12, hp: 22, maxHp: 22, interpTargetX: NaN, interpTargetY: NaN }];
  const next = reconcileSnapshot(local, [{ id: 11, kind: 'drifter', x: 250, y: 300, r: 10, hp: 8, maxHp: 22 }], { radiusScale: 1 / 0.78 });
  assert.equal(next[0].x, 440);
  assert.equal(next[0].y, 510);
  assert.equal(next[0].hp, 8);
  assert.equal(next[0].serverX, 250);
  assert.equal(next[0].serverY, 300);
  assert.equal(Number.isFinite(next[0].interpTargetX), false);
});

test('predicted enemy keeps moving after repeated identical server snapshots', () => {
  const { reconcileSnapshot } = require('../public/enemy-netcode.js');
  const AI = require('../public/enemy-ai.js');
  const serverSnapshot = [{ id: 25, kind: 'drifter', x: 260, y: 320, r: 10, speed: AI.statsForKind('drifter').speed / AI.WORLD_ZOOM, hp: 22, maxHp: 22, phase: 0 }];
  let local = reconcileSnapshot([], serverSnapshot, { radiusScale: 1 / AI.WORLD_ZOOM });
  const player = { x: 1800, y: 1100 };
  AI.moveTowardTarget(local[0], [player], 0.05, { minX: 0, maxX: AI.WORLD_WIDTH, minY: 0, maxY: AI.WORLD_HEIGHT, stopDistance: 28 });
  const once = { x: local[0].x, y: local[0].y };
  local = reconcileSnapshot(local, serverSnapshot, { radiusScale: 1 / AI.WORLD_ZOOM });
  assert.equal(local[0].x, once.x, 'identical server snapshot must not roll local visual position back to spawn');
  assert.equal(local[0].y, once.y);
  AI.moveTowardTarget(local[0], [player], 0.05, { minX: 0, maxX: AI.WORLD_WIDTH, minY: 0, maxY: AI.WORLD_HEIGHT, stopDistance: 28 });
  assert.ok(Math.hypot(local[0].x - once.x, local[0].y - once.y) > 0.1, 'shared AI should continue advancing after snapshot reconciliation');
});


test('a delayed older snapshot cannot restore HP after a confirmed server hit', () => {
  const { reconcileSnapshot } = require('../public/enemy-netcode.js');
  const damaged = [{ id: 81, kind: 'drifter', x: 420, y: 530, r: 10, hp: 12, maxHp: 22, damageRevision: 2 }];
  const delayed = reconcileSnapshot(damaged, [{ id: 81, kind: 'drifter', x: 250, y: 300, r: 10, hp: 22, maxHp: 22, damageRevision: 1 }], { radiusScale: 1 / 0.78 });
  assert.equal(delayed[0].hp, 12, 'older snapshots must not make a damaged enemy immortal again');
  assert.equal(delayed[0].damageRevision, 2);
  const fresh = reconcileSnapshot(delayed, [{ id: 81, kind: 'drifter', x: 240, y: 290, r: 10, hp: 7, maxHp: 22, damageRevision: 3 }], { radiusScale: 1 / 0.78 });
  assert.equal(fresh[0].hp, 7, 'newer server revisions may update authoritative health');
  assert.equal(fresh[0].damageRevision, 3);
});
