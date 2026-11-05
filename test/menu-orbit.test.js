'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = path => fs.readFileSync(path, 'utf8');

test('principal actions keep unique IDs inside the radial navigation', () => {
  const html = read('public/index.html');
  const orbit = html.match(/<nav class="abyss-orbit-navigation"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(orbit, 'radial navigation element must exist');
  [
    'playBtn', 'resonanceBtn', 'wheelBtn', 'onlineBtn', 'shopBtn',
    'catalogBtn', 'rankingsBtn', 'cardumesBtn', 'profileBtn',
    'matchHistoryBtn', 'supportBtn'
  ].forEach(id => {
    const pattern = new RegExp('\\bid="' + id + '"', 'g');
    assert.equal((html.match(pattern) || []).length, 1, id + ' must stay unique');
    assert.match(orbit[1], pattern, id + ' must be in the orbit');
  });
});

test('the descent gate is inserted inside the orbit without changing its events', () => {
  const source = read('public/abyssal-rebuild.js');
  assert.match(source, /orbit\.appendChild\(gate\)/);
  assert.match(source, /buildVortexStreams\(\)/);
  assert.match(source, /id="abyssGateButton"/);
  assert.match(source, /abyssal-start-rift-solo/);
  assert.match(source, /connectAndJoin/);
});

test('menu motion has a reduced-motion option and mobile touch layout', () => {
  const css = read('public/abyssal-menu-orbit.css');
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /@media\(max-width:1000px\),\(pointer:coarse\)/);
  assert.match(css, /abyss-vortex-shaft/);
  assert.match(css, /pointer-events:auto!important/);
});
