/**
 * SWR (Stale-While-Revalidate) cache for the macro data layer.
 * Spec: docs/design/macro-data-layer-spec.md §5
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  staleWindow: number;
  source: string;
}

const cacheStore = new Map<string, CacheEntry<any>>();

export function getCacheEntry<T>(key: string): CacheEntry<T> | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;

  // Beyond stale window — evict
  if (age > entry.ttl + entry.staleWindow) {
    cacheStore.delete(key);
    return null;
  }

  return entry;
}

export function isStale<T>(entry: CacheEntry<T>): boolean {
  return Date.now() - entry.timestamp > entry.ttl;
}

export function setCache<T>(
  key: string,
  data: T,
  ttl: number,
  staleWindow: number,
  source: string
): void {
  cacheStore.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
    staleWindow,
    source,
  });
}

export function invalidateCache(key: string): void {
  cacheStore.delete(key);
}

export function clearCache(): void {
  cacheStore.clear();
}
