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
