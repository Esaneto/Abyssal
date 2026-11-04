const test = require('node:test');
const assert = require('node:assert/strict');
const AI = require('../public/enemy-ai.js');

const { moveTowardTarget } = AI;

test('expanded arena bounds are shared with the solo and online world engine', () => {
  assert.equal(AI.WORLD_WIDTH, 4800);
  assert.equal(AI.WORLD_HEIGHT, 3000);
});

test('shared pursuit moves an enemy toward the nearest player in world coordinates', () => {
  const enemy = { x: 150, y: 150, speed: 65, kind: 'drifter', phase: 0 };
  const target = { x: 1800, y: 1100 };
  const startDistance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
  for (let i = 0; i < 20; i++) moveTowardTarget(enemy, [target], 0.05, { minX: 0, maxX: AI.WORLD_WIDTH, minY: 0, maxY: AI.WORLD_HEIGHT });
  const finalDistance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
  assert.ok(finalDistance < startDistance);
  assert.ok(Math.hypot(enemy.x - 150, enemy.y - 150) > 0);
  assert.ok(Math.hypot(enemy.x - 150, enemy.y - 150) <= 65 * 0.85);
});

test('solo and online call the exact same movement function and speed units', () => {
  const solo = { x: 120, y: 220, speed: AI.statsForKind('drifter').speed / AI.WORLD_ZOOM, kind: 'drifter', phase: 0 };
  const online = { ...solo };
  const targets = [{ x: 1900, y: 1000 }];
  for (let i = 0; i < 30; i++) {
    moveTowardTarget(solo, targets, 0.05, { minX: 0, maxX: AI.WORLD_WIDTH, minY: 0, maxY: AI.WORLD_HEIGHT });
    moveTowardTarget(online, targets, 0.05, { minX: 0, maxX: AI.WORLD_WIDTH, minY: 0, maxY: AI.WORLD_HEIGHT });
  }
  assert.equal(online.x, solo.x);
  assert.equal(online.y, solo.y);
  assert.equal(online.angle, solo.angle);
});


test('steering remains bounded and smooth during long sessions and target changes', () => {
  const enemy = { id: 91, x: 200, y: 200, speed: 90, kind: 'drifter', phase: 0, vx: 0, vy: 0 };
  let previousTurn = 0;
  for (let i = 0; i < 12000; i++) {
    const target = i < 6000 ? { x: 4200, y: 2500 } : { x: 250, y: 2700 };
    const before = { x: enemy.x, y: enemy.y };
    moveTowardTarget(enemy, [target], 1 / 60, { minX: 8, maxX: AI.WORLD_WIDTH - 8, minY: 8, maxY: AI.WORLD_HEIGHT - 8 });
    const step = Math.hypot(enemy.x - before.x, enemy.y - before.y);
    assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.y));
    assert.ok(step <= 90 * 0.85 / 60 + 1e-6);
    const turn = Math.hypot(enemy.vx, enemy.vy);
    assert.ok(Number.isFinite(turn) && turn <= 90 * 0.85 + 1e-6);
    previousTurn = turn;
  }
  assert.ok(enemy.x >= 8 && enemy.x <= AI.WORLD_WIDTH - 8);
  assert.ok(enemy.y >= 8 && enemy.y <= AI.WORLD_HEIGHT - 8);
});

test('enemy switches naturally to the nearest player', () => {
  const enemy = { x: 100, y: 100, speed: 80, kind: 'stinger', phase: 0 };
  const near = { x: 400, y: 110 };
  const far = { x: 3400, y: 2000 };
  const result = moveTowardTarget(enemy, [far, near], 0.05, { minX: 0, maxX: AI.WORLD_WIDTH, minY: 0, maxY: AI.WORLD_HEIGHT });
  assert.equal(result.target, near);
  assert.ok(enemy.x > 100 && enemy.y > 100);
});

test('enemy stops without coordinate drift if the target is exactly at its location', () => {
  const enemy = { x: 1800, y: 1100, speed: 65, kind: 'drifter', phase: 0 };
  const result = moveTowardTarget(enemy, [{ x: 1800, y: 1100 }], 0.05, { minX: 0, maxX: AI.WORLD_WIDTH, minY: 0, maxY: AI.WORLD_HEIGHT });
  assert.equal(result.moved, false);
  assert.equal(enemy.x, 1800);
  assert.equal(enemy.y, 1100);
});

test('shared catalog stats are stable and available to both modes', () => {
  assert.deepEqual(AI.statsForKind('drifter'), { r:10,hp:22,speed:51,damage:8,color:'#ff769d',value:1 });
  assert.deepEqual(AI.statsForKind('leviathan'), { r:54,hp:9400,speed:44,damage:34,color:'#4ce0d1',value:90 });
  assert.equal(AI.statsForKind('whiteShark').dashSpeed,300);
  assert.equal(AI.statsForKind('whiteSharkBoss').dashSpeed,350);
  assert.equal(AI.statsForKind('whiteSharkBoss').hp,12000);
});


test('an enemy at contact distance continues orbital movement with the shared solo AI', () => {
  const enemy = { id: 19, x: 1800, y: 1100, speed: 65, kind: 'drifter', phase: 0 };
  const target = { x: 1800, y: 1100 };
  const result = moveTowardTarget(enemy, [target], 0.05, { minX: 0, maxX: AI.WORLD_WIDTH, minY: 0, maxY: AI.WORLD_HEIGHT, stopDistance: 28 });
  assert.equal(result.moved, true);
  assert.ok(Math.hypot(enemy.x - target.x, enemy.y - target.y) > 0);
});


test('movement AI can reuse a caller-owned result object without changing behavior', () => {
  const enemy = { x: 100, y: 100, speed: 80, kind: 'stinger', phase: 0 };
  const result = {};
  const target = { x: 400, y: 110 };
  const first = moveTowardTarget(enemy, [target], 0.05, { minX: 0, maxX: AI.WORLD_WIDTH, minY: 0, maxY: AI.WORLD_HEIGHT }, result);
  assert.strictEqual(first, result);
  assert.equal(first.target, target);
  assert.equal(first.moved, true);
  const previousX = enemy.x;
  const second = moveTowardTarget(enemy, [target], 0.05, { minX: 0, maxX: AI.WORLD_WIDTH, minY: 0, maxY: AI.WORLD_HEIGHT }, result);
  assert.strictEqual(second, result);
  assert.ok(enemy.x > previousX);
});
