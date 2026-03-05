/**
 * ======================================
 * IndexedDB Video Cache Hook — Egress-Optimized
 * ======================================
 * Strategy:
 *   1. Check IndexedDB first (serves from local blob — zero egress)
 *   2. If cached, use ETag/Last-Modified HEAD check to see if remote changed
 *      → If unchanged: serve from IndexedDB (zero egress for large video)
 *      → If changed: re-download and update cache
 *   3. This reduces egress from 250MB/screen/update to ~1KB (HEAD request)
 */

const DB_NAME = 'signage-video-cache';
const DB_VERSION = 2;
const STORE_NAME = 'videos';
const MAX_CACHE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB max

interface CacheEntry {
  url: string;
  blob: Blob;
  size: number;
  cachedAt: number;
  etag?: string;
  lastModified?: string;
}

let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // Drop old store if upgrading from v1
      if (db.objectStoreNames.contains(STORE_NAME) && (e.oldVersion ?? 0) < 2) {
        db.deleteObjectStore(STORE_NAME);
      }
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

async function getCacheEntry(url: string): Promise<CacheEntry | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(url);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setCacheEntry(entry: CacheEntry): Promise<void> {
  try {
    const db = await openDB();
    await evictIfNeeded(db, entry.size);
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Silently fail — use remote URL as fallback
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

// ---- In-memory blob URL map for current session ----
const blobUrlCache = new Map<string, string>();

/**
 * Checks if the remote file has changed vs our cached version.
 * Uses a HEAD request (~200 bytes) instead of re-downloading the full file.
 * Returns true if the cache is still valid.
 */
async function isCacheValid(remoteUrl: string, entry: CacheEntry): Promise<boolean> {
  try {
    const res = await fetch(remoteUrl, { method: 'HEAD' });
    if (!res.ok) return true; // Network error → use cache

    const remoteEtag = res.headers.get('etag');
    const remoteLastMod = res.headers.get('last-modified');

    if (remoteEtag && entry.etag) {
      return remoteEtag === entry.etag;
    }
    if (remoteLastMod && entry.lastModified) {
      return remoteLastMod === entry.lastModified;
    }

    // No validation headers available — assume cache is valid for 24h
    const cacheAge = Date.now() - entry.cachedAt;
    return cacheAge < 24 * 60 * 60 * 1000;
  } catch {
    return true; // On network error, use cache
  }
}

/**
 * Returns a local blob URL for the given remote URL.
 * - Serves from memory cache instantly (zero egress)
 * - Serves from IndexedDB after a lightweight HEAD check (< 1KB egress)
 * - Downloads only when cache is missing or file changed
 */
export async function getVideoBlobUrl(remoteUrl: string): Promise<string> {
  // 1. Already in memory this session
  if (blobUrlCache.has(remoteUrl)) {
    return blobUrlCache.get(remoteUrl)!;
  }

  // 2. Check IndexedDB
  const entry = await getCacheEntry(remoteUrl);
  if (entry?.blob) {
    // Validate against remote with a HEAD request (< 1KB egress vs 250MB)
    const valid = await isCacheValid(remoteUrl, entry);
    if (valid) {
      const blobUrl = URL.createObjectURL(entry.blob);
      blobUrlCache.set(remoteUrl, blobUrl);
      console.log('[VideoCache] ✅ Served from IndexedDB (no egress):', remoteUrl.split('/').pop());
      return blobUrl;
    }
    console.log('[VideoCache] 🔄 Cache stale, re-downloading:', remoteUrl.split('/').pop());
  }

  // 3. Download, extract validation headers, and cache
  try {
    console.log('[VideoCache] ⬇️ Downloading:', remoteUrl.split('/').pop());
    const res = await fetch(remoteUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();

    const newEntry: CacheEntry = {
      url: remoteUrl,
      blob,
      size: blob.size,
      cachedAt: Date.now(),
      etag: res.headers.get('etag') ?? undefined,
      lastModified: res.headers.get('last-modified') ?? undefined,
    };

    await setCacheEntry(newEntry);

    const blobUrl = URL.createObjectURL(blob);
    blobUrlCache.set(remoteUrl, blobUrl);
    console.log('[VideoCache] ✅ Cached to IndexedDB:', remoteUrl.split('/').pop());
    return blobUrl;
  } catch (err) {
    console.warn('[VideoCache] ⚠️ Failed to cache, using remote URL:', err);
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
