const test = require('node:test');
const assert = require('node:assert/strict');
const { moveTowardTarget } = require('../public/enemy-ai.js');

test('server normalized pursuit moves toward a target', () => {
  const enemy = { x: 0.04, y: 0.06, speed: 65, kind: 'drifter', phase: 0 };
  const target = { x: 0.5, y: 0.5, local: true };
  const start = { x: enemy.x, y: enemy.y };
  let moved = 0;
  for (let i = 0; i < 20; i++) {
    if (moveTowardTarget(enemy, [target], 0.05, { normalized: true, worldWidth: 3600, worldHeight: 2200, minX: .008, maxX: .992, minY: .008, maxY: .992 }).moved) moved++;
  }
  assert.equal(moved, 20);
  const dx = (enemy.x - start.x) * 3600;
  const dy = (enemy.y - start.y) * 2200;
  assert.ok(dx > 0 && dy > 0);
  assert.ok(Math.hypot(dx, dy) > 60 && Math.hypot(dx, dy) < 66);
});

test('solo world-unit pursuit uses the same speed as normalized online pursuit', () => {
  const online = { x: 0.04, y: 0.06, speed: 65, kind: 'drifter', phase: 0 };
  const solo = { x: 0.04 * 3600, y: 0.06 * 2200, speed: 65, kind: 'drifter', phase: 0 };
  const onlineTarget = { x: 0.5, y: 0.5 };
  const soloTarget = { x: 0.5 * 3600, y: 0.5 * 2200 };
  for (let i = 0; i < 20; i++) {
    moveTowardTarget(online, [onlineTarget], 0.05, { normalized: true, worldWidth: 3600, worldHeight: 2200, minX: .008, maxX: .992, minY: .008, maxY: .992 });
    moveTowardTarget(solo, [soloTarget], 0.05, { normalized: false, minX: 0, maxX: 3600, minY: 0, maxY: 2200 });
  }
  assert.ok(Math.abs(online.x * 3600 - solo.x) < 1e-8);
  assert.ok(Math.abs(online.y * 2200 - solo.y) < 1e-8);
});

test('enemy stops changing when target is already at the same point', () => {
  const enemy = { x: 1800, y: 1100, speed: 65, kind: 'drifter', phase: 0 };
  const result = moveTowardTarget(enemy, [{ x: 1800, y: 1100 }], 0.05, { normalized: false, minX: 0, maxX: 3600, minY: 0, maxY: 2200 });
  assert.equal(result.moved, false);
  assert.equal(enemy.x, 1800);
  assert.equal(enemy.y, 1100);
});
