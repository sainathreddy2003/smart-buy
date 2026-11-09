// A small in-memory TTL cache. Deliberately not Redis — this is a single-process
// demo/portfolio deployment, and an in-memory Map with expiry timestamps covers
// the actual goal (avoid redundant external API calls / repeated heavy queries)
// without adding infrastructure.

const store = new Map();

export function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function set(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Returns the cached value for `key` if present and fresh; otherwise calls
 * `fn()`, caches the result for `ttlMs`, and returns it.
 */
export async function wrap(key, ttlMs, fn) {
  const cached = get(key);
  if (cached !== undefined) {
    console.log(`[CACHE] Served from cache: ${key}`);
    return cached;
  }
  const value = await fn();
  set(key, value, ttlMs);
  return value;
}

export function clear() {
  store.clear();
}
