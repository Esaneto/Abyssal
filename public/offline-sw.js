/* Abyssal offline shell. Do not cache account, API, payment or socket traffic. */
'use strict';
const VERSION = '2026-11-13-combat-audio-v173';
const CACHE_NAME = 'abyssal-game-shell-' + VERSION;
const CACHE_PREFIX = 'abyssal-game-shell-';
const GAME_FILES = [
  'index.html','terms.html','privacy.html','community.html','store-policy.html',
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
  'loading-screen.js',
  'loading-screen.css',
  'update-manager.js',
  'abyssal-admob.js',
  'client-build.js',
  'developer-tools.js',
  'developer-tools.css',
  'age-slider.js',
  'age-slider.css',
  'mobile-portrait.js',
  'mobile-portrait.css',
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
  'abyssal-sample-audio.js',
  'audio/music/musica.mp3',
  'audio/effects/bite.wav',
  'audio/effects/dano.wav',
  'audio/effects/pulsos.wav',
  'audio/effects/investida.ogg',
  'audio/effects/nuvem_toxica.wav',
  'audio/effects/boss_entrance.wav',
  'audio/effects/collect_orb.wav',
  'audio/effects/eco_da_mare.wav',
  'audio/effects/kill.wav',
  'audio/effects/lanca_de_fotons.wav',
  'audio/effects/lanca_do_abismo.wav',
  'audio/effects/nova_gravitacional.ogg',
  'audio/effects/raio_de_fotons.wav',
  'audio/effects/reparar_sub.wav',
  'audio/effects/submarino_destruido.ogg',
  'audio/effects/tempestade_eletrica.wav',
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
    await cache.addAll(GAME_FILES.filter(p => p !== 'index.html').map(p => versioned.get(p) || new URL(p, scope).href));
    // Cache canonical aliases from the exact installed release, including assets
    // referenced by CSS or dynamically without a version query.
    for (const [name,href] of versioned) {
      const asset=await cache.match(href);if(asset)await cache.put(new URL(name,scope).href,asset);
    }
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
self.addEventListener('message', event => {
 if(event.data?.type!=='abyssal-client-build'||!event.ports?.[0])return;
 event.waitUntil((async()=>{let version='';try{const cache=await caches.open(CACHE_NAME);const response=await cache.match(new URL('client-build.js',self.registration.scope).href);const source=await response?.text();version=source?.match(/version:\s*['\"]([^'\"]+)['\"]/)?.[1]||'';}catch(_){}event.ports[0].postMessage({version});})());
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
    const cachePath = isNavigation && (url.pathname==='/'||url.pathname.endsWith('/index.html')) ? 'index.html' : shellPath.slice(1);
    const cacheRequest = new Request(new URL(cachePath + (!isNavigation && url.searchParams.has('v') ? url.search : ''), self.registration.scope));
    const cached = await cache.match(cacheRequest);
    // A controlled installation always uses one coherent release. New releases
    // are installed atomically by the next worker, never mixed into old HTML.
    if (cached) return cached;
    if(inShell && !isNavigation){
      const canonical=await cache.match(new URL(cachePath,self.registration.scope).href);
      if(canonical)return canonical;
    }
    try {
      const response=await fetch(request);
      if(!response.ok&&isNavigation){const index=await cache.match(new URL('index.html',self.registration.scope).href);if(index)return index;}
      return response;
    } catch(error) {
      if(isNavigation){const index=await cache.match(new URL('index.html',self.registration.scope).href);if(index)return index;}
      return new Response('Offline asset unavailable',{status:503,headers:{'Content-Type':'text/plain'}});
    }
  })());
});
