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
  assert.match(game, /data\.alive===false[\s\S]*?endGame\(\)/);
});

test('online client renders server-authoritative enemy positions instead of simulating a divergent copy', () => {
  assert.match(game, /if\(onlineMode\)\{[\s\S]*?AbyssalEnemyNetcode\?\.renderedPosition/);
  assert.match(game, /if\(target\.local&&\(td<e\.r\+player\.r\+8\/GAME_WORLD_ZOOM\|\|\(e\.kind==='kraken'&&e\.krakenSweepActive===true&&window\.AbyssalEnemyAI\?\.touchesKrakenTentacle/);
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
  assert.match(game, /FAIR_VIEW_REFERENCE/);
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
  assert.match(server,/volatile\.emit\('player-motion',NetCodec\.playerMotion\(motion\)\)/);
  assert.match(online,/socket\.on\('player-motion',rows=>applyPlayerMotion\(window\.AbyssalNetCodec\?\.readPlayerMotion\?\.\(rows\)\|\|rows\)\)/);
  assert.match(online,/function applyPlayerMotion\(rows\)/);
  assert.match(simulation,/if \(sendReliableSnapshot\) world\.reliableSnapshotTimer = 30/);
  assert.match(simulation,/if \(sendPlayers\) world\.playerSnapshotTimer = 1/);
  assert.match(simulation,/const sendOrbSnapshot = sendSnapshot && world\.orbSnapshotTimer <= 0/);
  assert.match(server,/getRoomMotionSnapshot\(room,\{player:recipient,includeOrbs:Boolean\(result\.sendOrbSnapshot\)\}\)/);
  assert.match(game,/if\(Array\.isArray\(data\.orbs\)\)\{/);
  assert.match(server,/getRoomSpawnSnapshot\(room,spawnedEnemies\)/);
  assert.match(server,/emit\('world-enemies-spawned',spawnFrame\)/);
  assert.match(server,/orbScope:recipient\?'view':'all'/);
  assert.match(game,/orbInterval=clamp\(Number\(data\.orbIntervalMs\)\|\|250,120,650\)/);
  assert.match(game,/visualDuration=clamp\(orbInterval\*\.55,90,150\)/);
  assert.match(game,/data\.orbScope!=='view'/);
  assert.match(server,/emit\('world-xp-orbs-expired',expiredOrbIds\)/);
  assert.match(server,/socket\.on\('shared-damage-batch'/);
  assert.match(online,/function sendDamageBatch\(hits\)/);
  assert.match(game,/flushOnlineDamageBatch\(\)/);

});


test('deploy reconnect keeps maintenance visible until the authoritative room is restored', () => {
  assert.match(online, /if\(!reconnectPending\)hideMaintenanceOverlay\(\);else showMaintenanceOverlay/);
  assert.match(online, /showMaintenanceOverlay\('Expedição restaurada\. Sincronizando o mundo…'\)/);
  assert.match(online, /window\.dispatchEvent\(new CustomEvent\('abyssal-room-joined'/);
});


test('deploy reconnect cannot leave the maintenance overlay pending forever', () => {
  assert.match(online, /function armReconnectWatchdog\(\)/);
  assert.match(online, /setTimeout\(\(\)=>\{if\(reconnectPending\)failReconnect/);
  assert.match(online, /},15000\)/);
  assert.match(online, /if\(reconnectPending\)failReconnect\('Sua sessão expirou durante a atualização/);
  assert.match(online, /socket\.on\('room-joined',data=>\{if\(!data\?\.ok\)return;clearReconnectWatchdog\(\)/);
});


test('deploy shutdown persists runs before forcing old WebSockets to reconnect', () => {
  const server = read('server.js');
  const shutdown = server.slice(server.indexOf('async function shutdown'), server.indexOf("process.on('SIGTERM'"));
  assert.ok(shutdown.indexOf('stashDeployRun(client)') < shutdown.indexOf('io.disconnectSockets(true)'));
  assert.ok(shutdown.indexOf('await flushPersistence()') < shutdown.indexOf('io.disconnectSockets(true)'));
  assert.ok(shutdown.indexOf('io.disconnectSockets(true)') < shutdown.indexOf('server.close(resolve)'));
});

test('deploy reconnect preserves the shared room world and does not consume mismatched resumes',()=>{
 const server=read('server.js');
 assert.match(server,/roomResume:\{id:room\.id[\s\S]*world:deployWorld/);
 assert.match(server,/function restoreDeployRoom\(user,requestedId\)/);
 assert.match(server,/room\.world=JSON\.parse\(JSON\.stringify\(meta\.world\)\)/);
 assert.match(server,/saved\.roomId===room\.id/);
 const take=server.slice(server.indexOf('function takeDeployRun'),server.indexOf('function restoreDeployRoom'));
 assert.ok(take.indexOf('const valid=') < take.indexOf('delete user.pendingRunResume'));
});

test('maintenance deadline allows normal Render deploy startup before fallback',()=>{
 assert.match(online,/\},180000\);/);
});

test('ricochet is universal, straight neon and replicated by server while electric chaining stays electric-only',()=>{
 const server=read('server.js'),game=read('public/game.js'),online=read('public/online.js');
 assert.match(server,/Number\(player\.ricochetLevel\)>0&&skillId!=='ricochet'/);
 assert.match(server,/type:'ricochet-line'/);
 assert.match(server,/source==='electric'&&Number\(attacker\.electricLevel\)>0/);
 assert.match(game,/source==='electric'&&\(upgrades\.electric\|\|0\)>0/);
 assert.match(game,/type:'ricochet-line'[\s\S]*color:'#f7ff19'/);
 assert.match(game,/fx\.type==='ricochet-line'\)\{ctx\.moveTo\(fx\.x1,fx\.y1\);ctx\.lineTo\(fx\.x2,fx\.y2\)/);
 assert.match(game,/abyssal-hit-synergy-visual/);
 assert.match(online,/hit-synergy-visual/);
});


test('deploy reconnect refreshes pending run from PostgreSQL after the new instance booted', () => {
  assert.match(server, /async function refreshDeployResumeFromPersistence\(userKey\)/);
  assert.match(server, /payload\.reconnect===true.*refreshDeployResumeFromPersistence/s);
  assert.match(server, /state_key='users'/);
});

test('authoritative electric chain is broadcast to the whole room', () => {
  assert.match(server, /skillId==='electric'.*electricLevel/s);
  assert.match(server, /distance<190\/WORLD_ZOOM/);
  assert.match(server, /io\.to\(channelFor\(room\)\)\.emit\('hit-synergy-visual',\{type:'electric-arc'/);
});


test('online build transport preserves combat levels required by co-op and PvP authority', () => {
 assert.match(online,/function sendBuild[\s\S]*ricochetLevel:[\s\S]*electricLevel:[\s\S]*shellLevel:[\s\S]*lastStandLevel:/);
 assert.match(server,/p\.ricochetLevel = clamp/);
 assert.match(server,/p\.electricLevel = clamp/);
 assert.match(server,/source==='electric'&&Number\(attacker\.electricLevel\)>0/);
 assert.match(server,/Number\(attacker\.ricochetLevel\)>0&&source!=='ricochet'/);
});

test('shared electric and ricochet visuals are room-wide in co-op and PvP', () => {
 const electricBroadcasts=(server.match(/emit\('hit-synergy-visual',\{type:'electric-arc'/g)||[]).length;
 const ricochetBroadcasts=(server.match(/emit\('hit-synergy-visual',\{type:'ricochet-line'/g)||[]).length;
 assert.ok(electricBroadcasts>=2,'electric must broadcast in PvE and PvP');
 assert.ok(ricochetBroadcasts>=2,'ricochet must broadcast in PvE and PvP');
 assert.match(online,/socket\.on\('hit-synergy-visual'/);
 assert.match(game,/abyssal-hit-synergy-visual/);
});

test('nova is a shot in presets and has authoritative PvP resolution plus shared remote visual', () => {
 assert.match(game,/shots:\['electric','pierce','spread','photon','photonRay','nova','echoShot'\]/);
 assert.match(server,/if\(shot\.special==='nova'\)[\s\S]*novaShotReadyAt[\s\S]*pvpSegmentHitsRock/);
 assert.match(game,/if\(special==='nova'\)[\s\S]*spawnNovaVisual/);
});


test('session resume refreshes PostgreSQL before validating a rolling-deploy handoff', () => {
 assert.match(server,/socket\.on\('resume-session',async/);
 const handler=server.slice(server.indexOf("socket.on('resume-session'"),server.indexOf("socket.on('get-public-profile'"));
 assert.match(handler,/SELECT state_value FROM abyssal_state WHERE state_key='users'/);
 assert.match(handler,/freshMatch/);
 assert.doesNotMatch(handler,/socket\.data\.userKey=key;saveUsers\(\)/);
 assert.match(handler,/socket\.data\.nickname=user\.nickname;socket\.data\.userKey=key;[\s\S]*socket\.emit\('session-resumed'/);
});

test('deploy reconnect still refreshes persisted run again before restoring the room', () => {
 assert.match(server,/payload\.reconnect===true\|\|!u\?\.pendingRunResume/);
 assert.match(server,/refreshDeployResumeFromPersistence\(socket\.data\.userKey\)/);
 assert.match(server,/rooms\.get\(id\)\|\|restoreDeployRoom\(u,id\)/);
});


test('empty live rooms always close while deploy snapshots remain resumable for five minutes', () => {
 const removeHandler=server.slice(server.indexOf('function removeFromRoom'),server.indexOf('function processWorldDamage'));
 assert.match(removeHandler,/if\(room\.players\.size===0\)[\s\S]*clearRoomWorld\(room\)/);
 assert.doesNotMatch(removeHandler,/maintenanceHoldUntil/);
 assert.match(server,/pendingRunResume=\{[\s\S]*expiresAt:Date\.now\(\)\+5\*60\*1000/);
});

test('floating red and blue damage numbers use the current compact readable scale', () => {
 assert.match(game,/900 18px Cinzel, Georgia, serif/);
 assert.match(game,/number\.tone==='passive'\?'#32cfff':'#ff174d'/);
 assert.match(game,/ctx\.lineWidth=1/);
});


test('online pulse batches PvE damage instead of broadcasting every target independently', () => {
 const handler=server.slice(server.indexOf("socket.on('active-ability'"),server.indexOf("socket.on('shared-damage'"));
 assert.match(handler,/const batch=\{damaged:\[\],defeated:\[\],orbs:\[\],accountUpdated:false,worldChanged:false\}/);
 assert.match(handler,/processWorldDamage\(socket,Number\(enemy\.id\),baseDamage,'pulse',batch,'',enemyLookup\)/);
 assert.match(handler,/world-enemies-damaged/);
});

test('ricochet only participates in canonical shot damage', () => {
 assert.match(server,/RICOCHET_SHOT_SKILLS=new Set\(\['electric','pierce','spread','photon','photonRay','nova','echoShot'\]\)/);
 assert.match(server,/RICOCHET_SHOT_SKILLS\.has\(String\(skillId\|\|''\)\)/);
});


test('maintenance reconnect cannot remain forever waiting for session-resumed', () => {
 assert.match(online,/if\(reconnectPending&&reconnectTarget\)\{armReconnectWatchdog\(\);resumeSessionForReconnect\(\);\}/);
 assert.match(online,/reconnectSessionAttempts>=5/);
 assert.match(online,/setTimeout\(\(\)=>\{reconnectSessionRetry=null;if\(reconnectPending&&!authenticated&&socket\?\.connected\)resumeSessionForReconnect\(\);\},1800\)/);
 assert.match(online,/if\(reconnectSessionRetry\)\{clearTimeout\(reconnectSessionRetry\);reconnectSessionRetry=null;\}/);
});


test('transient session validation failure does not erase persisted login token', () => {
 assert.match(online,/const explicitlyExpired=\/expir\|inválid\|invalid\/i/);
 assert.match(online,/if\(explicitlyExpired\)\{sessionToken='';localStorage\.removeItem\('abyssalSessionToken'\);\}/);
});


test('online entry restores a saved session before falling back to the login screen', () => {
 const handler=online.slice(online.indexOf('function connectAndJoin()'),online.indexOf('function joinWorld'));
 assert.match(handler,/if\(sessionToken\)/);
 assert.match(handler,/if\(s\.connected\)s\.emit\('resume-session',\{token:sessionToken\}\)/);
 assert.match(handler,/return;[\s\S]*openLogin\(\)/);
});
