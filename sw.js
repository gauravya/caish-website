/**
 * CAISH Service Worker
 * McMaster-Carr inspired caching for instant subsequent loads
 *
 * Strategy:
 * - HTML: Network-first with cache fallback (always fresh content)
 * - CSS/JS: Stale-while-revalidate (updates with fast responses)
 * - Images: Cache-first with network fallback (preserve photo quality)
 * - Fonts: Stale-while-revalidate (rarely change)
 */

const CACHE_VERSION = 'caish-v16';
const RUNTIME_CACHE = 'caish-runtime-v16';

// Critical assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/fellowship.html',
  '/mars.html',
  '/events.html',
  '/about.html',
  '/desk.html',
  '/styles.css?v=d1e97105',
  '/enhancements.js?v=114f6765',
  '/images/logo.png',
  '/images/favicon.png',
  '/images/caish.gif'
];

// Install: Precache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        // Precache critical assets but don't block on failures
        return Promise.allSettled(
          PRECACHE_ASSETS.map(url =>
            cache.add(url).catch(err => console.log('Precache skip:', url))
          )
        );
      })
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_VERSION && name !== RUNTIME_CACHE)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim()) // Take control immediately
  );
});

// Fetch: Smart caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Determine caching strategy based on resource type
  if (isHTMLRequest(request)) {
    // HTML: Network-first to ensure fresh content
    event.respondWith(networkFirst(request));
  } else if (isImageAsset(url.pathname)) {
    // Images: Cache-first for speed
    event.respondWith(cacheFirst(request));
  } else if (isStaticAsset(url.pathname)) {
    // CSS, JS, Fonts: Stale-while-revalidate for updates
    event.respondWith(staleWhileRevalidate(request));
  } else {
    // Everything else: Network with cache fallback
    event.respondWith(networkFirst(request));
  }
});

// Check if request is for HTML
function isHTMLRequest(request) {
  const url = new URL(request.url);
  const accept = request.headers.get('Accept') || '';
  return accept.includes('text/html') ||
         url.pathname.endsWith('.html') ||
         url.pathname === '/' ||
         (!url.pathname.includes('.') && url.pathname !== '/');
}

// Check if asset is immutable (long-cached)
function isStaticAsset(pathname) {
  return pathname.endsWith('.css') ||
         pathname.endsWith('.js') ||
         pathname.includes('.woff') ||
         pathname.includes('.woff2');
}

function isImageAsset(pathname) {
  return pathname.startsWith('/images/');
}

/**
 * Cache-First Strategy
 * Returns cached version if available, otherwise fetches from network
 * Perfect for immutable assets like images, CSS, JS
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Asset not available', { status: 404 });
  }
}

/**
 * Stale-While-Revalidate Strategy
 * Returns cached version immediately, revalidates in the background
 * Good for CSS/JS so updates eventually show up even with long cache headers
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  const networkFetch = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  if (cachedResponse) {
    networkFetch.catch(() => {});
    return cachedResponse;
  }

  const networkResponse = await networkFetch;
  return networkResponse || new Response('Asset not available', { status: 404 });
}

/**
 * Network-First Strategy
 * Tries network first, falls back to cache
 * Used for dynamic content or API calls
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response('Resource not available', { status: 503 });
  }
}
