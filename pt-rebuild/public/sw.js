/**
 * Service Worker - PWA Offline Support
 *
 * Strategy:
 * - API calls: Network-first, NO caching (always fresh data from server)
 * - Static assets: Cache-first (HTML/CSS/JS)
 * - Offline fallback: Show "Offline" message for failed API calls
 *
 * CRITICAL: Service Worker does NOT cache API responses.
 * All data goes through IndexedDB cache managed by offline.js.
 */

const CACHE_NAME = 'pt-tracker-v6'; // Bumped to force clean cache
const STATIC_ASSETS = [
  '/index.html',
  '/pt_editor.html',
  '/pt_view.html',
  '/rehab_coverage.html',
  '/reset-password.html',
  '/js/tracker.js',
  '/js/offline.js',
  '/js/report.js',
  '/js/pt_editor.js',
  '/js/hamburger-menu.js',
  '/js/vendor/supabase.min.js',
  '/css/main.css',
  '/css/hamburger-menu.css',
  '/icons/icon.svg',
  '/manifest.json'
];

/**
 * Install - cache static assets
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
 * Fetch - handle requests
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: Network-first, NO caching
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

  // Static assets: Cache-first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
