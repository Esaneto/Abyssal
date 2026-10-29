const test = require('node:test');
const assert = require('node:assert/strict');
const AI = require('../public/enemy-ai.js');

const { moveTowardTarget } = AI;

test('shared pursuit moves an enemy toward the nearest player in world coordinates', () => {
  const enemy = { x: 150, y: 150, speed: 65, kind: 'drifter', phase: 0 };
  const target = { x: 1800, y: 1100 };
  const startDistance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
  for (let i = 0; i < 20; i++) moveTowardTarget(enemy, [target], 0.05, { minX: 0, maxX: AI.WORLD_WIDTH, minY: 0, maxY: AI.WORLD_HEIGHT });
  const finalDistance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
  assert.ok(finalDistance < startDistance);
  assert.ok(Math.abs(Math.hypot(enemy.x - 150, enemy.y - 150) - 65) < 1e-6);
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
  assert.deepEqual(AI.statsForKind('leviathan'), { r:54,hp:4700,speed:16,damage:34,color:'#4ce0d1',value:90 });
});
