/**
 * Service Worker - PWA Offline Support
 *
 * Strategy: Network-first for everything.
 * - Online: always fetch from server, update cache with fresh copy
 * - Offline: fall back to cached version
 * - API calls: network-only (no caching, offline.js manages IndexedDB)
 */

const CACHE_NAME = 'pt-tracker-v9';
const STATIC_ASSETS = [
  '/index.html',
  '/pt_editor.html',
  '/pt_view.html',
  '/rehab_coverage.html',
  '/reset-password.html',
  '/js/offline.js',
  '/js/pt_editor.js',
  '/js/hamburger-menu.js',
  '/js/vendor/supabase.min.js',
  '/css/main.css',
  '/css/hamburger-menu.css',
  '/icons/icon.svg',
  '/manifest.json'
];

/**
 * Install - pre-cache static assets for offline use
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

/**
 * Activate - clean up old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

/**
 * Fetch - network-first for all requests
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: network-only, no caching (offline.js handles IndexedDB)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Offline - please sync when online' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // Everything else: network-first, cache fallback for offline
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // No cache available — return offline message for navigation
          if (request.mode === 'navigate') {
            return new Response('Offline - no cached version available', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          }
          return new Response('', { status: 503 });
        });
      })
  );
});
