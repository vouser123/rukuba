// PT Tracker Service Worker
const CACHE_NAME = 'pt-tracker-v1.8.0';
const libraryUrl = new URL('exercise_library.json', self.location).pathname;
const rolesUrl = new URL('exercise_roles.json', self.location).pathname;
const vocabUrl = new URL('exercise_roles_vocabulary.json', self.location).pathname;
const rolesSchemaUrl = new URL('schema/exercise_roles.schema.json', self.location).pathname;
const scopeUrl = new URL('./', self.location).pathname;
// Only cache assets, not the HTML (which might have updates)
const urlsToCache = [
  scopeUrl,
  libraryUrl,
  rolesUrl,
  vocabUrl,
  rolesSchemaUrl
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
  // This ensures PT tracker gets updates and localStorage persists
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '/pt_tracker.html') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Only fall back to cache if completely offline AND we have it
        return caches.match(event.request);
      })
    );
    return;
  }

  // For other resources (CSS, JS, images), use cache-first strategy
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
