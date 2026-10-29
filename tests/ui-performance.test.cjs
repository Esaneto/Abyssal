'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('download control is outside the menu column and docked discreetly at the upper right', () => {
  const html = read('public/index.html');
  const css = read('public/style.css');
  const contentStart = html.indexOf('<div class="menu-content">');
  const download = html.indexOf('<button id="downloadBtn"');
  const contentEnd = html.indexOf('</div>', contentStart);
  assert.ok(contentStart >= 0 && download > contentStart);
  assert.match(html.slice(contentStart, download), /<\/div>\s*$/);
  assert.match(css, /#menuScreen \.download-cta\{[\s\S]*?top:12px;right:14px/);
  assert.match(css, /min-height:29px;height:29px/);
  assert.match(html, /style\.css\?v=3\.5\.11/);
});

test('menu monster has a frightening toothed grin and the chat is docked beneath its face', () => {
  const css = read('public/style.css');
  assert.match(css, /#menuScreen \.creature-core span\{[\s\S]*?display:block/);
  assert.match(css, /#menuScreen \.creature-core span:before/);
  assert.match(css, /#menuScreen \.creature-core span:after/);
  assert.match(css, /#menuScreen \.menu-creature\{[\s\S]*?top:45%/);
  assert.match(css, /#menuScreen \.global-chat-panel\{[\s\S]*?bottom:34px/);
  assert.match(css, /#menuScreen \.global-chat-panel\.chat-expanded\{display:flex/);
});

test('render work is capped to 60 FPS in combat and 30 FPS while idle', () => {
  const game = read('public/game.js');
  assert.match(game, /minFrameInterval=active\?1000\/60:1000\/30/);
  assert.match(game, /t-lastPaintAt<minFrameInterval-1/);
  assert.match(game, /lowPowerRendering=mobileViewport\|\|cores<=4/);
  assert.match(game, /Math\.min\(window\.devicePixelRatio\|\|1,lowPowerRendering\?1:1\.45\)/);
});

test('canvas rendering caches static gradients and removes repeated terrain and HUD work', () => {
  const game = read('public/game.js');
  const background = game.slice(game.indexOf('function drawBackground(t){'), game.indexOf('function drawCreature(', game.indexOf('function drawBackground(t){')));
  const terrain = game.slice(game.indexOf('function drawArenaTerrain(t){'), game.indexOf('function draw(t){'));
  assert.match(background, /if\(!backgroundGradientCache\)/);
  assert.match(background, /if\(!backgroundBloomCache\)/);
  assert.doesNotMatch(terrain, /createLinearGradient\(-rock\.r/);
  assert.match(game, /function setTextIfChanged\(/);
  assert.match(game, /PROFILE_TITLE_NAMES=Object\.freeze/);
  assert.match(game, /const enemyFrameNow=performance\.now\(\),localTarget=/);
});
