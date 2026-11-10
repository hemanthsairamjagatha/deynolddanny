/**
 * Cloudflare KV catalog cache — read-only catalog caching at the edge.
 * NEVER write rate-limit state, user data, or counters to KV.
 * KV free tier: 100,000 reads/day, 1,000 writes/day.
 */

/**
 * Reads a cached catalog value from KV. Returns null on cache miss.
 */
export async function getCatalogCache<T>(kv: KVNamespace, key: string): Promise<T | null> {
  try {
    const raw = await kv.get(key, 'text');
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Writes a catalog value to KV with a TTL.
 * ttlSeconds defaults to 300 (5 minutes) for catalog pages.
 */
export async function setCatalogCache(
  kv: KVNamespace,
  key: string,
  data: unknown,
  ttlSeconds = 300,
): Promise<void> {
  try {
    await kv.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds });
  } catch {
    // Cache write failure is non-fatal — the app continues without caching
  }
}

/**
 * Deletes one or more KV cache keys (call after admin product updates).
 */
export async function invalidateCatalogCache(kv: KVNamespace, ...keys: string[]): Promise<void> {
  await Promise.allSettled(keys.map(key => kv.delete(key)));
}

