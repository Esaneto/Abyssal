'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Sfx = require('../public/skill-audio.js');

test('current combat skills have distinct sonic motifs', () => {
  const skillIds = ['power','rate','speed','range','magnet','regen','shield','burst','electric','pierce','ricochet','nova','pulse','dash'];
  for (const id of skillIds) assert.ok(Sfx.PATTERNS[id], `missing sound motif for ${id}`);
  const signatures = skillIds.map(id => JSON.stringify(Sfx.PATTERNS[id]));
  assert.equal(new Set(signatures).size, skillIds.length, 'sound motifs should be distinct');
});

test('sound module gracefully skips playback when Web Audio is unavailable', () => {
  assert.equal(Sfx.play(null, 'power'), false);
  assert.equal(Sfx.play({}, 'not-a-skill'), false);
});
