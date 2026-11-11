// A small in-memory TTL cache. Deliberately not Redis — this is a single-process
// demo/portfolio deployment, and an in-memory Map with expiry timestamps covers
// the actual goal (avoid redundant external API calls / repeated heavy queries)
// without adding infrastructure.

const store = new Map();
const pending = new Map();

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
 * `fn()`, caches the result for `ttlMs`, and returns it. Concurrent requests
 * for the same key share the pending call rather than consume another API call.
 */
export async function wrap(key, ttlMs, fn) {
  const cached = get(key);
  if (cached !== undefined) {
    console.log(`[CACHE] Served from cache: ${key}`);
    return cached;
  }
  const existing = pending.get(key);
  if (existing) return existing;

  const request = Promise.resolve().then(fn).then((value) => {
    // A clear() or a replacement request invalidates this call's cache write.
    if (pending.get(key) === request) set(key, value, ttlMs);
    return value;
  }).finally(() => {
    if (pending.get(key) === request) pending.delete(key);
  });
  pending.set(key, request);
  return request;
}

export function clear() {
  store.clear();
  pending.clear();
}
