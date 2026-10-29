const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const online = fs.readFileSync(path.join(root, 'public', 'online.js'), 'utf8');
const game = fs.readFileSync(path.join(root, 'public', 'game.js'), 'utf8');

test('server owns the simulation ticker and does not rely on a browser host', () => {
  assert.match(server, /setInterval\(worldTick,\s*50\)/);
  assert.match(server, /backgroundSimulation:'server-owned'/);
  assert.match(server, /socket\.on\('disconnect',[\s\S]*?removeFromRoom\(socket/);
});

test('online client receives authoritative player vitals from the server', () => {
  assert.match(online, /socket\.on\('player-vitals',[\s\S]*?abyssal-player-vitals/);
  assert.match(game, /abyssal-player-vitals',[\s\S]*?applyOnlinePlayerVitals/);
  assert.match(game, /if\(data\.alive===false&&gameState!=='over'\)endGame\(\)/);
});

test('online client never applies local enemy-contact damage or local regeneration', () => {
  assert.match(game, /if\(!onlineMode&&target\.local&&td</);
  assert.match(game, /if\(!onlineMode&&upgrades\.regen>0/);
});

test('returning to a minimized tab requests current vitals and a fresh snapshot', () => {
  assert.match(online, /document\.addEventListener\('visibilitychange',[\s\S]*?requestPlayerState\(\)/);
  assert.match(online, /function requestPlayerState\(\)[\s\S]*?request-player-state[\s\S]*?request-world-snapshot/);
});

test('dead players cannot restart the room through an ordinary snapshot request', () => {
  assert.match(server, /if\(!hasLivingPlayers\(room\)\)\{socket\.emit\('game-snapshot',[\s\S]*?enemies:\[\]/);
});
