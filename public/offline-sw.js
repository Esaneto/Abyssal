/* Abyssal offline shell. Do not cache account, API, payment or socket traffic. */
'use strict';
const VERSION = '2026-11-12-native-render-navigation-v130';
const CACHE_NAME = 'abyssal-game-shell-' + VERSION;
const CACHE_PREFIX = 'abyssal-game-shell-';
const GAME_FILES = [
  'index.html',
  'manifest.webmanifest',
  'favicon.svg',
  'abyssal-icon.svg',
  'style.css',
  'abyssal-rebuild.css',
  'abyssal-menu-v2.css',
  'abyssal-menu-navigation.css',
  'abyssal-lab-menu.css',
  'abyssal-submarine-laboratory.css',
  'abyssal-exploration-hud.css',
  'abyssal-cinematic-refresh.css',
  'abyssal-solo-focus.css',
  'abyssal-pet-habits.css',
  'abyssal-feature-gates.js',
  'abyssal-pet-tactics.js',
  'abyssal-solo-cavern.js',
  'abyssal-solo-base.js',
  'abyssal-solo-progress.js',
  'abyssal-solo-hud.css',
  'abyssal-specimen-themes.css',
  'abyssal-shop-blood-theme.css',
  'abyssal-interface-harmony.css',
  'offline-ui.css',
  'abyssal-ocean-cinema.svg',
  'ocean-entry.svg',
  'abyssal-tentacle-cursor.svg',
  'abyssal-red-reticle.svg',
  'abyssal-specimen-tentacles.svg',
  'abyssal-wood-tentacles.svg',
  'server-config.js',
  'i18n.js',
  'skin-standard.js','skin-abilities.js',
  'specimen-system.js',
  'specimen-evasion.js','specimen-rarity.js',
  'abyssal-shop-economy.js',
  'gravity-cone.js',
  'abyssal-curated-skins.js',
  'abyssal-menu-ocean.js',
  'abyssal-submarine-cockpit.js',
  'abyssal-ocean-geography.js',
  'abyssal-open-sea-ecology.js',
  'abyssal-ocean-respawn.js',
  'abyssal-ocean-stream.js',
  'abyssal-cinematic-art.js',
  'abyssal-basalt-material.webp',
  'abyssal-open-sea-render.js',
  'abyssal-open-sea-lighting.js',
  'abyssal-exploration-config.js',
  'abyssal-offshore-system.js',
  'abyssal-extraction-ui.js',
  'abyssal-inventory-ui.css',
  'abyssal-resource-icons.js',
  'abyssal-inventory-ui.js',
  'abyssal-exploration-runtime.js',
  'abyssal-sonar-minimap.js',
  'abyssal-research-system.js',
  'abyssal-resource-fields.js',
  'abyssal-navigation-chart.js',
  'ocean-menu-scenery.js',
  'diver-art.js',
  'diver-hitbox.js',
  'enemy-ai.js',
  'creature-scale.js',
  'rift-wildlife.js',
  'sea-progression.js',
  'abyssal-expedition-rules.js',
  'abyssal-map.js',
  'abyssal-rift-hardcore.js',
  'abyssal-tutorial-art.js',
  'abyssal-tutorials.js',
  'abyssal-tutorials.css',
  'enemy-netcode.js',
  'world-audio.js',
  'skill-audio.js',
  'photon-ray-config.js',
  'ocean-terrain.js',
  'game.js',
  'skin-motion.js',
  'marine-art.js',
  'rift-treasure.js',
  'rift-treasure.css',
  'net-codec.js',
  'online.js',
  'abyssal-rebuild.js',
  'offline-ui.js'
];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Atomic install: never activate a cache missing the files necessary
    // to start solo gameplay. External SDKs/fonts intentionally excluded.
    // Offline HTML loads JS/CSS with ?v= revision parameters. Precache those
    // exact URLs, otherwise the no-stale-fallback fetch policy cannot start
    // the game without a connection even after a successful installation.
    const scope = new URL(self.registration.scope);
    const indexURL = new URL('index.html', scope);
    const indexResponse = await fetch(indexURL, { cache: 'no-store' });
    if (!indexResponse.ok) throw new Error('Offline shell index unavailable');
    const html = await indexResponse.clone().text();
    const versioned = new Map();
    for (const match of html.matchAll(/(?:src|href)="([^"]+[?]v=[^"]+)"/g)) {
      const asset = new URL(match[1], scope);
      if (asset.origin !== scope.origin) continue;
      const name = asset.pathname.slice(scope.pathname.length);
      if (GAME_FILES.includes(name)) versioned.set(name, asset.href);
    }
    await cache.addAll(GAME_FILES.filter(p => p !== 'index.html')
      .map(p => versioned.get(p) || new URL(p, scope).href));
    await cache.put(new Request(indexURL.href), indexResponse);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/') ||
      url.pathname.startsWith('/auth/') || url.pathname.startsWith('/payments/')) return;
  if (request.headers.has('authorization')) return;
  const shellPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const inShell = GAME_FILES.some(p => '/' + p === shellPath);
  const isNavigation = request.mode === 'navigate';
  if (!isNavigation && !inShell) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Exact versioned requests prevent a stale controller from reviving another
    // menu implementation. No silent fallback from v=NEW to unversioned v=OLD.
    const versionedAsset = inShell && !isNavigation && url.searchParams.has('v');
    const cachePath = isNavigation ? 'index.html' : shellPath.slice(1);
    const cacheRequest = new Request(new URL(cachePath + (versionedAsset ? url.search : ''), self.registration.scope));
    const cached = await cache.match(cacheRequest);
    // HTML still prefers the network to receive new releases. Cached static
    // JS/CSS/SVG must not wait 3.5 seconds EACH when a connection is weak:
    // sequential parser-blocking scripts previously delayed Fossas startup.
    if (inShell && !isNavigation && cached) {
      const refresh = fetch(request).then(async response => {
        if (response.ok && response.type === 'basic') {
          await cache.put(cacheRequest, response.clone());
        }
      }).catch(() => {});
      event.waitUntil?.(refresh);
      return cached;
    }
    // For online launches prefer current HTML; serve the offline shell only if
    // that navigation actually fails. No premature timeout that revives old UI.
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), isNavigation ? 10000 : 3500);
    try {
      const response = await fetch(request, { signal: controller.signal });
      if (response.ok && response.type === 'basic') {
        await cache.put(cacheRequest, response.clone());
      }
      return response;
    } catch (error) {
      if (cached) return cached;
      throw error;
    } finally {
      clearTimeout(deadline);
    }
  })());
});
