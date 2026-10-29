'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('online players are broadcast from accepted position heartbeats', () => {
  const server = read('server.js');
  assert.match(server, /connectionStateRecovery:\s*\{\s*maxDisconnectionDuration:\s*120000/);
  assert.match(server, /room\.lastPlayersBroadcastAt/);
  assert.match(server, /room\.lastPlayersBroadcastAt[\s\S]*?emit\('world-players'/);
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
  assert.match(game, /function desiredWorldZoom\(\)\{return isMobileDevice\(\) \? 2 : \.78;\}/);
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
  assert.match(html, /style\.css\?v=3\.5\.12/);
  assert.match(html, /game\.js\?v=3\.5\.12/);
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
