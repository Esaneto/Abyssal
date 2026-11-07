const test = require('node:test');
const assert = require('node:assert/strict');
const AI = require('../public/enemy-ai.js');
const Sim = require('../world-simulation.js');
const CaveMap = require('../public/abyssal-map.js');

test('rift encounters are finite and enter through real walkable cave chambers', () => {
  const world = Sim.createWorldState(1000,'rift');
  world.mapSeed=CaveMap.seedValue('initial-horde-test');
  Sim.initializeWorld(world, 1000, () => 0.25);
  const layout=Sim.mapLayoutFor(world);
  assert.equal(world.enemies.length,0,'unvisited chambers stay dormant');
  const shoal=layout.rooms.find(room=>room.id==='shoal'),player={id:'p',x:shoal.x,y:shoal.y,alive:true,hp:100,maxHp:100};
  Sim.tickWorld(world,[player],1050,()=>.25);
  assert.equal(world.enemies.length,7);
  assert.equal(world.enemies.filter(e=>AI.BOSS_KINDS.includes(e.kind)).length,0);
  assert.equal(world.riftEncountersSeeded,true);
  assert.ok(world.enemies.every(e => CaveMap.isWalkable(layout,e.x,e.y,12)));
  assert.ok(world.enemies.every(e => e.spawnCorner==null));
});

test('authoritative online simulation moves enemies continuously toward a world-unit player', () => {
  const world = Sim.createWorldState(1000);
  Sim.initializeWorld(world, 1000, Math.random);
  const player = { id: 'p1', x: AI.WORLD_WIDTH / 2, y: AI.WORLD_HEIGHT / 2 };
  const first = world.enemies.map(e => ({ id: e.id, x: e.x, y: e.y }));
  for (let i = 1; i <= 20; i++) Sim.tickWorld(world, [player], 1000 + i * 50, Math.random);
  for (const original of first) {
    const next = world.enemies.find(e => e.id === original.id);
    assert.ok(next, `enemy ${original.id} must still exist`);
    assert.ok(Math.hypot(next.x - original.x, next.y - original.y) > 20, `enemy ${original.id} did not move`);
    assert.ok(Math.hypot(player.x - next.x, player.y - next.y) < Math.hypot(player.x - original.x, player.y - original.y), `enemy ${original.id} failed to approach player`);
  }
  assert.ok(world.movingEnemyCount > 0);
});

test('regular mobs keep spawning when bosses are active; boss types never duplicate while alive', () => {
  const world = Sim.createWorldState(1000);
  Sim.initializeWorld(world, 1000, Math.random);
  const player = { id: 'p1', x: AI.WORLD_WIDTH / 2, y: AI.WORLD_HEIGHT / 2 };
  world.elapsed = 59.98; world.nextBossAt = 60; world.commonSpawnTimer = 0;
  Sim.tickWorld(world, [player], 1050, Math.random);
  assert.equal(Sim.countBosses(world).length, 1);
  const bosses = Sim.countBosses(world);
  assert.equal(new Set(bosses.map(e => e.kind)).size, bosses.length);
  const commonsBefore = Sim.countCommons(world);
  for (let i = 1; i <= 30; i++) Sim.tickWorld(world, [player], 1050 + i * 50, Math.random);
  assert.ok(Sim.countCommons(world) > commonsBefore);
  assert.equal(Sim.countBosses(world).length, 1);
});

test('boss HP tiers are ordered from lowest to highest and active bosses cap at four', () => {
  const world = Sim.createWorldState(1000);
  Sim.initializeWorld(world, 1000);
  const bosses = [];
  for (let i = 0; i < 4; i++) bosses.push(Sim.spawnEnemy(world, { type: 'boss', random: () => 0.3 }));
  assert.deepEqual(bosses.map(e => e.kind), ['boss', 'angler', 'maw', 'leviathan']);
  assert.deepEqual(bosses.map(e => e.maxHp), [5640, 6520, 7500, 9400]);
  assert.equal(Sim.countBosses(world).length, 4);
  assert.equal(Sim.spawnEnemy(world, { type: 'boss' }), null);
  assert.equal(new Set(Sim.countBosses(world).map(e => e.kind)).size, 4);
});

test('boss waves spawn only one boss at a time regardless of living player count', () => {
  for (const [count, expected] of [
    [1, ['boss']],
    [2, ['boss']],
    [4, ['boss']],
    [6, ['boss']]
  ]) {
    const now = 1000, world = Sim.createWorldState(now);
    Sim.initializeWorld(world, now, () => 0.1);
    world.elapsed = 60; world.nextBossAt = 60; world.lastTick = now;
    const players = Array.from({length: count}, (_, i) => ({
      id: 'p' + i, alive: true, x: 1700 + i * 40, y: 1100,
      r: 13 / AI.WORLD_ZOOM, moveSpeed: 150 / AI.WORLD_ZOOM,
      skinId: 'default', lastPositionAt: now, hp: 100, maxHp: 100,
      invulnerableUntil: now + 10000, skillSelectingUntil: 0
    }));
    const result = Sim.tickWorld(world, players, now + 50, () => 0.1);
    assert.deepEqual(result.spawnedBosses.map(e => e.kind), expected);
    assert.equal(world.nextBossAt, Infinity);
    Sim.tickWorld(world, players, now + 100, () => 0.1);
    assert.equal(Sim.countBosses(world).length, 1);
  }
});

test('bosses accelerate as health falls but stay below 80 percent of base player speed', () => {
  const baseSpeed = 150 / AI.WORLD_ZOOM;
  const target = { x: 1000, y: 500, r: 13 / AI.WORLD_ZOOM, moveSpeed: baseSpeed, skinId: 'default' };
  const travelSpeed = hp => {
    const enemy = { id: 3, kind: 'boss', x: 500, y: 500, r: 40, speed: 52 / AI.WORLD_ZOOM, hp, maxHp: 2820, angle: 0, phase: 0 };
    const startX = enemy.x;
    AI.moveTowardTarget(enemy, [target], 0.1, {});
    return (enemy.x - startX) / 0.1;
  };
  const fullHealthSpeed = travelSpeed(2820);
  const criticalHealthSpeed = travelSpeed(1);
  assert.ok(criticalHealthSpeed > fullHealthSpeed);
  assert.ok(criticalHealthSpeed < baseSpeed * 0.8);
});

test('empty rooms do not advance time or simulate, and reset releases their enemies', () => {
  const world = Sim.createWorldState(1000);
  Sim.initializeWorld(world, 1000);
  const before = world.elapsed;
  const result = Sim.tickWorld(world, [], 5000);
  assert.equal(result.active, false);
  assert.equal(world.elapsed, before);
  Sim.resetWorldState(world, 6000);
  assert.equal(world.initialized, false);
  assert.equal(world.enemies.length, 0);
  assert.equal(world.elapsed, 0);
});

test('online mobs use the shared contact radius and remain visible beside the player', () => {
  const world = Sim.createWorldState(1000,'rift');
  world.mapSeed=CaveMap.seedValue('contact-range-test');
  world.initialized = true;
  world.lastTick = 1000;
  world.nextBossAt = 99999;
  world.commonSpawnTimer = 99999;
  const room=Sim.mapLayoutFor(world).rooms.find(item=>item.id==='shoal');
  const stats = AI.statsForKind('drifter');
  const enemy = { id: 1, kind: 'drifter', x: room.x-100, y: room.y, r: stats.r, speed: stats.speed / AI.WORLD_ZOOM, hp: stats.hp, maxHp: stats.hp, phase: 0, attackCd: 0 };
  world.enemies = [enemy];
  world.nextEnemyId = 1;
  const player = { id: 'p1', x: room.x, y: room.y, r:13/AI.WORLD_ZOOM, moveSpeed:150/AI.WORLD_ZOOM, alive:true, hp:10000, maxHp:10000 };
  for (let i = 1; i <= 40; i++) Sim.tickWorld(world, [player], 1000 + i * 50, Math.random);
  const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
  const sharedContactRadius = (stats.r + 13 + 8) / AI.WORLD_ZOOM;
  assert.ok(distance > 0, 'enemy must not settle at the exact player coordinate');
  assert.ok(distance < sharedContactRadius, 'enemy remains within contact/damage range');
  assert.ok(distance >= sharedContactRadius * 0.55, 'enemy remains outside the exact player center');
  assert.ok(world.movingEnemyCount > 0, 'enemy continues orbiting instead of freezing after contact');
});


test('a stationary player does not cause the whole online horde to freeze at contact', () => {
  const world = Sim.createWorldState(1000,'rift');
  world.mapSeed=CaveMap.seedValue('stationary-contact-test');
  world.initialized = true;
  world.lastTick = 1000;
  world.nextBossAt = 999999;
  world.commonSpawnTimer = 999999;
  const room=Sim.mapLayoutFor(world).rooms.find(item=>item.id==='shoal');
  const stats = AI.statsForKind('drifter');
  const enemy = { id: 7, kind: 'drifter', x: room.x-100, y: room.y, r: stats.r, speed: stats.speed / AI.WORLD_ZOOM, hp: stats.hp, maxHp: stats.hp, phase: 0, attackCd: 0 };
  world.enemies = [enemy];
  world.nextEnemyId = 7;
  const player = { id: 'p1', x: room.x, y: room.y, r:13/AI.WORLD_ZOOM, moveSpeed:150/AI.WORLD_ZOOM, hp: 10000, maxHp: 10000, alive: true, shieldCharges: 0 };
  for (let i = 1; i <= 700; i++) Sim.tickWorld(world, [player], 1000 + i * 50, Math.random);
  assert.ok(world.movingEnemyCount > 0, 'enemy keeps moving even after reaching a stationary player');
  assert.ok(Math.hypot(enemy.x - player.x, enemy.y - player.y) < (stats.r + 13 + 8) / AI.WORLD_ZOOM, 'enemy remains inside attack distance');
});


test('simulation fallback forces progress if an enemy state is otherwise stationary', () => {
  const world = Sim.createWorldState(1000);
  const stats = AI.statsForKind('drifter');
  const stuck = { id: 12, kind: 'drifter', x: 1800, y: 1100, r: stats.r, speed: 0, hp: stats.hp, maxHp: stats.hp, angle: 0, phase: 0 };
  const player = { id: 'p1', x: 1800, y: 1100 };
  const moved = Sim.forceAdvanceEnemy(stuck, [player], 0.05);
  assert.equal(moved, true);
  assert.ok(Math.hypot(stuck.x - player.x, stuck.y - player.y) > 0);
});


test('authoritative room spawns a boss at the one-minute deadline and makes it available to snapshots', () => {
  const world = Sim.createWorldState(1000);
  Sim.initializeWorld(world, 1000);
  world.elapsed = 59.98;
  world.nextBossAt = 60;
  world.commonSpawnTimer = 999;
  const player = { id: 'p1', x: AI.WORLD_WIDTH / 2, y: AI.WORLD_HEIGHT / 2 };
  const result = Sim.tickWorld(world, [player], 1050, () => 0.31);
  assert.equal(result.spawnedBosses.length, 1, 'a boss must be reported as spawned when the timer crosses 60s');
  const boss = result.spawnedBosses[0];
  assert.ok(AI.BOSS_KINDS.includes(boss.kind));
  assert.ok(world.enemies.some(e => e.id === boss.id), 'boss remains in authoritative world state');
  assert.ok(result.sendSnapshot || result.spawnedBosses.length, 'server has a reason to broadcast the boss immediately');
  assert.equal(world.enemies.length, 4, 'the horde and the new boss coexist');
});


test('server contact radius exactly matches the visible solo sprite collision and reports attack source', () => {
  const stats = AI.statsForKind('drifter');
  const enemy = { id: 91, kind: 'drifter', x: 1000, y: 1000, r: stats.r, speed: stats.speed / AI.WORLD_ZOOM, hp: stats.hp, maxHp: stats.hp, damage: stats.damage, color: stats.color, phase: 0, attackCd: 0 };
  const player = { id: 'p1', x: 1000, y: 1000, r: 13 / AI.WORLD_ZOOM, hp: 100, maxHp: 100, alive: true, shieldCharges: 0, invulnerableUntil: 0, lastPositionAt: 1050, velocityX: 0, velocityY: 0, clientHidden: false };
  const contact = Sim.contactGeometry(enemy, player);
  const expected = enemy.r / AI.WORLD_ZOOM + player.r + 8 / AI.WORLD_ZOOM;
  assert.ok(Math.abs(contact.radius - expected) < 1e-8, 'player radius is not divided by world zoom twice');
  const world = Sim.createWorldState(1000); world.initialized = true; world.lastTick = 1000; world.nextBossAt=999999; world.commonSpawnTimer=999999; world.enemies=[enemy]; world.nextEnemyId=91;
  const result=Sim.tickWorld(world,[player],1050);
  const hit=result.playerHits.find(h=>h.playerId==='p1');
  assert.ok(hit, 'a close enemy should apply contact damage');
  assert.equal(hit.enemyId,91);
  assert.ok(Number.isFinite(hit.enemyX)&&Number.isFinite(hit.enemyY));
  assert.ok(Number.isFinite(hit.contactDistance)&&Number.isFinite(hit.contactRadius));
});

test('Estuarine Bull Shark defense reduces the strengthened authoritative drifter shock', () => {
  const stats=AI.statsForKind('drifter');
  const enemy={id:92,kind:'drifter',x:1000,y:1000,r:stats.r,speed:stats.speed/AI.WORLD_ZOOM,hp:stats.hp,maxHp:stats.hp,damage:20,color:stats.color,phase:0,attackCd:0};
  const player={id:'p-bull-shark',x:1000,y:1000,r:13/AI.WORLD_ZOOM,hp:100,maxHp:100,alive:true,skinId:'abysscroc',shieldCharges:0,invulnerableUntil:0,lastPositionAt:1050,velocityX:0,velocityY:0,clientHidden:false};
  const world=Sim.createWorldState(1000);world.initialized=true;world.lastTick=1000;world.nextBossAt=999999;world.commonSpawnTimer=999999;world.enemies=[enemy];world.nextEnemyId=92;
  const result=Sim.tickWorld(world,[player],1050);
  const hit=result.playerHits.find(row=>row.playerId===player.id);
  assert.equal(hit?.skillId,'bio-shock');
  assert.equal(hit?.damage,19);
  assert.equal(player.hp,81);
});


test('XP orbs spawn at the exact enemy coordinates and bosses drop larger, higher-value orbs', () => {
  const world = Sim.createWorldState(1000);
  const commonStats=AI.statsForKind('drifter'),bossStats=AI.statsForKind('leviathan');
  const common = { id: 10, kind: 'drifter', x: 700, y: 900, r:commonStats.r,value:commonStats.value };
  const boss = { id: 11, kind: 'leviathan', x: 1700, y: 1200, r:bossStats.r,value:bossStats.value };
  const smallOrb = Sim.spawnXpOrb(world, common);
  const bossOrb = Sim.spawnXpOrb(world, boss);
  assert.deepEqual([smallOrb.x, smallOrb.y], [common.x, common.y]);
  assert.deepEqual([bossOrb.x, bossOrb.y], [boss.x, boss.y]);
  assert.ok(smallOrb.value>=common.value);
  assert.ok(bossOrb.value>boss.value);
  assert.ok(bossOrb.r > smallOrb.r, 'stronger enemies create visibly larger XP orbs');
});

test('the authoritative XP-orb pickup awards one player only and removes the orb for everyone', () => {
  const world = Sim.createWorldState(1000);
  world.initialized = true; world.lastTick = 1000; world.nextBossAt = 999999; world.commonSpawnTimer = 999999;
  world.enemies = [];
  world.orbs = [{ id: 77, x: 1000, y: 1000, r: 10, value: 55, phase: 0, life: 25, sourceKind: 'boss' }];
  const first = { id: 'player-a', x: 1000, y: 1000, r: 13 / AI.WORLD_ZOOM, alive: true, hp: 100, maxHp: 100, magnetStrength: 1 };
  const second = { id: 'player-b', x: 1000, y: 1000, r: 13 / AI.WORLD_ZOOM, alive: true, hp: 100, maxHp: 100, magnetStrength: 1 };
  const result = Sim.tickWorld(world, [second, first], 1050, () => 0.8);
  assert.equal(result.xpCollected.length, 1, 'an orb can only be collected once per room world');
  assert.equal(result.xpCollected[0].orbId, 77);
  assert.equal(result.xpCollected[0].playerId, 'player-a', 'simultaneous pickup uses a stable ID tie-break');
  assert.equal(result.xpCollected[0].value, 55);
  assert.equal(world.orbs.length, 0, 'the authoritative orb disappears after collection');
});

test('expired XP orbs emit a distinct removal list without duplicating collected orbs', () => {
  const world = Sim.createWorldState(1000);
  world.initialized = true; world.lastTick = 1000; world.nextBossAt = 999999; world.commonSpawnTimer = 999999;
  world.enemies = [];
  world.orbs = [
    { id: 77, x: 1000, y: 1000, r: 4, value: 10, phase: 0, life: 0.01 },
    { id: 78, x: 2200, y: 1600, r: 4, value: 10, phase: 0, life: 20 }
  ];
  const player = { id: 'p1', x: 1000, y: 1000, r: 13 / AI.WORLD_ZOOM, alive: true, hp: 100, maxHp: 100, magnetStrength: 1 };
  const result = Sim.tickWorld(world, [player], 1050, () => 0.8);
  assert.deepEqual(result.expiredOrbIds, ['77'], 'only lifetime expiry is sent in the periodic removal event');
  assert.deepEqual(world.orbs.map(orb => orb.id), [78], 'expired orb is removed while the other orb survives');
  assert.equal(result.xpCollected.length, 0, 'expired orbs do not grant experience');
});

test('visible-player contact uses the predicted current position and rejects stale-coordinate ghost hits', () => {
  const makeWorld = () => {
    const world = Sim.createWorldState(1000);
    world.initialized = true; world.lastTick = 1000; world.nextBossAt = 999999; world.commonSpawnTimer = 99999;
    const stats = AI.statsForKind('drifter');
    world.enemies = [{ id: 41, kind: 'drifter', x: 1000, y: 1000, r: stats.r, speed: stats.speed / AI.WORLD_ZOOM, hp: stats.hp, maxHp: stats.hp, damage: stats.damage, color: stats.color, value: stats.value, phase: 0, attackCd: 0 }];
    world.nextEnemyId = 41;
    return world;
  };
  const ghostWorld = makeWorld();
  const movingVisiblePlayer = { id:'p1', x:1036, y:1000, r:13/AI.WORLD_ZOOM, hp:100, maxHp:100, alive:true, lastPositionAt:1020, velocityX:200, velocityY:0, clientHidden:false, positionResumeGraceUntil:0, invulnerableUntil:0, shieldCharges:0 };
  const rejected = Sim.tickWorld(ghostWorld, [movingVisiblePlayer], 1050, Math.random);
  assert.equal(rejected.playerHits.length, 0, 'must not hit based on the earlier, non-predicted coordinate');
  assert.equal(movingVisiblePlayer.hp, 100);

  const contactWorld = makeWorld();
  const movingIntoVisibleContact = { id:'p2', x:1000, y:1000, r:13/AI.WORLD_ZOOM, hp:100, maxHp:100, alive:true, lastPositionAt:1050, velocityX:0, velocityY:0, clientHidden:false, positionResumeGraceUntil:0, invulnerableUntil:0, shieldCharges:0 };
  const accepted = Sim.tickWorld(contactWorld, [movingIntoVisibleContact], 1050, Math.random);
  assert.equal(accepted.playerHits.length, 1);
  assert.ok(accepted.playerHits[0].contactDistance <= accepted.playerHits[0].contactRadius);
  assert.ok(Math.abs(accepted.playerHits[0].playerX - movingIntoVisibleContact.x) < 1, 'stationary fresh player hit uses the current rendered coordinate');
  assert.equal(accepted.playerHits[0].targetWasHidden, false);
  assert.ok(movingIntoVisibleContact.hp < 100);
});

test('a minimized player is still vulnerable at the last known position, but hidden state is explicitly reported', () => {
  const world = Sim.createWorldState(1000);
  world.initialized = true; world.lastTick = 1000; world.nextBossAt = 999999; world.commonSpawnTimer = 99999;
  const stats = AI.statsForKind('drifter');
  world.enemies = [{ id: 52, kind:'drifter', x:1000, y:1000, r:stats.r, speed:stats.speed/AI.WORLD_ZOOM, hp:stats.hp, maxHp:stats.hp, damage:stats.damage, color:stats.color, value:stats.value, phase:0, attackCd:0 }];
  const hiddenPlayer = { id:'p-hidden', x:1020, y:1000, r:13/AI.WORLD_ZOOM, hp:100, maxHp:100, alive:true, lastPositionAt:1000, velocityX:0, velocityY:0, clientHidden:true, invulnerableUntil:0, shieldCharges:0 };
  const result = Sim.tickWorld(world, [hiddenPlayer], 5000, Math.random);
  assert.equal(result.playerHits.length, 1);
  assert.equal(result.playerHits[0].targetWasHidden, true);
  assert.ok(hiddenPlayer.hp < 100);
});
