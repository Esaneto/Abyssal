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

test('every skin has distinct ability copy and paid skins use hosted checkout', () => {
  const game = read('public/game.js').replace(/\r\n/g, '\n');
  const start = game.indexOf('const skinData=[');
  const end = game.indexOf('];\nconst SkinAbilities', start);
  assert.ok(start >= 0 && end > start);
  const source = game.slice(start, end);
  const skins = [...source.matchAll(/\{id:'([^']+)'[^}]*?ability:'([^']+)'[^}]*\}/gs)];
  assert.equal(skins.length, 25, 'the catalog includes the original skins, bosses, four predatory skins, greensnake, and electriceel exclusives');
  for (const id of ['aberration','angler','maw','devourer']) assert.ok(skins.some(match => match[1] === id), `missing boss skin ${id}`);
  assert.equal(new Set(skins.map(match => match[1])).size, skins.length, 'skin IDs should be unique');
  assert.equal(new Set(skins.map(match => match[2])).size, skins.length, 'each skin ability should have unique copy');
  assert.match(source, /id:'kraken',name:'Kraken do Abismo',color:'#8b5cf6',price:30000,paid:true/);
  for (const id of ['violet','leviathan','kraken','aberration','angler','maw','devourer','reefshark','hammerhead','abysscroc','armoredgator']) assert.match(source, new RegExp(`id:'${id}'.*paid:true`));
  assert.match(game, /purchaseStripe\(skin\.id,shopCurrency,gameLanguage\)/);
  assert.doesNotMatch(game, /legalAgeConsent/, 'a self-attestation checkbox must not be presented as age verification');
  assert.match(game, /class="skin-ability"/);
  const server = read('server.js');
  assert.match(server, /kraken:30000/);
  assert.match(server, /player\.skinId!=='kraken'/);
  for (const [id,price] of [['aberration',16000],['angler',19000],['maw',22000],['devourer',35000]]) {
    assert.match(server, new RegExp(`${id}:${price}`));
    assert.match(server, new RegExp(`'${id}'`));
  }
});

test('menu Kraken uses eight moving arms and a shadowed, toothless maw', () => {
  const html = read('public/index.html');
  const css = read('public/style.css');
  assert.doesNotMatch(html, /class="menu-creature"/);
  assert.match(css, /#menuScreen \.menu-creature\{display:none!important\}/);
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

test('Kraken boss renders the same eight-arm violet silhouette as the player skin', () => {
  const game = read('public/game.js');
  assert.match(game, /else if\(kind==='kraken'\)/);
  assert.match(game, /for\(let arm=0;arm<8;arm\+\+\)/);
  assert.match(game, /bodyGrad\('#8b5cf6'\)/);
  assert.match(game, /touchesKrakenTentacle/);
});

test('redeem code input is visible, editable, and can be submitted by Enter', () => {
  const html = read('public/index.html');
  const css = read('public/style.css');
  const game = read('public/game.js');
  assert.match(html, /label for="redeemCodeInput"/);
  assert.match(css, /\.redeem-code-controls input\{display:block;position:relative;z-index:5/);
  assert.match(css, /flex-direction:column;align-items:stretch/);
  assert.match(game, /redeemCodeInput.*addEventListener\('keydown'/);
  assert.match(game, /coins\+=10000/);
});

test('Kraken tentacle poses radiate into all four directions', () => {
  const ai = require('../public/enemy-ai');
  const poses = Array.from({ length: 8 }, (_, i) => ai.krakenTentaclePose(i, 0));
  assert.ok(poses.some(p => p.ex < -0.8 && Math.abs(p.ey) < 1.0), 'left-facing arm');
  assert.ok(poses.some(p => p.ex > 0.8 && Math.abs(p.ey) < 1.0), 'right-facing arm');
  assert.ok(poses.some(p => p.ey < -0.8), 'upward arm');
  assert.ok(poses.some(p => p.ey > 1.0), 'downward arm');
});

test('redeem code is entered in a dedicated modal',()=>{const html=read('public/index.html'),css=read('public/style.css'),game=read('public/game.js');assert.match(html,/id="redeemCodeScreen" class="screen modal-screen redeem-modal-screen"/);assert.match(game,/openRedeemCodeBtn.*openRedeemCodeModal/);assert.match(game,/coins\+=10000/);assert.match(css,/\.redeem-modal-screen\{z-index:12/);});
test('prism spread and photon lance upgrades affect projectile creation',()=>{const game=read('public/game.js');assert.match(game,/id:'spread',name:'Rajada Prismática'/);assert.match(game,/id:'photon',name:'Lança de Fótons'/);assert.match(game,/if\(activeShot==='spread'\)/);assert.match(game,/shotSpeed=430\*\(activeShot==='photon'\?1\+\.22\*shotLevel:1\)\/GAME_WORLD_ZOOM/);});


test('Kraken boss sweep is telegraphed before tentacle contact becomes dangerous',()=>{
 const worldSource=read('world-simulation.js'),game=read('public/game.js');
 assert.match(worldSource,/cycle < 2\.4/);
 assert.match(worldSource,/cycle >= 2\.4 && cycle < 5\.2/);
 assert.match(worldSource,/enemy\.krakenSweepActive === true/);
 assert.match(game,/krakenTelegraph/);
 assert.match(game,/enemyState\?\.phase/);
});
