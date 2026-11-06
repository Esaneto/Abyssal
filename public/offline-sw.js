/* Abyssal offline shell. Do not cache account, API, payment or socket traffic. */
'use strict';
const VERSION = '2026-11-06-organic-fossas-v8';
const CACHE_NAME = 'abyssal-game-shell-' + VERSION;
const CACHE_PREFIX = 'abyssal-game-shell-';
const GAME_FILES = [
  'index.html',
  'manifest.webmanifest',
  'favicon.svg',
  'abyssal-icon.svg',
  'style.css',
  'abyssal-rebuild.css',
  'abyssal-menu-orbit.css',
  'abyssal-shop-blood-theme.css',
  'abyssal-interface-harmony.css',
  'offline-ui.css',
  'abyssal-ocean-cinema.svg',
  'ocean-entry.svg',
  'abyssal-tentacle-cursor.svg',
  'abyssal-specimen-tentacles.svg',
  'i18n.js',
  'skin-abilities.js',
  'abyssal-curated-skins.js',
  'abyssal-menu-orbit.js',
  'enemy-ai.js',
  'abyssal-expedition-rules.js',
  'abyssal-map.js',
  'abyssal-rift-hardcore.js',
  'abyssal-tutorial-art.js',
  'abyssal-tutorials.js',
  'abyssal-tutorials.css',
  'enemy-netcode.js',
  'skill-audio.js',
  'photon-ray-config.js',
  'ocean-terrain.js',
  'game.js',
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
    await cache.addAll(GAME_FILES.map(p => new URL(p, self.registration.scope).href));
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
    const cacheRequest = new Request(new URL(isNavigation ? 'index.html' : shellPath.slice(1), self.registration.scope));
    // A failed connection must never return API data or a stale authenticated page.
    const cached = await cache.match(cacheRequest, { ignoreSearch: true });
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
    if (isNavigation && cached && typeof navigator !== 'undefined' && navigator.onLine === false) return cached;
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), isNavigation ? 1500 : 1200);
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
