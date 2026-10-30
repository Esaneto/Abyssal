'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Kraken is an actual boss twice the normal boss radius and has slow movement', () => {
  const ai = require('../public/enemy-ai');
  assert.ok(ai.BOSS_KINDS.includes('kraken'));
  assert.equal(ai.ENEMY_STATS.kraken.r, ai.ENEMY_STATS.boss.r * 2);
  assert.ok(ai.ENEMY_STATS.kraken.speed < ai.ENEMY_STATS.boss.speed);
  assert.ok(ai.ENEMY_STATS.kraken.hp > ai.ENEMY_STATS.leviathan.hp);
});

test('Kraken tentacle collision includes arm tips and rejects distant players', () => {
  const ai = require('../public/enemy-ai');
  const pose = ai.krakenTentaclePose(0, 0);
  const enemy = { kind: 'kraken', x: 1000, y: 850, r: ai.ENEMY_STATS.kraken.r, angle: 0, phase: 0 };
  const tip = { x: enemy.x + pose.ex * enemy.r, y: enemy.y + pose.ey * enemy.r, r: 5 };
  assert.equal(ai.touchesKrakenTentacle(enemy, tip), true);
  assert.equal(ai.touchesKrakenTentacle(enemy, { x: 3200, y: 1900, r: 5 }), false);
});

test('every skin presents its own distinct ability and Kraken costs 30,000 coins', () => {
  const game = read('public/game.js');
  const start = game.indexOf('const skinData=[');
  const end = game.indexOf('];\nlet ownedSkins', start);
  assert.ok(start >= 0 && end > start);
  const source = game.slice(start, end);
  const skins = [...source.matchAll(/\{id:'([^']+)'[^}]*?ability:'([^']+)'[^}]*\}/gs)];
  assert.equal(skins.length, 15, 'the catalog should cover all existing skins and Kraken');
  assert.equal(new Set(skins.map(match => match[1])).size, skins.length, 'skin IDs should be unique');
  assert.equal(new Set(skins.map(match => match[2])).size, skins.length, 'each skin ability should have unique copy');
  assert.match(source, /id:'kraken',name:'Kraken do Abismo',color:'#8b5cf6',price:30000/);
  assert.match(game, /class="skin-ability"/);
  const server = read('server.js');
  assert.match(server, /kraken:30000/);
  assert.match(server, /player\.skinId!=='kraken'/);
});

test('menu Kraken uses eight moving arms and a shadowed, toothless maw', () => {
  const html = read('public/index.html');
  const css = read('public/style.css');
  assert.equal((html.match(/class="creature-tentacle t[1-8]"/g)||[]).length, 8);
  assert.match(css, /@keyframes kraken-arm/);
  assert.match(css, /radial-gradient\(ellipse at 50% 38%,#160824/);
  assert.match(css, /#menuScreen \.creature-core span:before,\s*#menuScreen \.creature-core span:after\{content:none;display:none\}/);
});

test('boss-heavy scenes avoid full enemy redraws and all-to-all projectile checks', () => {
  const game = read('public/game.js');
  assert.match(game, /const hostileSpriteCache=new Map\(\)/);
  assert.match(game, /hostileSpriteCache\.get\(key\)/);
  assert.match(game, /enemyCollisionGrid\.clear\(\)/);
  assert.match(game, /projectileCandidates\.push\(enemy\)/);
  assert.match(game, /if\(e\.hp>0&&!p\.hitIds\.includes\(e\.id\)/);
  assert.match(game, /particlePool\.pop\(\)/);
  assert.match(game, /if\(hit>0\)\{c\.globalAlpha=clamp\(hit\*2\.6/);
  assert.match(game, /burst\(newBoss\.x,newBoss\.y,newBoss\.color,newBoss\.kind==='kraken'\?26:32,230\)/);
});

test('boss pursuit ramps toward player speed as health falls and never exceeds it', () => {
  const ai = require('../public/enemy-ai');
  const target = { x: 1000, y: 0, moveSpeed: 100 };
  const healthy = { x: 0, y: 0, speed: 20, kind: 'kraken', hp: 100, maxHp: 100, phase: 0 };
  const critical = { ...healthy, hp: 20 };
  ai.moveTowardTarget(healthy, [target], 0.5, { stopDistance: 0 });
  ai.moveTowardTarget(critical, [target], 0.5, { stopDistance: 0 });
  assert.ok(Math.hypot(healthy.x, healthy.y) <= 10.001);
  assert.ok(Math.hypot(critical.x, critical.y) <= 50.001);
  assert.ok(Math.hypot(critical.x, critical.y) <= target.moveSpeed * 0.5 + 1e-6);
});

test('Kraken identity is consistently violet and no longer uses the smiling name', () => {
  const game = read('public/game.js');
  assert.match(game, /id:'kraken',name:'Kraken do Abismo',color:'#8b5cf6'/);
  assert.match(game, /kraken:\{name:'Kraken do Abismo',color:'#8b5cf6'/);
  assert.doesNotMatch(game, /Sorriso do Abismo|#52c8b5/);
});

test('shop includes one-time abyssal10k redemption for 10,000 coins', () => {
  const html = read('public/index.html');
  const game = read('public/game.js');
  assert.match(html, /id="redeemCodeInput"/);
  assert.match(html, /id="redeemCodeBtn"/);
  assert.match(game, /code!=='abyssal10k'/);
  assert.match(game, /coins\+=10000/);
  assert.match(game, /abyssalRedeemedCodes/);
});
