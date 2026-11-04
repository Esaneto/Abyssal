'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');
const Module = require('node:module');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Integration harness: loads the real server.js while replacing only Express and
// Socket.IO transport adapters. World simulation, room lifecycle and event handlers
// are the project's real code; no Neon/DATABASE_URL is used in this test.
class FakeSocket {
  constructor(id, io) {
    this.id = id; this.io = io; this.data = {}; this.connected = true;
    this.handshake = { address: `test-${id}` }; this.handlers = new Map();
    this.sent = []; this.rooms = new Set();
  }
  on(event, handler) { const list = this.handlers.get(event) || []; list.push(handler); this.handlers.set(event, list); return this; }
  emit(event, ...args) { this.sent.push({ event, args, at: Date.now() }); return true; }
  async clientEmit(event, payload, ...extraArgs) {
    const list = this.handlers.get(event) || [];
    let result;
    for (const handler of list) result = handler(payload, ...extraArgs);
    if (result && typeof result.then === 'function') await result;
    return result;
  }
  join(room) { this.io.addMember(room, this); this.rooms.add(room); }
  leave(room) { this.io.removeMember(room, this); this.rooms.delete(room); }
  to(room) { return this.io.emitter(room, this.id); }
  latest(event) { return [...this.sent].reverse().find(x => x.event === event)?.args?.[0]; }
  all(event) { return this.sent.filter(x => x.event === event).map(x => x.args[0]); }
}
class FakeSocketServer extends EventEmitter {
  constructor() { super(); this.engine = Object.assign(new EventEmitter(), { clientsCount: 0 }); this.sockets = new Map(); this.members = new Map(); FakeSocketServer.instance = this; }
  connect(id) { const socket = new FakeSocket(id, this); this.sockets.set(id, socket); this.engine.clientsCount = this.sockets.size; super.emit('connection', socket); return socket; }
  addMember(room, socket) { if (!this.members.has(room)) this.members.set(room, new Set()); this.members.get(room).add(socket.id); }
  removeMember(room, socket) { this.members.get(room)?.delete(socket.id); if (!this.members.get(room)?.size) this.members.delete(room); }
  emitter(room, exceptId = null) {
    const send = (event, data) => {
      const ids = room === undefined ? [...this.sockets.keys()] : this.sockets.has(room) ? [room] : [...(this.members.get(room) || [])];
      for (const id of ids) if (id !== exceptId) this.sockets.get(id)?.emit(event, data);
    };
    return { emit: send, volatile: { emit: send } };
  }
  to(room) { return this.emitter(room); }
  emit(event, ...args) {
    if (event === 'connection') return super.emit(event, ...args);
    for (const socket of this.sockets.values()) socket.emit(event, ...args);
    return true;
  }
}

let testServer;
let originalLoad;
let originalCreateServer;
let originalPort;
let originalDatabaseUrl;
let originalDataDir;
let temporaryDataDir;
let serverModulePath;

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function waitFor(predicate, timeout = 2000, step = 10) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      try { if (predicate()) return resolve(); }
      catch (error) { return reject(error); }
      if (Date.now() - started > timeout) return reject(new Error('Timed out waiting for server state'));
      setTimeout(check, step);
    };
    check();
  });
}
async function getJson(port, pathname) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path: pathname }, response => {
      let body = ''; response.setEncoding('utf8'); response.on('data', chunk => body += chunk);
      response.on('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
    }).on('error', reject);
  });
}

// Use an isolated child process for this test: server.js installs process signal
// handlers and owns the HTTP listener. This in-process harness still closes it.
test('real server handlers move enemies, publish rooms, and destroy empty rooms', async t => {
  originalPort = process.env.PORT; originalDatabaseUrl = process.env.DATABASE_URL; originalDataDir = process.env.DATA_DIR;
  const safetyEnvKeys=['ABYSSAL_REWARDED_WHEEL_ENABLED'];
  const previousSafetyEnv=Object.fromEntries(safetyEnvKeys.map(key=>[key,process.env[key]]));
  for(const key of safetyEnvKeys)delete process.env[key];
  process.env.ABYSSAL_REWARDED_WHEEL_ENABLED='true';
  process.env.PORT = '0'; delete process.env.DATABASE_URL;
  temporaryDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'abyssal-runtime-test-'));
  process.env.DATA_DIR = temporaryDataDir;
  originalCreateServer = http.createServer;
  http.createServer = function (...args) { testServer = originalCreateServer.apply(this, args); return testServer; };

  const routes = new Map();
  function fakeExpress() {
    const app = (req, res) => {
      res.set = (key, value) => { res.setHeader(key, value); return res; };
      res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
      const handler = routes.get(`${req.method} ${new URL(req.url, 'http://test').pathname}`);
      if (handler) return handler(req, res);
      res.statusCode = 404; res.end('not found');
    };
    app.use = () => app;
    app.get = (route, handler) => { routes.set(`GET ${route}`, handler); return app; };
    app.post = (route, ...handlers) => { routes.set(`POST ${route}`, handlers[handlers.length - 1]); return app; };
    return app;
  }
  // Route modules use Express body parsers. The runtime harness does not need
  // to parse request bodies for this world-simulation test, but must expose the
  // same middleware factories so server startup exercises route registration.
  fakeExpress.json = () => (_req, _res, next) => next?.();
  fakeExpress.raw = () => (_req, _res, next) => next?.();
  fakeExpress.static = () => (_req, _res, next) => next?.();

  originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'express') return fakeExpress;
    if (request === 'socket.io') return { Server: FakeSocketServer };
    return originalLoad.call(this, request, parent, isMain);
  };
  serverModulePath = require.resolve('../server.js');
  delete require.cache[serverModulePath];
  require('../server.js');
  Module._load = originalLoad;

  t.after(async () => {
    Module._load = originalLoad;
    http.createServer = originalCreateServer;
    if (testServer?.listening) await new Promise(resolve => testServer.close(resolve));
    if (originalPort === undefined) delete process.env.PORT; else process.env.PORT = originalPort;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalDataDir === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = originalDataDir;
    for(const key of safetyEnvKeys){if(previousSafetyEnv[key]===undefined)delete process.env[key];else process.env[key]=previousSafetyEnv[key];}
    delete require.cache[serverModulePath];
    try { if (temporaryDataDir) fs.rmSync(temporaryDataDir, { recursive: true, force: true }); } catch {}
  });

  await waitFor(() => testServer?.listening, 5000);
  const port = testServer.address().port;
  await waitFor(() => FakeSocketServer.instance, 5000);
  const io = FakeSocketServer.instance;
  const owner = io.connect('owner');
  await owner.clientEmit('authenticate', { nickname: 'RuntimeOwner', password: 'testing123', email:'owner@example.test', mode: 'register' });
  const auth = owner.latest('auth-result'); assert.equal(auth.ok, true);
  await owner.clientEmit('get-public-profile',{nickname:'RuntimeOwner'});
  assert.equal(owner.latest('public-profile-result')?.ok,true,'public profiles are available');
  await owner.clientEmit('list-cardumes');
  assert.deepEqual(owner.latest('cardumes-list'),[],'no cardumes exist yet');
  await owner.clientEmit('create-cardume',{name:'Test Flock'});
  assert.equal(owner.latest('cardume-action-result')?.ok,true,'cardume creation succeeds');
  await owner.clientEmit('spin-wheel');
  assert.equal(owner.latest('wheel-result')?.ok,true,'random rewards work when enabled by default');

  await owner.clientEmit('create-room', { name: 'Fossa de teste', isPrivate: false, capacity: 2 });
  const created = owner.latest('room-created'); assert.equal(created.ok, true);
  const roomId = created.room.id;
  await owner.clientEmit('join-room', { roomId });
  assert.equal(owner.latest('room-joined').ok, true);

  const initialSnapshot = owner.latest('game-snapshot') || owner.latest('room-joined').snapshot;
  assert.equal(initialSnapshot.enemies.length, 3);
  const firstPositions = new Map(initialSnapshot.enemies.map(enemy => [enemy.id, { x: enemy.x, y: enemy.y }]));

  const guest = io.connect('guest');
  await guest.clientEmit('authenticate', { nickname: 'RuntimeGuest', password: 'testing456', email:'guest@example.test', mode: 'register' });
  assert.equal(guest.latest('auth-result').ok, true);
  await guest.clientEmit('list-rooms');
  assert.ok((guest.latest('rooms-list') || []).some(room => room.id === roomId), 'second client sees the room created by first client');
  await guest.clientEmit('join-room', { roomId });
  assert.equal(guest.latest('room-joined').ok, true);

  let deniedPulse=null;
  await owner.clientEmit('active-ability',{id:'pulse'},result=>{deniedPulse=result;});
  assert.equal(deniedPulse?.ok,false,'unowned Q skill is rejected by the server with acknowledgement');
  assert.equal(deniedPulse?.reason,'invalid-ability');

  // Feed real client-like absolute world coordinates; then wait for the actual server ticker.
  let ownerPositionAck = null, guestPositionAck = null;
  await owner.clientEmit('player-position', { x: 1800, y: 1100, angle: 0, viewportWidth: 4000, viewportHeight: 2500, seq: 1, clientEnemyCount: 3, clientMovingEnemies: 3, clientPredicting: true, clientGameState: 'playing' }, result => { ownerPositionAck = result; });
  await guest.clientEmit('player-position', { x: 2000, y: 1200, angle: 1, viewportWidth: 4000, viewportHeight: 2500, seq: 1, clientEnemyCount: 3, clientMovingEnemies: 2, clientPredicting: true, clientGameState: 'playing' }, result => { guestPositionAck = result; });
  assert.equal(ownerPositionAck?.ok, true, 'server acknowledges the player position stream');
  assert.equal(guestPositionAck?.ok, true, 'server acknowledges each co-op player position');
  await waitFor(() => owner.all('enemy-motion').length >= 1, 2500);
  await wait(350);
  const snapshots = owner.all('game-snapshot');
  const latest = snapshots[snapshots.length - 1] || initialSnapshot;
  const motion = owner.latest('enemy-motion');
  const moved = (motion?.enemies || []).some(row => {
    const prev = firstPositions.get(row[0]);
    return prev && Math.hypot(Number(row[1]) - prev.x, Number(row[2]) - prev.y) > 1;
  });
  assert.ok(moved, 'compact per-player motion packets should contain real enemy movement');
  assert.ok(Number(motion?.elapsed) > 0, 'server world clock advances in compact motion packets');
  const guestLatest = guest.latest('game-snapshot');
  assert.ok(guestLatest, 'the second client receives the room snapshot');
  assert.deepEqual(
    guestLatest.enemies.map(e => [e.id, e.x, e.y]),
    latest.enemies.map(e => [e.id, e.x, e.y]),
    'all clients receive exactly the same authoritative enemy coordinates in a snapshot'
  );

  const health = await getJson(port, '/health');
  assert.equal(health.ok, true);
  assert.equal(health.world.engine, 'server-authoritative-shared-enemies-reliable-snapshots-contact-guard-v4');
  assert.ok(health.simulation.movingEnemies > 0);

  // A single Photon Ray pulse carries deterministic color, level and a validated
  // cosmetic endpoint to peers without creating additional per-frame network work.
  await owner.clientEmit('shared-shot', {
    x: 1800 / 4800, y: 1100 / 3000, vx: 0.1, vy: 0.1,
    damage: 1, color: '#000000', beamLevel: 2, special: 'photonRay',
    beamEndX: 1850 / 4800, beamEndY: 1100 / 3000, volleyId: 'photon-runtime-1'
  });
  const photonRelay = guest.latest('shared-shot');
  assert.equal(photonRelay?.special, 'photonRay', 'co-op Photon Ray reaches the peer');
  assert.equal(photonRelay?.color, '#ff8df4', 'server overrides client Photon Ray color');
  assert.equal(photonRelay?.beamLevel, 2, 'remote beam width receives the selected level');
  assert.ok(Math.abs(photonRelay.beamEndX - 1850 / 4800) < 1e-6, 'remote receives the local target endpoint');
  await owner.clientEmit('shared-shot', {
    x: 1800 / 4800, y: 1100 / 3000, vx: 0.1, vy: 0.1,
    damage: 1, beamLevel: 99, special: 'photonRay',
    beamEndX: 1, beamEndY: 1, volleyId: 'photon-runtime-2'
  });
  // The shared-shot rate guard applies even when a client attempts immediate
  // repetition, so only the first relay above is required for the assertion.

  // Exercise the real authoritative damage handler and ACK, not only the render-side prediction.
  const damageTarget = latest.enemies.find(enemy => enemy && Number(enemy.hp) > 6);
  assert.ok(damageTarget, 'the current authoritative snapshot should contain a damageable enemy');
  let damageAck = null;
  const beforeHp = Number(damageTarget.hp);
  await owner.clientEmit('shared-damage', { id: damageTarget.id, damage: 5 }, result => { damageAck = result; });
  assert.equal(damageAck?.ok, true, `server should accept valid damage; received ${JSON.stringify(damageAck)}`);
  assert.equal(Number(damageAck.hp), beforeHp - 5, 'server-confirmed HP must decrease by the requested damage');
  assert.equal(owner.latest('world-enemy-damaged')?.id, damageTarget.id, 'server should broadcast authoritative HP feedback');
  assert.ok(Number((await getJson(port, '/health')).simulation.combat.appliedHits) > 0, 'health diagnostics should count applied hits');

  // A dead common enemy creates one shared XP orb. The two clients see the same orb,
  // but the server awards the XP only to the player who reaches it first.
  const xpTarget = owner.latest('game-snapshot').enemies.find(e => e && !['boss','leviathan','maw','angler'].includes(e.kind));
  assert.ok(xpTarget, 'a common enemy should be available for the XP-drop integration test');
  const ownerXpAwardsBefore = owner.all('shared-xp-award').length;
  const guestXpAwardsBefore = guest.all('shared-xp-award').length;
  let killAck = null;
  await owner.clientEmit('shared-damage', { id: xpTarget.id, damage: Math.max(1000,Number(xpTarget.hp)||0) }, result => { killAck = result; });
  assert.equal(killAck?.ok, true, 'the server accepts damage that kills a common enemy');
  assert.equal(killAck.killed, true, 'the server confirms the enemy was killed');
  const xpOrb = owner.latest('world-xp-orb-spawned');
  assert.ok(xpOrb && String(xpOrb.sourceEnemyId) === String(xpTarget.id), 'the server sends the dropped XP orb as a compact lifecycle event');
  const guestXpOrb = guest.latest('world-xp-orb-spawned');
  assert.equal(guestXpOrb?.id, xpOrb.id, 'the other player receives the same authoritative XP orb');
  assert.equal(owner.all('shared-xp-award').length, ownerXpAwardsBefore, 'killing an enemy does not immediately award XP');
  assert.equal(guest.all('shared-xp-award').length, guestXpAwardsBefore, 'XP is not broadcast as an award to every player');
  let xpOwnerAck = null, xpGuestAck = null;
  await owner.clientEmit('player-position', { x: xpOrb.x, y: xpOrb.y, angle: 0, viewportWidth: 800, viewportHeight: 500, seq: 2, clientEnemyCount: 3, clientMovingEnemies: 3, clientPredicting: false, clientGameState: 'playing' }, result => { xpOwnerAck = result; });
  await guest.clientEmit('player-position', { x: 3200, y: 1900, angle: 0, viewportWidth: 800, viewportHeight: 500, seq: 2, clientEnemyCount: 3, clientMovingEnemies: 3, clientPredicting: false, clientGameState: 'playing' }, result => { xpGuestAck = result; });
  assert.equal(xpOwnerAck?.ok, true);
  assert.equal(xpGuestAck?.ok, true);
  await waitFor(() => owner.all('shared-xp-award').length > ownerXpAwardsBefore, 2000);
  assert.equal(owner.all('shared-xp-award').length, ownerXpAwardsBefore + 1, 'the collector receives one XP award');
  assert.equal(guest.all('shared-xp-award').length, guestXpAwardsBefore, 'the other player receives no XP from the orb');
  assert.ok(owner.all('world-xp-orb-collected').some(evt => String(evt.orbId) === String(xpOrb.id)), 'orb removal is broadcast to the whole room');

  // Simulate minimizing the browser: send one final position beside a mob, then stop
  // sending position packets entirely. The server must continue ticking and attack that
  // last known position without a browser animation frame or a new heartbeat.
  const currentSnapshot = owner.latest('game-snapshot');
  const nearestEnemy = currentSnapshot.enemies.find(enemy => String(enemy.id) !== String(xpTarget.id)) || currentSnapshot.enemies[0];
  let frozenPositionAck = null;
  const vitalsBeforeFrozen = owner.all('player-vitals').filter(v => v?.reason === 'enemy-attack' && Number(v.damage) > 0).length;
  await owner.clientEmit('client-visibility', { hidden: true });
  await owner.clientEmit('player-position', { x: nearestEnemy.x + 1, y: nearestEnemy.y, angle: 0, viewportWidth: 800, viewportHeight: 500, seq: 3, clientEnemyCount: 3, clientMovingEnemies: 3, clientPredicting: true, clientGameState: 'playing' }, result => { frozenPositionAck = result; });
  assert.equal(frozenPositionAck?.ok, true);
  await waitFor(() => owner.all('player-vitals').filter(v => v?.reason === 'enemy-attack' && Number(v.damage) > 0).length > vitalsBeforeFrozen, 6000);
  const damageWhileFrozen = owner.all('player-vitals').filter(v => v?.reason === 'enemy-attack' && Number(v.damage) > 0).at(-1);
  assert.ok(damageWhileFrozen.hp < damageWhileFrozen.maxHp, 'server must damage a player using the last known position');
  const hitLogIndex = owner.sent.map(entry => entry.event).lastIndexOf('player-vitals');
  const hitLog = owner.sent[hitLogIndex];
  const hitSnapshotIndex = owner.sent.findIndex(entry =>
    ['game-snapshot', 'enemy-contact-source'].includes(entry.event) &&
    Number(entry.args[0]?.snapshotSeq) === Number(hitLog?.args[0]?.snapshotSeq)
  );
  assert.ok(hitSnapshotIndex >= 0 && hitSnapshotIndex < hitLogIndex, 'a reliable full or attacker-only frame must arrive before the damage/vitals event');
  const hitSnapshot = owner.sent[hitSnapshotIndex].args[0];
  const attacker = hitSnapshot.enemies.find(enemy => String(enemy.id) === String(hitLog.args[0].enemyId));
  assert.ok(attacker, 'the attacking enemy must exist in the authoritative frame before damage');
  if (owner.sent[hitSnapshotIndex].event === 'enemy-contact-source') {
    assert.equal(hitSnapshot.enemies.length, 1, 'contact-only frames contain only the attacker, not the entire room');
  }
  assert.ok(Math.hypot(attacker.x - hitLog.args[0].enemyX, attacker.y - hitLog.args[0].enemyY) < 0.01, 'attacker visual coordinates match the exact authoritative collision coordinates');
  assert.ok(Math.hypot(hitLog.args[0].enemyX - hitLog.args[0].playerX, hitLog.args[0].enemyY - hitLog.args[0].playerY) <= hitLog.args[0].contactRadius + 0.01, 'server damage is only issued after real contact geometry is confirmed');
  const positionCountAfterMove = frozenPositionAck.positionUpdates;
  await wait(850);
  const staleHealth = await getJson(port, '/health');
  const activeRoomAfterFreeze = staleHealth.simulation.activeRoomDetails.find(r => r.id === roomId);
  assert.ok(activeRoomAfterFreeze, 'room remains active while sockets remain connected');
  assert.ok(activeRoomAfterFreeze.positionUpdates >= positionCountAfterMove, 'position counter remains valid after client position stream pauses');
  assert.ok(staleHealth.worldTickerActive, 'server world ticker continues without client frames');
  assert.ok(staleHealth.simulation.combat.playerAttacks > 0, 'server contact attack loop remains active while the client is frozen');

  assert.equal(health.simulation.activeRoomDetails[0].clientReportedMovingEnemies, 5);
  assert.equal(health.simulation.activeRoomDetails[0].clientPredictingPlayers, 2);
  assert.equal(health.worldTickerActive, true);

  await guest.clientEmit('leave-world');
  await owner.clientEmit('leave-world');
  const cleanupDeadline = Date.now() + 2500;
  let cleanupHealth = null;
  while (Date.now() < cleanupDeadline) {
    cleanupHealth = await getJson(port, '/health');
    if (cleanupHealth.activePlayers === 0 && cleanupHealth.worldTickerActive === false) break;
    await wait(30);
  }
  assert.ok(cleanupHealth && cleanupHealth.activePlayers === 0, 'active player count returns to zero after both leave');
  assert.equal(cleanupHealth.worldTickerActive, false, 'world ticker shuts down when all rooms are empty');
  const roomsResult = await getJson(port, '/api/rooms');
  assert.ok(!roomsResult.rooms.some(room => room.id === roomId), 'an empty custom room is removed from the directory');
  const finalHealth = await getJson(port, '/health');
  assert.equal(finalHealth.activePlayers, 0);
  assert.equal(finalHealth.worldTickerActive, false);
  assert.equal(finalHealth.simulation.totalEnemies, 0);
});
