'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('online players are broadcast from accepted position heartbeats', () => {
  const server = read('server.js');
  const online = read('public/online.js');
  assert.match(server, /connectionStateRecovery:\s*\{\s*maxDisconnectionDuration:\s*120000/);
  assert.match(server, /room\.lastPlayersBroadcastAt/);
  assert.match(server, /room\.lastPlayersBroadcastAt[\s\S]*?emit\('player-motion'/);
  assert.match(server, /io\.to\(channelFor\(room\)\)\.volatile\.emit\('player-motion'/);
  assert.match(online, /socket\.on\('player-motion',rows=>applyPlayerMotion\(rows\)\)/);
});

test('temporary disconnect preserves the last synchronized account profile', () => {
  const online = read('public/online.js');
  const disconnect = online.match(/socket\.on\('disconnect',\(\)=>\{([\s\S]*?)\}\);/);
  assert.ok(disconnect, 'disconnect handler exists');
  assert.doesNotMatch(disconnect[1], /serverAccount=null/);
  assert.doesNotMatch(disconnect[1], /\$\('profileScreen'\)\.hidden=true/);
  assert.match(online, /socket\.on\('session-resumed'/);
});

test('mobile zoom and offensive shot sounds follow the requested settings', () => {
  const game = read('public/game.js');
  assert.match(game, /function desiredWorldZoom\(\)\{return isMobileDevice\(\) \? \.5 : \.78;\}/);
  assert.match(game, /function fire\(\)[\s\S]*?audio\(500,\.045,'sine',\.008\)/);
  assert.match(game, /if\(p\.special\)audio\(500,\.045,'sine',\.008\)/);
});

test('download, fullscreen, account deletion and PWA entry points remain present', () => {
  const html = read('public/index.html');
  const online = read('public/online.js');
  const server = read('server.js');
  assert.match(html, /id="fullscreenBtn"/);
  assert.match(html, /id="downloadScreen"/);
  assert.match(html, /data-platform="windows"/);
  assert.match(html, /data-platform="android"/);
  assert.match(html, /id="installPwaBtn"/);
  assert.match(html, /id="deleteAccountBtn"/);
  assert.match(online, /beforeinstallprompt/);
  assert.match(server, /socket\.on\('delete-account'/);
});


test('chat form cannot trigger a native page refresh when the UI script is delayed or fails', () => {
  const html = read('public/index.html');
  assert.match(html, /globalChatForm[\s\S]*?addEventListener\('submit',event=>\{event\.preventDefault\(\);\},true\)/);
  const online = read('public/online.js');
  assert.match(online, /globalChatForm[\s\S]*?addEventListener\('submit',ev=>\{ev\.preventDefault\(\)/);
});

test('fullscreen has a standalone fallback if the main online UI initialization fails', () => {
  const html = read('public/index.html');
  const online = read('public/online.js');
  assert.match(html, /__abyssalFullscreenHandlerReady/);
  assert.match(html, /requestFullscreen/);
  assert.match(online, /__abyssalFullscreenHandlerReady=true/);
});

test('menu navigation remains a responsive grid with wrapping labels and refreshed assets', () => {
  const html = read('public/index.html');
  const css = read('public/style.css');
  assert.match(html, /style\.css\?v=3\.5\.31/);
  assert.match(html, /game\.js\?v=3\.5\.33/);
  assert.match(css, /#menuScreen \.menu-secondary-actions\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /white-space:normal/);
});


test('Socket.IO account handlers are attached only after connect() creates the socket', () => {
  const online = read('public/online.js');
  const start = online.indexOf('function connect(){');
  const end = online.indexOf('\nfunction authenticate(', start);
  assert.ok(start >= 0 && end > start, 'connect function boundaries exist');
  const connectBody = online.slice(start, end);
  assert.match(connectBody, /socket\.on\('account-deletion-result'/);
  assert.match(connectBody, /socket\.on\('account-force-logout'/);
  assert.doesNotMatch(online.slice(end), /socket\.on\('account-deletion-result'/);
  assert.doesNotMatch(online.slice(end), /socket\.on\('account-force-logout'/);
});

test('Windows and Android downloads have native direct links to published release assets', () => {
  const html = read('public/index.html');
  assert.match(html, /href="https:\/\/github\.com\/Esaneto\/Abyssal\/releases\/latest\/download\/Abyssal-Setup\.exe"/);
  assert.match(html, /href="https:\/\/github\.com\/Esaneto\/Abyssal\/releases\/latest\/download\/Abyssal-Android\.apk"/);
});

test('codex state is cached and snapshot handling never reads localStorage repeatedly', () => {
  const game = read('public/game.js');
  assert.match(game, /function discoverCodexMonsters/);
  assert.match(game, /codexSavePending/);
  const start = game.indexOf('function applySharedSnapshot(data)');
  const end = game.indexOf('function applySharedDamage', start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(game.slice(start, end), /JSON\.parse\(localStorage\.getItem\('abyssalCodex'/);
});

test('menu text uses a larger high-contrast abyssal theme and chat overlays remain clickable', () => {
  const css = read('public/style.css');
  assert.match(css, /#menuScreen \.intro\{[^}]*font-size:clamp\(15px/);
  assert.match(css, /#menuScreen \.menu-action\{[^}]*font-size:clamp\(12px/);
  assert.match(css, /#menuScreen \.menu-creature,#menuScreen:before,#menuScreen:after\{pointer-events:none\}/);
});


test('abyssal10k is permanent, grants 10,000 coins and is limited to one redemption per browser profile', () => {
  const html = read('public/index.html');
  const game = read('public/game.js');
  assert.doesNotMatch(html, /CÓDIGO PERMANENTE · NÃO EXPIRA · \+10\.000 MOEDAS ABISSAIS/);
  assert.match(game, /code!=='abyssal10k'/);
  assert.match(game, /coins\+=10000/);
  assert.match(game, /localStorage\.getItem\('abyssalRedeemedCodes'\)/);
  assert.match(game, /localStorage\.setItem\('abyssalRedeemedCodes'/);
  assert.doesNotMatch(game, /abyssal10k.{0,100}(expiresAt|expiry|expirationDate)/i);
});

test('new shooter upgrades and photon online shot type remain wired', () => {
  const game = read('public/game.js');
  const server = read('server.js');
  assert.match(game, /id:'spread',name:'Rajada Prismática'/);
  assert.match(game, /id:'photon',name:'Lança de Fótons'/);
  assert.match(game, /upgrades\.spread/);
  assert.match(game, /upgrades\.photon/);
  assert.match(server, /'pierce','electric','ricochet','photon'/);
});


test('abyssal10k can be redeemed repeatedly by the same authenticated account', () => {
  const game = read('public/game.js');
  const online = read('public/online.js');
  const server = read('server.js');
  assert.match(game, /window\.AbyssalOnline\.redeemCode\(code\)/);
  assert.match(online, /socket\.emit\('redeem-code'/);
  assert.match(server, /socket\.on\('redeem-code'/);
  assert.match(server, /u\.coins=\(Number\(u\.coins\)\|\|0\)\+10000/);
  assert.doesNotMatch(server, /u\.redeemedCodes\.includes\('abyssal10k'\)/);
});

test('menu ambience and active skills remain present without per-frame current-zone effects', () => {
  const html = read('public/index.html');
  const css = read('public/style.css');
  const game = read('public/game.js');
  assert.match(html, /class="menu-fauna"/);
  assert.match(css, /menuFishSwim/);
  assert.doesNotMatch(game, /function drawCurrentZones|currentSpawnTimer|currentZones/);
  assert.match(game, /function toggleEquippedActiveSkill/);
  assert.match(game, /DESEQUIPAR/);
});


test('online damage rejects stale-room hits quietly and avoids per-hit acknowledgements', () => {
  const game = read('public/game.js');
  const online = read('public/online.js');
  assert.doesNotMatch(game, /IMPACTO NÃO CONFIRMADO/);
  assert.match(game, /if\(\['not-in-room','not-connected','enemy-not-found','ack-timeout'\]\.includes\(reason\)\)return/);
  assert.match(online, /!currentRoom\)return false/);
  assert.match(online, /socket\.emit\('shared-damage'/);
  assert.doesNotMatch(online, /socket\.timeout\(2500\)\.emit\('shared-damage'/);
});

test('solo enemy movement uses the shared AI while online movement stays authoritative', () => {
  const game = read('public/game.js');
  assert.match(game, /if\(onlineMode\)\{[\s\S]*?AbyssalEnemyNetcode\?\.renderedPosition/);
  assert.match(game, /moveTowardTarget\(e,localTargets,dt,soloEnemyMovementOptions,soloEnemyMovementResult\)/);
  assert.doesNotMatch(game, /function drawCurrentZones|currentSpawnTimer|currentZones/);
});


test('Cardumes have authenticated create/join/leave events and durable state',()=>{const server=read('server.js');const html=read('public/index.html');const online=read('public/online.js');assert.match(server,/socket\.on\('create-cardume'/);assert.match(server,/socket\.on\('join-cardume'/);assert.match(server,/socket\.on\('leave-cardume'/);assert.match(server,/persistState\('cardumes', cardumes\)/);assert.match(html,/id="cardumesScreen"/);assert.match(online,/socket\.on\('cardumes-list',renderCardumesList\)/)});
test('menu removes the old octopus artwork',()=>{const html=read('public/index.html');const css=read('public/style.css');assert.doesNotMatch(html,/class="menu-creature"/);assert.match(css,/#menuScreen \.menu-creature\{display:none!important\}/)});


test('paired level-three skills fuse into gravitational and electric chain abilities',()=>{
 const game=read('public/game.js');
 assert.match(game,/gravitationalRupture:[\s\S]*?arcChain:/);
 assert.match(game,/upgradeLevels\.burst>=3&&upgradeLevels\.nova>=3/);
 assert.match(game,/upgradeLevels\.electric>=3&&upgradeLevels\.ricochet>=3/);
 assert.match(game,/dealEnemyDamage\(e,10,'gravitationalRupture'\)/);
 assert.match(game,/dealEnemyDamage\(target,16,'arcChain'\)/);
});

test('Cardume view supports member presence and safe public profiles',()=>{
 const server=read('server.js'),online=read('public/online.js'),html=read('public/index.html'),css=read('public/style.css');
 assert.match(server,/socket\.on\('get-cardume-details'/);
 assert.match(server,/online:online\.has\(key\)/);
 assert.match(server,/socket\.on\('get-public-profile'/);
 assert.match(server,/socket\.on\('toggle-profile-like'/);
 assert.match(server,/target\.likedBy\.push\(viewerKey\)/);
 assert.match(server,/viewer\.likedProfiles\.push\(targetKey\)/);
 assert.match(server,/kind:'likesReceived',required:100/);
 assert.match(server,/kind:'likesGiven',required:25/);
 assert.match(server,/kind:'cardumesCreated',required:1/);
 assert.match(online,/function showCardumeDetail/);
 assert.match(online,/function showPublicProfile/);
 assert.match(online,/socket\.emit\('get-public-profile'/);
 assert.match(html,/id="cardumeMembers"/);
 assert.match(html,/id="likeProfileBtn"/);
 assert.match(html,/id="accountDeletePanel"/);
 assert.match(css,/\.member-presence\.is-online/);
});
