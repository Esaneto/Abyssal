// Regression coverage for view-scoped motion, compact lifecycle packets and skill batching.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const online = fs.readFileSync(path.join(root, 'public', 'online.js'), 'utf8');
const game = fs.readFileSync(path.join(root, 'public', 'game.js'), 'utf8');
const simulation = fs.readFileSync(path.join(root, 'world-simulation.js'), 'utf8');

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
  assert.match(game, /if\(target\.local&&\(td<e\.r\+player\.r\+8\/GAME_WORLD_ZOOM\|\|\(e\.kind==='kraken'&&window\.AbyssalEnemyAI\?\.touchesKrakenTentacle/);
  assert.match(game, /if\(!onlineMode&&upgrades\.regen>0/);
  assert.match(game, /revealOnlineContactSource\(data\)/);
  assert.match(game, /function alignPlayerToAuthoritativeContact\(data\)/);
  assert.match(game, /requestWorldSnapshot\?\.\('contact-resync'\)/);
  assert.match(game, /criticalIds:authoritativeCriticalIds/);
  assert.match(game, /contactSourceReady[\s\S]*?enemies\.some\(e=>String\(e\.id\)===String\(data\.enemyId\)\)/);
  assert.match(server, /criticalSnapshot\?\.snapshotSeq/);
  assert.match(server, /getRoomContactSnapshot\(room,playerHits\)/);
  assert.match(server, /emit\('enemy-contact-source',contactSnapshot\)/);
  assert.match(server, /if\s*\(criticalSnapshot\)\s*io\.to\(channelFor\(room\)\)\.emit\('game-snapshot',\s*criticalSnapshot\)/);
  assert.match(server, /if\s*\(motion\)\s*io\.to\(recipient\.id\)\.volatile\.emit\('enemy-motion',\s*motion\)/);
  assert.match(online, /socket\.on\('enemy-contact-source'/);
  assert.match(game, /function registerEnemyContactSnapshot\(data\)/);
  assert.match(game, /if\(data\.targetWasHidden===true\)alignPlayerToAuthoritativeContact\(data\)/);
});

test('returning to a minimized tab requests current vitals and a fresh snapshot', () => {
  assert.match(online, /document\.addEventListener\('visibilitychange',[\s\S]*?requestPlayerState\(\)/);
  assert.match(online, /function requestPlayerState\(reason='resync'\)[\s\S]*?requestWorldSnapshot\(reason\)[\s\S]*?request-player-state/);
  assert.match(server, /criticalReason:resumeResync\?'resume-resync'/);
});

test('dead players cannot restart the room through an ordinary snapshot request', () => {
  assert.match(server, /if\(!hasLivingPlayers\(room\)\)[\s\S]*?emptySnapshot\.enemies=\[\][\s\S]*?socket\.emit\('game-snapshot',emptySnapshot\)/);
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

test('mobile zoom uses the requested level and online menu uses the requested name', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  assert.match(game, /function desiredWorldZoom\(\)\{return isMobileDevice\(\) \? \.5 : \.78;\}/);
  assert.match(html, /<strong>MERGULHAR ONLINE<\/strong>/);
  assert.doesNotMatch(html, /COOPERATIVO ONLINE/);
  for (const asset of ['style.css','enemy-ai.js','enemy-netcode.js','skill-audio.js','skin-abilities.js','game.js','online.js']) {
    assert.match(html, new RegExp(`${asset.replace('.', '\\.') }\\?v=\\d+(?:\\.\\d+)*`), `versioned asset missing: ${asset}`);
  }});


test('solo orb pickup and co-op server award feed the same gainXp function', () => {
  assert.match(game, /gainXp\(o\.value,'orb'\)/);
  assert.match(game, /function applySharedXp\(data\)[\s\S]*?gainXp\(Math\.max\(0,Number\(data\.value\)\|\|0\),'shared'\)/);
  assert.match(online, /socket\.on\('shared-xp-award',[\s\S]*?sharedXp/);
  assert.match(game, /function addOrb\(x,y,value\)[\s\S]*?xpOrbRadius/);
});

test('authoritative movement is lossy-but-fresh, while collision verification keeps a reliable attacker frame', () => {
  assert.doesNotMatch(server, /\.volatile\.emit\('game-snapshot'/, 'entity lifecycle and recovery snapshots must remain reliable');
  assert.match(server, /if\s*\(criticalSnapshot\)\s*io\.to\(channelFor\(room\)\)\.emit\('game-snapshot',\s*criticalSnapshot\)/);
  assert.match(server, /io\.to\(recipient\.id\)\.volatile\.emit\('enemy-motion',motion\)/);
  const tickRoom=server.indexOf('function tickRoom(room, now)');
  const motionEmit=server.indexOf("volatile.emit('enemy-motion',motion)",tickRoom);
  const contactEmit=server.indexOf("emit('enemy-contact-source',contactSnapshot)",tickRoom);
  const vitalsEmit=server.indexOf("io.to(hit.playerId).emit('player-vitals'",tickRoom);
  assert.ok(tickRoom>=0&&contactEmit>motionEmit&&vitalsEmit>contactEmit,'the compact attacker frame must precede contact vitals');
  assert.match(server,/const criticalEnemyIds=\[\.\.\.new Set\(/);
  assert.match(game,/authoritativeSnapshotHistory\.set\(`\$\{worldId\}:\$\{sequence\}`,frame\)/);
});

test('room traffic uses compact player motion, slower roster recovery and throttled orb snapshots',()=>{
  assert.match(server,/getRoomPlayerMotion\(room\)/);
  assert.match(server,/io\.to\(channelFor\(room\)\)\.volatile\.emit\('player-motion',motion\)/);
  assert.match(online,/socket\.on\('player-motion',rows=>applyPlayerMotion\(rows\)\)/);
  assert.match(online,/function applyPlayerMotion\(rows\)/);
  assert.match(simulation,/if \(sendReliableSnapshot\) world\.reliableSnapshotTimer = 30/);
  assert.match(simulation,/if \(sendPlayers\) world\.playerSnapshotTimer = 1/);
  assert.match(simulation,/const sendOrbSnapshot = sendSnapshot && world\.orbSnapshotTimer <= 0/);
  assert.match(server,/getRoomMotionSnapshot\(room,\{player:recipient,includeOrbs:Boolean\(result\.sendOrbSnapshot\)\}\)/);
  assert.match(game,/if\(Array\.isArray\(data\.orbs\)\)\{/);
  assert.match(server,/getRoomSpawnSnapshot\(room,spawnedEnemies\)/);
  assert.match(server,/emit\('world-enemies-spawned',spawnFrame\)/);
  assert.match(server,/orbScope:recipient\?'view':'all'/);
  assert.match(game,/orbDuration=clamp\(Number\(data\.orbIntervalMs\)\|\|500,400,650\)/);
  assert.match(game,/data\.orbScope!=='view'/);
  assert.match(server,/emit\('world-xp-orbs-expired',expiredOrbIds\)/);
  assert.match(server,/socket\.on\('shared-damage-batch'/);
  assert.match(online,/function sendDamageBatch\(hits\)/);
  assert.match(game,/flushOnlineDamageBatch\(\)/);

});
