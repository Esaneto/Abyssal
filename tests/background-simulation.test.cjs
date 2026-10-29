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

test('online client renders server-authoritative enemy positions instead of simulating a divergent copy', () => {
  assert.match(game, /if\(onlineMode\)\{[\s\S]*?AbyssalEnemyNetcode\?\.renderedPosition/);
  assert.match(game, /if\(target\.local&&td<e\.r\+player\.r\+8\/worldZoom\)/);
  assert.match(game, /if\(!onlineMode&&upgrades\.regen>0/);
  assert.match(game, /revealOnlineContactSource\(data\)/);
});

test('returning to a minimized tab requests current vitals and a fresh snapshot', () => {
  assert.match(online, /document\.addEventListener\('visibilitychange',[\s\S]*?requestPlayerState\(\)/);
  assert.match(online, /function requestPlayerState\(\)[\s\S]*?request-player-state[\s\S]*?request-world-snapshot/);
});

test('dead players cannot restart the room through an ordinary snapshot request', () => {
  assert.match(server, /if\(!hasLivingPlayers\(room\)\)\{socket\.emit\('game-snapshot',[\s\S]*?enemies:\[\]/);
});


test('online contact feedback never creates or teleports a mob to its damage source', () => {
  const start = game.indexOf('function revealOnlineContactSource(data)');
  const end = game.indexOf('function applyOnlinePlayerVitals(data)', start);
  assert.ok(start >= 0 && end > start);
  const reporter = game.slice(start, end);
  assert.match(reporter, /enemies\.find/);
  assert.doesNotMatch(reporter, /enemies\.push/);
  assert.doesNotMatch(reporter, /e\.x\s*=\s*Number\(data\./);
  assert.doesNotMatch(reporter, /e\.y\s*=\s*Number\(data\./);
});

test('mobile zoom reveals more of the same world and online menu uses the requested name', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  assert.match(game, /function desiredWorldZoom\(\)\{return isMobileDevice\(\) \? \.42 : \.78;\}/);
  assert.match(html, /<strong>MERGULHAR ONLINE<\/strong>/);
  assert.doesNotMatch(html, /COOPERATIVO ONLINE/);
  for (const asset of ['style.css', 'enemy-ai.js', 'enemy-netcode.js', 'skill-audio.js', 'game.js', 'online.js']) {
    assert.match(html, new RegExp(`${asset}\\?v=3\.4\.2`));
  }
});


test('solo orb pickup and co-op server award feed the same gainXp function', () => {
  assert.match(game, /gainXp\(o\.value,'orb'\)/);
  assert.match(game, /function applySharedXp\(data\)[\s\S]*?gainXp\(Math\.max\(0,Number\(data\.value\)\|\|0\),'shared'\)/);
  assert.match(online, /socket\.on\('shared-xp-award',[\s\S]*?sharedXp/);
  assert.match(game, /function addOrb\(x,y,value\)[\s\S]*?xpOrbRadius/);
});
