const { spawnSync } = require('node:child_process');
const { readdirSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');

const ROOT = process.cwd();
const TEST_DIRS = ['test', 'tests'];

const legacyContracts = new Set([
  'test/fossas-portals-icons-cadence.test.js',
  'test/menu-orbit.test.js',
  'tests/abyssal-audio-redesign.test.cjs',
  'tests/background-simulation.test.cjs',
  'tests/cave-map-integration.test.cjs',
  'tests/cave-world-simulation.test.cjs',
  'tests/curated-expansion.test.cjs',
  'tests/diver-hitbox.test.cjs',
  'tests/diver-redesign.test.cjs',
  'tests/enemy-ai.test.cjs',
  'tests/expedition-rebuild.test.cjs',
  'tests/exploration-config.test.js',
  'tests/fossas-boss-join-promo.test.cjs',
  'tests/horror-sfx.test.cjs',
  'tests/ink-trails-gravity-cone.test.cjs',
  'tests/kraken-skin-boss-performance.test.cjs',
  'tests/menu-lab-modernization.test.cjs',
  'tests/menu-ocean-motion.test.cjs',
  'tests/menu-skill-clarity-regression.test.cjs',
  'tests/monster.test.js',
  'tests/multiplayer-response-performance.test.cjs',
  'tests/nightmare-hardcore-suite.test.cjs',
  'tests/ocean-menu-navigation.test.js',
  'tests/payments.test.cjs',
  'tests/photon-ray-consistency.test.cjs',
  'tests/rarity-taxonomy.test.cjs',
  'tests/responsive-cross-platform-layout.test.cjs',
  'tests/rift-rewards.test.cjs',
  'tests/sea-progression.test.cjs',
  'tests/server-runtime.test.cjs',
  'tests/skin-abilities.test.cjs',
  'tests/skin-motion-procedural.test.cjs',
  'tests/social-ui-integration.test.cjs',
  'tests/species-remodel-and-bubble-trails.test.cjs',
  'tests/specimen-ability-rework.test.cjs',
  'tests/specimen-system.test.cjs',
  'tests/submarine-menu-v4.test.cjs',
  'tests/ui-gameplay-regression.test.js',
  'tests/ui-performance.test.cjs',
  'tests/universal-aquatic-motion.test.cjs',
  'tests/world-audio-budget.test.cjs',
  'tests/world-audio.test.cjs',
  'tests/world-simulation.test.cjs'
]);

function walk(dir) {
  const abs = join(ROOT, dir);
  const out = [];
  for (const name of readdirSync(abs)) {
    const path = join(abs, name);
    if (statSync(path).isDirectory()) out.push(...walk(relative(ROOT, path)));
    else if (/\.test\.(?:cjs|js|mjs)$/.test(name)) out.push(relative(ROOT, path).replaceAll('\\', '/'));
  }
  return out;
}

const allTests = TEST_DIRS.flatMap(walk).sort();
const currentTests = allTests.filter((file) => !legacyContracts.has(file));

if (!currentTests.length) {
  console.error('[tests] No current tests discovered.');
  process.exit(2);
}

console.log(`[tests] Running ${currentTests.length} current contract files.`);
console.log(`[tests] ${legacyContracts.size} legacy contract files remain available via npm run test:legacy.`);

const result = spawnSync(process.execPath, ['--test', ...currentTests], {
  cwd: ROOT,
  stdio: 'inherit',
  env: process.env
});

process.exit(result.status ?? 1);
