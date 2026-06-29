/* Freakquency service worker — network-first so the app always updates when
   you're online, and falls back to the cache only when offline (so solo play
   still works with no connection). Cross-origin requests (fonts, Firebase) are
   left to the browser. Bump CACHE on each release to evict the old shell. */

const CACHE = 'freakquency-v3';

// Core shell, pre-cached so a cold offline launch has something to serve.
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
      .then(() => self.skipWaiting())   // activate the new SW immediately
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())  // take over open tabs right away
  );
});

// Same-origin GETs: network-first (always fetch the latest, refresh the cache),
// fall back to the cache when offline. This guarantees updates show up instead
// of being pinned to a stale cached copy.
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
