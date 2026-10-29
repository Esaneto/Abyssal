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
  async clientEmit(event, payload) {
    const list = this.handlers.get(event) || [];
    let result;
    for (const handler of list) result = handler(payload);
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
  constructor() { super(); this.engine = { clientsCount: 0 }; this.sockets = new Map(); this.members = new Map(); FakeSocketServer.instance = this; }
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
    return app;
  }
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
    delete require.cache[serverModulePath];
    try { if (temporaryDataDir) fs.rmSync(temporaryDataDir, { recursive: true, force: true }); } catch {}
  });

  await waitFor(() => testServer?.listening);
  const port = testServer.address().port;
  await waitFor(() => FakeSocketServer.instance);
  const io = FakeSocketServer.instance;
  const owner = io.connect('owner');
  await owner.clientEmit('authenticate', { nickname: 'RuntimeOwner', password: 'testing123', mode: 'register' });
  const auth = owner.latest('auth-result'); assert.equal(auth.ok, true);

  await owner.clientEmit('create-room', { name: 'Fossa de teste', isPrivate: false, capacity: 2 });
  const created = owner.latest('room-created'); assert.equal(created.ok, true);
  const roomId = created.room.id;
  await owner.clientEmit('join-room', { roomId });
  assert.equal(owner.latest('room-joined').ok, true);

  const initialSnapshot = owner.latest('game-snapshot') || owner.latest('room-joined').snapshot;
  assert.equal(initialSnapshot.enemies.length, 3);
  const firstPositions = new Map(initialSnapshot.enemies.map(enemy => [enemy.id, { x: enemy.x, y: enemy.y }]));

  const guest = io.connect('guest');
  await guest.clientEmit('authenticate', { nickname: 'RuntimeGuest', password: 'testing456', mode: 'register' });
  assert.equal(guest.latest('auth-result').ok, true);
  await guest.clientEmit('list-rooms');
  assert.ok((guest.latest('rooms-list') || []).some(room => room.id === roomId), 'second client sees the room created by first client');
  await guest.clientEmit('join-room', { roomId });
  assert.equal(guest.latest('room-joined').ok, true);

  // Feed real client-like absolute world coordinates; then wait for the actual server ticker.
  await owner.clientEmit('player-position', { x: 1800, y: 1100, angle: 0, viewportWidth: 800, viewportHeight: 500 });
  await guest.clientEmit('player-position', { x: 2000, y: 1200, angle: 1, viewportWidth: 800, viewportHeight: 500 });
  await waitFor(() => owner.all('game-snapshot').length >= 2, 2500);
  await wait(350);
  const snapshots = owner.all('game-snapshot');
  const latest = snapshots[snapshots.length - 1];
  const moved = latest.enemies.some(enemy => {
    const prev = firstPositions.get(enemy.id);
    return prev && Math.hypot(enemy.x - prev.x, enemy.y - prev.y) > 1;
  });
  assert.ok(moved, 'server snapshots should contain real enemy movement');
  assert.ok(latest.elapsed > 0, 'server world clock advances while the room is occupied');

  const health = await getJson(port, '/health');
  assert.equal(health.ok, true);
  assert.equal(health.world.engine, 'shared-solo-ai');
  assert.ok(health.simulation.movingEnemies > 0);
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
