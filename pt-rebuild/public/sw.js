/**
 * Service Worker - PWA Offline Support
 *
 * Strategy: Network-first for everything.
 * - Online: always fetch from server, update cache with fresh copy
 * - Offline: fall back to cached version
 * - API calls: network-only (no caching, offline.js manages IndexedDB)
 */

const CACHE_NAME = 'pt-tracker-v12';
const STATIC_ASSETS = [
  '/',
  '/program',
  '/pt-view',
  '/rehab',
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
  '/manifest.json',
  '/manifest-tracker.json'
];

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function getNavigationFallback(pathname) {
  const normalized = normalizePathname(pathname);

  if (normalized === '/' || normalized === '/program' || normalized === '/pt-view' || normalized === '/rehab') {
    return normalized;
  }

  if (normalized === '/index.html' || normalized === '/pt_editor.html' || normalized === '/pt_view.html' || normalized === '/rehab_coverage.html') {
    return normalized;
  }

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
          // No cache available for this URL — use a route-aware navigation fallback
          // so migrated Next.js routes do not drop into the legacy /index.html shell.
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
