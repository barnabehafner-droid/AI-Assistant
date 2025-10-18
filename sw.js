// sw.js

const CACHE_NAME = 'ai-organizer-cache-v5';
const BASE_PATH = '/AI-Assistant/';
const urlsToCache = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.json`,
  'https://i.imgur.com/Kh5mOZ0.png',
  'https://cdn.tailwindcss.com',
  'https://accounts.google.com/gsi/client'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        const cachePromises = urlsToCache.map(urlToCache => {
          return cache.add(urlToCache).catch(err => {
            console.warn(`Failed to cache ${urlToCache}:`, err);
          });
        });
        return Promise.all(cachePromises);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Handle share target navigations specifically.
  // This captures the share data, stores it temporarily, and redirects to the clean app URL.
  if (event.request.method === 'GET' && url.pathname === BASE_PATH && url.searchParams.has('share-target')) {
    console.log('[SW] Share target request intercepted:', event.request.url);
    
    const shareData = {
      title: url.searchParams.get('title') || undefined,
      text: url.searchParams.get('text') || undefined,
      url: url.searchParams.get('url') || undefined,
    };

    // Create a response object with the share data to store in the cache.
    const response = new Response(JSON.stringify(shareData));

    event.respondWith(
      (async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          // Use a specific key for the share data.
          await cache.put('pending-share-data', response);
          console.log('[SW] Share data cached.');
        } catch (error) {
          console.error('[SW] Failed to cache share data:', error);
        }
        
        // Redirect the user to the clean base URL.
        // The app will then pick up the data from the cache on load.
        return Response.redirect(BASE_PATH, 303);
      })()
    );
    return; // Important: stop further processing for this request.
  }

  // Default cache-first strategy for all other requests.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // Not in cache - fetch from network
        return fetch(event.request).then(
          response => {
            // Check if we received a valid response
            if (!response || response.status !== 200) {
              return response;
            }
            // IMPORTANT: Don't cache requests that aren't GET or are to external APIs
            if (event.request.method !== 'GET' || event.request.url.includes('googleapis.com')) {
                return response;
            }
            // Clone the response because it's a stream and can only be consumed once.
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          }
        ).catch(() => {
            // Network request failed, try to return a fallback from cache
            if (event.request.mode === 'navigate') {
              return caches.match(`${BASE_PATH}index.html`);
            }
            // For other types of requests, we don't have a fallback, so the fetch fails.
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
