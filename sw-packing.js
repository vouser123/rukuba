// Packing List Service Worker
const CACHE_NAME = 'packing-list-v2';
// Only cache assets, not the HTML (which has hardcoded data)
const urlsToCache = [
  '/'
];

// Install service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate service worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch strategy: Always fetch HTML fresh, never cache it
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // NEVER cache HTML files - always fetch fresh
  // This ensures localStorage data persists and default data doesn't override
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '/claude.html') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Only fall back to cache if completely offline AND we have it
        return caches.match(event.request);
      })
    );
    return;
  }

  // For other resources, use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(fetchResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
  );
});
