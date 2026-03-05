/**
 * ======================================
 * IndexedDB Video Cache Hook
 * ======================================
 * Persists video blobs in IndexedDB so they survive TV power cycles.
 * TV browsers clear HTTP cache on power off — IndexedDB persists.
 */

const DB_NAME = 'signage-video-cache';
const DB_VERSION = 1;
const STORE_NAME = 'videos';
const MAX_CACHE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB max

interface CacheEntry {
  url: string;
  blob: Blob;
  size: number;
  cachedAt: number;
}

let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        store.createIndex('cachedAt', 'cachedAt');
      }
    };

    req.onsuccess = (e) => {
      dbInstance = (e.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    req.onerror = () => reject(req.error);
  });
}

async function getCachedBlob(url: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(url);
      req.onsuccess = () => resolve(req.result?.blob ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setCachedBlob(url: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();

    // Check total size and evict old entries if needed
    await evictIfNeeded(db, blob.size);

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const entry: CacheEntry = { url, blob, size: blob.size, cachedAt: Date.now() };
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Silently fail — we'll just use the remote URL
  }
}

async function evictIfNeeded(db: IDBDatabase, incomingSize: number): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('cachedAt');
    const req = index.openCursor();

    let totalSize = 0;
    const entries: { url: string; size: number; cachedAt: number }[] = [];

    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) {
        entries.push({ url: cursor.value.url, size: cursor.value.size, cachedAt: cursor.value.cachedAt });
        totalSize += cursor.value.size;
        cursor.continue();
      } else {
        // If adding this would exceed limit, evict oldest first
        if (totalSize + incomingSize > MAX_CACHE_SIZE_BYTES) {
          entries.sort((a, b) => a.cachedAt - b.cachedAt);
          let freed = 0;
          for (const entry of entries) {
            if (totalSize - freed + incomingSize <= MAX_CACHE_SIZE_BYTES) break;
            store.delete(entry.url);
            freed += entry.size;
          }
        }
        resolve();
      }
    };

    req.onerror = () => resolve();
  });
}

const blobUrlCache = new Map<string, string>();

/**
 * Returns a local blob URL for the given remote URL.
 * Downloads and caches in IndexedDB on first access.
 */
export async function getVideoBlobUrl(remoteUrl: string): Promise<string> {
  // Already resolved in this session
  if (blobUrlCache.has(remoteUrl)) {
    return blobUrlCache.get(remoteUrl)!;
  }

  // Check IndexedDB
  const cached = await getCachedBlob(remoteUrl);
  if (cached) {
    const blobUrl = URL.createObjectURL(cached);
    blobUrlCache.set(remoteUrl, blobUrl);
    console.log('[VideoCache] Served from IndexedDB:', remoteUrl.split('/').pop());
    return blobUrl;
  }

  // Download and cache
  try {
    console.log('[VideoCache] Downloading for cache:', remoteUrl.split('/').pop());
    const res = await fetch(remoteUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();

    await setCachedBlob(remoteUrl, blob);

    const blobUrl = URL.createObjectURL(blob);
    blobUrlCache.set(remoteUrl, blobUrl);
    console.log('[VideoCache] Cached to IndexedDB:', remoteUrl.split('/').pop());
    return blobUrl;
  } catch (err) {
    console.warn('[VideoCache] Failed to cache, using remote URL:', err);
    return remoteUrl;
  }
}

/**
 * Preloads a video URL into IndexedDB cache (background, non-blocking).
 */
export function preloadVideoToCache(url: string): void {
  getVideoBlobUrl(url).catch(() => {});
}

export function isIndexedDBSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}
