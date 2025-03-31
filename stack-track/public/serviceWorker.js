// This is the service worker with the Cache-first network strategy

const CACHE = "stacktrack-cache-v1";
const precacheResources = [
  '/',
  '/index.html',
  '/static/js/main.chunk.js',
  '/static/js/0.chunk.js',
  '/static/js/bundle.js',
  '/static/css/main.chunk.css',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  '/favicon.ico'
];

// The install handler takes care of precaching the resources we always need
self.addEventListener('install', event => {
  console.log('Service worker install event!');
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => {
        return cache.addAll(precacheResources);
      })
  );
});

// The activate handler takes care of cleaning up old caches
self.addEventListener('activate', event => {
  console.log('Service worker activate event!');
  
  // Clean up old caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// The fetch handler serves responses for same-origin resources from a cache
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (event.request.url.startsWith(self.location.origin)) {
    // For API calls (Supabase), use network-first strategy
    if (event.request.url.includes('supabase.co')) {
      event.respondWith(
        fetch(event.request)
          .then(response => {
            // Put a copy of the response in the cache if it's valid
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // If network fails, try to get from cache
            return caches.match(event.request);
          })
      );
    } else {
      // For non-API requests, use cache-first strategy
      event.respondWith(
        caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            
            return fetch(event.request)
              .then(response => {
                // Put a copy of the response in the cache
                if (response.status === 200) {
                  const responseClone = response.clone();
                  caches.open(CACHE).then(cache => {
                    cache.put(event.request, responseClone);
                  });
                }
                return response;
              });
          })
      );
    }
  }
});

// Background sync for offline operations
self.addEventListener('sync', event => {
  if (event.tag === 'sync-tournaments') {
    event.waitUntil(syncData());
  }
});

// Function to sync data when connection is restored
async function syncData() {
  // Get pending operations from IndexedDB
  const pendingOperations = await getPendingOperations();
  
  // Process each operation
  for (const op of pendingOperations) {
    try {
      await processOperation(op);
      await markOperationComplete(op.id);
    } catch (error) {
      console.error('Error syncing operation:', error);
    }
  }
}

// These would be implemented with IndexedDB
function getPendingOperations() {
  // This would fetch from IndexedDB in a real implementation
  return Promise.resolve([]);
}

function processOperation(operation) {
  // This would send the operation to your backend
  return Promise.resolve();
}

function markOperationComplete(id) {
  // This would update the operation status in IndexedDB
  return Promise.resolve();
}