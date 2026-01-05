// PT Tracker Service Worker
const CACHE_NAME = 'pt-tracker-v1.22.34';
const sharedStylesUrl = new URL('shared-styles.css', self.location).pathname;
const exerciseFormModuleUrl = new URL('shared/exercise_form_module.js', self.location).pathname;
const scopeUrl = new URL('./', self.location).pathname;
// Cache core assets needed for offline use. Cache key HTML pages for offline boot.
const urlsToCache = [
  scopeUrl,
  new URL('pt_tracker.html', self.location).pathname,
  new URL('rehab_coverage.html', self.location).pathname,
  new URL('pt_report.html', self.location).pathname,
  new URL('pt_view.html', self.location).pathname,
  new URL('exercise_editor.html', self.location).pathname,
  new URL('seed_firestore.html', self.location).pathname,
  new URL('exercise_library.json', self.location).pathname,
  new URL('exercise_library_vocabulary.json', self.location).pathname,
  new URL('exercise_roles.json', self.location).pathname,
  new URL('exercise_roles_vocabulary.json', self.location).pathname,
  new URL('schema/exercise_file.schema.json', self.location).pathname,
  new URL('schema/exercise_roles.schema.json', self.location).pathname,
  sharedStylesUrl,
  exerciseFormModuleUrl
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

// Fetch strategy: Network-first for JSON and HTML, cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Fetch HTML from network first, but fall back to cached HTML when offline.
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '/pt_tracker.html') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Fall back to cached HTML when offline (or pt_tracker as a last resort)
        return caches.match(event.request).then(response => {
          return response || caches.match(new URL('pt_tracker.html', self.location).pathname);
        });
      })
    );
    return;
  }

  // Network-first for JSON files - always get latest data
  // This ensures updated roles, exercises, vocabulary propagate immediately
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request)
        .then(fetchResponse => {
          // Update cache with fresh data
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        })
        .catch(() => {
          // Fall back to cache if offline
          return caches.match(event.request);
        })
    );
    return;
  }

  // For other resources (CSS, images), use cache-first strategy
  
  // For other resources (CSS, images), use cache-first strategy
  if (event.request.method !== 'GET') {
    return; // do not try to cache POST/PUT/etc
  }
  
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
