/* Freakquency service worker — precaches the app shell and serves it
   cache-first so solo play works offline once the app has loaded once.
   Multiplayer still needs the network (Firebase), which fails gracefully. */

const CACHE = 'freakquency-v1';

// Core shell. CSS is split via @import, JS via ES-module imports, so the
// individual files are pulled in and runtime-cached on first load too.
const PRECACHE = [
  '.',
  'index.html',
  'manifest.json',
  'css/main.css',
  'js/main.js',
  'assets/icons/favicon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Same-origin GETs: cache-first, then network (and cache the result).
// Cross-origin (fonts, Firebase) always go to the network.
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
