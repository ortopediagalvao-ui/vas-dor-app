const CACHE_NAME = 'vas-dor-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(() => {
        // Fallback if some files can't be cached
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
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
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Never cache POST requests or Google Apps Script calls — they must hit the network
  if (event.request.method !== 'GET' || event.request.url.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ status: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(response => {
        // Cache successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // Fallback for offline
        return caches.match('/index.html');
      });
    })
  );
});
