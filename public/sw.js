/**
 * Offline support for the web build (the Home Screen app on a phone). The production build registers
 * it and stamps VERSION (scripts/finalize-web.ts); the dev server never registers it.
 *
 * Pages: network first, so a new deploy shows up as soon as the phone is online, with the cached page as
 * the offline fallback. Everything else (hashed bundles, fonts, icons): cache first, cached on first use.
 * A new VERSION installs a fresh cache and deletes the old ones.
 */
const VERSION = '__BUILD__';
const CACHE = `sukima-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['/', '/manifest.json']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sukima-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Every route is the same single page, cached under "/". A server error (or a host without the
    // single-page rewrite) also gets the cached page rather than an error screen.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response.ok) return caches.match('/').then((cached) => cached || response);
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put('/', copy)));
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
          }
          return response;
        }),
    ),
  );
});
