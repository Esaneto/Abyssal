const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const targets = [
  'server.js',
  'world-simulation.js',
  ...fs.readdirSync(path.join(root, 'public'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => path.join('public', name))
];

for (const relativePath of targets) {
  test(`JavaScript syntax: ${relativePath}`, () => {
    const filename = path.join(root, relativePath);
    const source = fs.readFileSync(filename, 'utf8');
    assert.doesNotThrow(() => new vm.Script(source, { filename }));
  });
}

test('title system has unique IDs and sensible unlock goals', () => {
  const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const block = source.match(/const TITLE_DEFINITIONS=\[([\s\S]*?)\];/);
  assert.ok(block, 'TITLE_DEFINITIONS must exist');
  const ids = [...block[1].matchAll(/id:'([^']+)'/g)].map((match) => match[1]);
  assert.ok(ids.length >= 6, 'expected at least six abyssal titles');
  assert.equal(new Set(ids).size, ids.length, 'title IDs must be unique');
  assert.match(block[1], /kind:'starter'/, 'a starter title must always be available');
});


test('online players receive distinct server-assigned spawn positions', () => {
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const game = fs.readFileSync(path.join(root, 'public', 'game.js'), 'utf8');
  assert.match(server, /occupiedSpawnSlots=new Set/);
  assert.match(server, /spawnSlot:spawnIndex/);
  assert.match(server, /spawn:\{x:p\.x,y:p\.y\}/);
  assert.match(game, /setPlayerPosition:\(x,y\)/);
  assert.match(game, /setPlayerPosition\?\.\(d\.spawn\.x,d\.spawn\.y\)/);
  assert.doesNotMatch(server, /volatile\.emit\('world-players'/);
});


test('each title has dedicated vector artwork in the profile', () => {
  const client = fs.readFileSync(path.join(root, 'public', 'online.js'), 'utf8');
  assert.match(client, /const TITLE_ARTWORK=/);
  assert.match(client, /'sovereign-abyss':.*<svg/s);
  assert.match(client, /titleArtwork\(t\.id\)/);
});


test('profile is gated behind an authenticated account and uses server-owned unlocks', () => {
  const client = fs.readFileSync(path.join(root, 'public', 'online.js'), 'utf8');
  assert.match(client, /if\(!authenticated\|\|!serverAccount\)/);
  assert.match(client, /Entre na sua conta para acessar seu perfil e carregar suas conquistas/);
  assert.match(client, /new Set\(Array\.isArray\(user\.unlockedTitles\)\?user\.unlockedTitles/);
  assert.match(client, /if\(!authenticated\|\|!data\)return/);
  assert.match(client, /\$\('profileScreen'\)\.hidden=true;updateAccount\(\);renderProfile\(\{\}\)/);
});
test('menu has the abyssal visual theme across navigation and modal panels', () => {
  const css = fs.readFileSync(path.join(root, 'public', 'style.css'), 'utf8');
  assert.match(css, /#menuScreen:before/);
  assert.match(css, /#menuScreen \.menu-action:hover/);
  assert.match(css, /\.modal-screen\{background:radial-gradient/);
  assert.match(css, /#menuScreen \.global-chat-panel/);
});
