/**
 * ======================================
 * IndexedDB Video Cache Hook — Egress-Optimized
 * ======================================
 * Strategy:
 *   1. Check IndexedDB first (serves from local blob — zero egress)
 *   2. If cached, validate by comparing content.updated_at timestamp OR ETag/Last-Modified
 *      → If unchanged: serve from IndexedDB (ZERO egress for large video)
 *      → If changed:   re-download and update cache
 *   3. This reduces egress from ~250 MB/screen/update to ~1 KB (HEAD request)
 *
 * Cache invalidation rules (version-based):
 *   - Primary key:   remoteUrl + updatedAt (content.updated_at from DB)
 *   - Fallback:      ETag / Last-Modified headers from HEAD request
 *   - Last resort:   24-hour TTL when no validation headers are available
 *
 * Samsung Smart TV (Tizen) notes:
 *   - IndexedDB IS supported but storage quota is limited (~50 MB–1 GB)
 *   - We stay well within limits by capping MAX_CACHE_SIZE_BYTES at 500 MB on Samsung
 *   - LRU eviction removes oldest entries first when approaching the cap
 */

const DB_NAME    = 'signage-video-cache';
const DB_VERSION = 3;  // bumped from v2 → v3 to add updatedAt index
const STORE_NAME = 'videos';

// Samsung Tizen has ~50MB–1GB quota; use conservative 500 MB there, 2 GB elsewhere
const isSamsung   = /Tizen/i.test(navigator.userAgent);
const MAX_CACHE_BYTES = isSamsung
  ? 500  * 1024 * 1024       // 500 MB for Samsung
  : 2048 * 1024 * 1024;      // 2 GB for Android/Chrome

interface CacheEntry {
  url:          string;   // keyPath — the clean remote URL (no query params)
  blob:         Blob;
  size:         number;
  cachedAt:     number;   // ms since epoch
  updatedAt?:   string;   // content.updated_at from the database (version key)
  etag?:        string;   // HTTP ETag header
  lastModified?: string;  // HTTP Last-Modified header
}

let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db  = (e.target as IDBOpenDBRequest).result;
      const old = e.oldVersion ?? 0;

      // Always start clean when upgrading — old blobs become stale anyway
      if (db.objectStoreNames.contains(STORE_NAME) && old < DB_VERSION) {
        db.deleteObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        store.createIndex('cachedAt',   'cachedAt');
        store.createIndex('updatedAt',  'updatedAt');
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
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(url);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => resolve(null);
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
      tx.onerror    = () => resolve();
    });
  } catch {
    // Silently fail — use remote URL as fallback
  }
}

async function evictIfNeeded(db: IDBDatabase, incomingSize: number): Promise<void> {
  return new Promise((resolve) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('cachedAt');
    const req   = index.openCursor();

    let totalSize = 0;
    const entries: { url: string; size: number; cachedAt: number }[] = [];

    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest).result;
      if (cursor) {
        entries.push({ url: cursor.value.url, size: cursor.value.size, cachedAt: cursor.value.cachedAt });
        totalSize += cursor.value.size;
        cursor.continue();
      } else {
        if (totalSize + incomingSize > MAX_CACHE_BYTES) {
          entries.sort((a, b) => a.cachedAt - b.cachedAt); // oldest first
          let freed = 0;
          for (const entry of entries) {
            if (totalSize - freed + incomingSize <= MAX_CACHE_BYTES) break;
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
 * Strip query-string / token params that break CDN and IndexedDB caching.
 * Supabase public storage URLs should never have tokens, but this is a safety net.
 */
function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove common cache-busting params
    ['t', 'ts', 'token', 'rand', 'random', 'cb', 'cachebust', '_', 'v', 'ver'].forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Validates whether the cached entry is still current.
 *
 * Priority order:
 *   1. content.updated_at match (passed in from the DB — most reliable)
 *   2. ETag / Last-Modified from HEAD request (~200 bytes egress)
 *   3. 24-hour TTL fallback
 */
async function isCacheValid(
  remoteUrl: string,
  entry: CacheEntry,
  contentUpdatedAt?: string
): Promise<boolean> {
  // ── 1. Version check via DB timestamp ──
  // If the caller knows the file's updated_at and we stored it, compare directly.
  // This requires ZERO network requests — pure local comparison.
  if (contentUpdatedAt && entry.updatedAt) {
    const valid = contentUpdatedAt === entry.updatedAt;
    if (!valid) console.log('[VideoCache] 🔄 DB version mismatch, re-downloading:', remoteUrl.split('/').pop());
    return valid;
  }

  // ── 2. ETag / Last-Modified via HEAD request (~200 bytes) ──
  try {
    const res = await fetch(remoteUrl, { method: 'HEAD' });
    if (!res.ok) return true; // network issue → keep using cache

    const remoteEtag    = res.headers.get('etag');
    const remoteLastMod = res.headers.get('last-modified');

    if (remoteEtag && entry.etag) {
      return remoteEtag === entry.etag;
    }
    if (remoteLastMod && entry.lastModified) {
      return remoteLastMod === entry.lastModified;
    }
  } catch {
    return true; // on network error, use cache
  }

  // ── 3. TTL fallback: treat cache as valid for 24h ──
  const cacheAgeMs = Date.now() - entry.cachedAt;
  return cacheAgeMs < 24 * 60 * 60 * 1000;
}

// Track in-flight downloads to avoid duplicate fetches for the same URL
const inflightDownloads = new Map<string, Promise<string>>();

/**
 * Returns a local blob URL for the given remote URL.
 *
 * - Memory cache  → instant, zero egress
 * - IndexedDB hit → version-check (no HEAD needed when updatedAt is provided), near-zero egress
 * - Cache miss    → full download, stored in IndexedDB for all future loads
 *
 * @param remoteUrl       The Supabase Storage URL
 * @param contentUpdatedAt  content.updated_at from the DB — used for version comparison
 */
export async function getVideoBlobUrl(remoteUrl: string, contentUpdatedAt?: string): Promise<string> {
  const cleanedUrl = cleanUrl(remoteUrl);

  // 1. Already resolved this session — instant return, zero egress
  if (blobUrlCache.has(cleanedUrl)) {
    return blobUrlCache.get(cleanedUrl)!;
  }

  // 2. De-duplicate concurrent requests for the same URL
  if (inflightDownloads.has(cleanedUrl)) {
    return inflightDownloads.get(cleanedUrl)!;
  }

  const promise = (async (): Promise<string> => {
    // 3. Check IndexedDB
    const entry = await getCacheEntry(cleanedUrl);
    if (entry?.blob) {
      const valid = await isCacheValid(cleanedUrl, entry, contentUpdatedAt);
      if (valid) {
        const blobUrl = URL.createObjectURL(entry.blob);
        blobUrlCache.set(cleanedUrl, blobUrl);
        console.log('[VideoCache] ✅ Served from IndexedDB (zero egress):', cleanedUrl.split('/').pop());
        return blobUrl;
      }
      console.log('[VideoCache] 🔄 Cache stale, re-downloading:', cleanedUrl.split('/').pop());
    }

    // 4. Download, cache, and serve
    try {
      console.log('[VideoCache] ⬇️ Downloading:', cleanedUrl.split('/').pop());
      const res = await fetch(cleanedUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();

      const newEntry: CacheEntry = {
        url:          cleanedUrl,
        blob,
        size:         blob.size,
        cachedAt:     Date.now(),
        updatedAt:    contentUpdatedAt,
        etag:         res.headers.get('etag')          ?? undefined,
        lastModified: res.headers.get('last-modified') ?? undefined,
      };

      await setCacheEntry(newEntry);

      const blobUrl = URL.createObjectURL(blob);
      blobUrlCache.set(cleanedUrl, blobUrl);
      console.log('[VideoCache] ✅ Cached to IndexedDB:', cleanedUrl.split('/').pop(), `(${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
      return blobUrl;
    } catch (err) {
      console.warn('[VideoCache] ⚠️ Failed to cache, using remote URL:', err);
      return cleanedUrl;
    }
  })();

  inflightDownloads.set(cleanedUrl, promise);
  promise.finally(() => inflightDownloads.delete(cleanedUrl));

  return promise;
}

/**
 * Preloads ONLY the current video into IndexedDB cache (background, non-blocking).
 * Pass contentUpdatedAt for version-based validation — avoids HEAD request entirely.
 */
export function preloadVideoToCache(url: string, contentUpdatedAt?: string): void {
  getVideoBlobUrl(url, contentUpdatedAt).catch(() => {});
}

export function isIndexedDBSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}
