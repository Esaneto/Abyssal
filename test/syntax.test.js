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

test('global chat is authenticated, bounded, and rate limited on the server', () => {
  const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(source, /socket\.on\('global-chat-send'/);
  assert.match(source, /CHAT_MESSAGE_LIMIT=180/);
  assert.match(source, /CHAT_RATE_MAX=5/);
  assert.match(source, /globalChatHistory\.splice/);
  assert.match(source, /if\(!socket\.data\.userKey\|\|!socket\.data\.nickname\)/);
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

test('chat renders player content as text, not executable HTML', () => {
  const client = fs.readFileSync(path.join(root, 'public', 'online.js'), 'utf8');
  assert.match(client, /body\.textContent=String\(message\.text\|\|''\)/);
  assert.match(client, /name\.textContent=String\(message\.nickname\|\|'Mergulhador'\)/);
});

test('each title has dedicated vector artwork in the profile', () => {
  const client = fs.readFileSync(path.join(root, 'public', 'online.js'), 'utf8');
  assert.match(client, /const TITLE_ARTWORK=/);
  assert.match(client, /'sovereign-abyss':.*<svg/s);
  assert.match(client, /titleArtwork\(t\.id\)/);
});
