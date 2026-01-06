/**
 * CAISH Service Worker
 * McMaster-Carr inspired caching for instant subsequent loads
 *
 * Strategy:
 * - HTML: Network-first with cache fallback (always fresh content)
 * - CSS/JS: Cache-first with network fallback (immutable assets)
 * - Images: Cache-first with network fallback (preserve photo quality)
 * - Fonts: Cache-first (rarely change)
 */

const CACHE_VERSION = 'caish-v11';
const RUNTIME_CACHE = 'caish-runtime-v11';

// Critical assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/fellowship.html',
  '/mars.html',
  '/events.html',
  '/about.html',
  '/styles.css',
  '/enhancements.js',
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
    // HTML: Stale-while-revalidate for instant loads with fresh content
    event.respondWith(staleWhileRevalidate(request));
  } else if (isImmutableAsset(url.pathname)) {
    // CSS, JS, Images: Cache-first for speed
    event.respondWith(cacheFirst(request));
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
function isImmutableAsset(pathname) {
  return pathname.endsWith('.css') ||
         pathname.endsWith('.js') ||
         pathname.startsWith('/images/') ||
         pathname.includes('.woff') ||
         pathname.includes('.woff2');
}

/**
 * Stale-While-Revalidate Strategy
 * Returns cached version immediately, then updates cache in background
 * Perfect for HTML - instant loads with eventual consistency
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cachedResponse = await cache.match(request);

  // Start network request in background
  const networkPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        // Update cache with fresh response
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  // Return cached version immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }

  // Otherwise wait for network
  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }

  // Final fallback: offline page or generic response
  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
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
