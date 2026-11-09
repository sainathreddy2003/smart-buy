import { env } from "../../config/env.js";

const quotaByHost = new Map();
const DEFAULT_RETRY_DELAY_MS = 60_000;

async function request(url, signal, quota) {
  const response = await fetch(url, {
    signal,
    headers: {
      "x-rapidapi-key": env.rapidApi.key,
      "x-rapidapi-host": url.hostname,
    },
  });

  quota.observed = true;

  // This is the plan allowance, separate from the short-window rate limit.
  const remaining = response.headers.get("x-ratelimit-requests-remaining");
  if (remaining != null && /^\d+$/.test(remaining)) {
    const reported = Number(remaining);
    quota.remaining = Math.min(quota.remaining ?? Infinity, reported);
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    const delay = retryAfter && /^\d+$/.test(retryAfter)
      ? Number(retryAfter) * 1000
      : Date.parse(retryAfter ?? "") - Date.now();
    quota.retryAt = Date.now() + (delay > 0 ? delay : DEFAULT_RETRY_DELAY_MS);
  }

  return response;
}

export async function fetchRapidApiShopping(url, { signal } = {}) {
  const quota = quotaByHost.get(url.hostname) ?? { remaining: null, retryAt: 0, firstRequest: null, observed: false };
  quotaByHost.set(url.hostname, quota);

  // Let the first response establish the allowance before sending concurrent
  // model lookups. Subsequent requests reserve one unit before going out.
  while (quota.firstRequest) {
    await quota.firstRequest;
    signal?.throwIfAborted();
  }
  signal?.throwIfAborted();
  if (quota.remaining === 0) throw new Error("RapidAPI request allowance exhausted");
  if (Date.now() < quota.retryAt) throw new Error("RapidAPI rate limit cooldown");

  if (quota.remaining != null) {
    quota.remaining -= 1;
    return request(url, signal, quota);
  }

  if (quota.observed) return request(url, signal, quota);

  const pending = request(url, signal, quota);
  quota.firstRequest = pending.then(() => {}, () => {});
  try {
    return await pending;
  } finally {
    quota.firstRequest = null;
  }
}
