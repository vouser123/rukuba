/**
 * Service Worker - PWA Offline Support
 *
 * Strategy: Network-first for everything.
 * - Online: always fetch from server, update cache with fresh copy
 * - Offline: fall back to cached version
 * - API calls: network-only (no caching, IndexedDB handles offline queue)
 *
 * STATIC_ASSETS contains only browser-served assets that exist in public/.
 * Legacy HTML/CSS/JS were pruned from nextjs branch (pt-v4y). Do not re-add them.
 */

const CACHE_NAME = 'pt-tracker-v14';
const STATIC_ASSETS = [
  '/',
  '/program',
  '/pt-view',
  '/rehab',
  '/reset-password',
  '/icons/icon.svg',
  '/manifest-tracker.json'
];

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function getNavigationFallback(pathname) {
  const normalized = normalizePathname(pathname);
  const nextjsRoutes = ['/', '/program', '/pt-view', '/rehab', '/reset-password'];
  if (nextjsRoutes.includes(normalized)) return normalized;
  return '/';
}

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
 * Fetch - network-first for all requests.
 * Only GET requests are cached — Cache API rejects PUT/POST/HEAD.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: network-only, no caching (IndexedDB handles offline queue)
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

  // Everything else: network-first, cache fallback for offline.
  // Only cache GET responses — Cache API does not support PUT/POST/HEAD.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.method === 'GET') {
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
          // No cache hit — use route-aware navigation fallback for Next.js routes.
          if (request.mode === 'navigate') {
            const fallbackPath = getNavigationFallback(url.pathname);
            return caches.match(fallbackPath).then((fallbackResponse) => {
              return fallbackResponse || new Response('Offline - no cached version available', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' }
              });
            });
          }
          return new Response('', { status: 503 });
        });
      })
  );
});
