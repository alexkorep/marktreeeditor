const CACHE_NAME = 'marktree-editor-cache-v1';
const BASE_URL = new URL(self.registration.scope).pathname;
const cacheURL = (path) => `${BASE_URL}${path}`.replace(/\/{2,}/g, '/');
const PRE_CACHE_URLS = [
  cacheURL(''),
  cacheURL('index.html'),
  cacheURL('manifest.webmanifest'),
  cacheURL('icons/marktree-icon.svg'),
  cacheURL('icons/marktree-maskable.svg')
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRE_CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return undefined;
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestURL = new URL(request.url);

  if (requestURL.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const networkResponse = await fetch(request);

        if (
          networkResponse &&
          (networkResponse.status === 200 || networkResponse.type === 'opaque')
        ) {
          cache.put(request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        if (request.mode === 'navigate') {
          const fallback = await cache.match(cacheURL('index.html'));
          if (fallback) {
            return fallback;
          }
        }

        throw error;
      }
    })
  );
});
