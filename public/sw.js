/**
 * ======================================
 * Service Worker - Cache First Strategy
 * ======================================
 * Caches all media files (images/videos) from Supabase Storage
 * to eliminate repeated egress on page reloads.
 * Only media from storage is cached; API/DB requests bypass cache.
 */

const CACHE_NAME = 'media-cache-v1';

// Only cache images from Supabase Storage — videos use IndexedDB cache instead
const isMediaRequest = (url) => {
  if (!url.includes('/storage/v1/object/public/')) return false;
  // Skip videos — they use Range Requests for streaming; SW breaks them
  if (url.match(/\.(mp4|webm|mov|avi|mkv)(\?|$)/i)) return false;
  // Only cache images
  return url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i) !== null;
};

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (!isMediaRequest(url)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) {
        return cached;
      }

      try {
        const response = await fetch(event.request);
        if (response.ok) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch (err) {
        console.error('[SW] Fetch failed:', err);
        throw err;
      }
    })
  );
});
