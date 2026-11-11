import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { clear, get, set, wrap } from "../services/cache.service.js";

beforeEach(() => clear());

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("simultaneous searches for one model share one provider call and cache its result", async () => {
  const response = deferred();
  let calls = 0;
  const fetch = () => { calls += 1; return response.promise; };
  const first = wrap("model:phone", 300000, fetch);
  const second = wrap("model:phone", 300000, fetch);
  await Promise.resolve();
  assert.equal(calls, 1);

  const offers = [{ price: 74999 }];
  response.resolve(offers);
  assert.deepEqual(await Promise.all([first, second]), [offers, offers]);
  assert.equal(await wrap("model:phone", 300000, fetch), offers);
  assert.equal(calls, 1);
});

test("a rejected shared provider call is not cached and the next search retries", async () => {
  const response = deferred();
  let calls = 0;
  const fetch = () => { calls += 1; return response.promise; };
  const first = wrap("model:phone", 300000, fetch);
  const second = wrap("model:phone", 300000, fetch);
  const results = Promise.allSettled([first, second]);
  const error = new Error("Provider unavailable");
  response.reject(error);
  assert.deepEqual(await results, [
    { status: "rejected", reason: error },
    { status: "rejected", reason: error },
  ]);
  assert.equal(calls, 1);
  assert.equal(get("model:phone"), undefined);
  assert.deepEqual(await wrap("model:phone", 300000, () => {
    calls += 1;
    return [];
  }), []);
  assert.equal(calls, 2);
});

test("different models start independent provider calls", async () => {
  const phone = deferred();
  const laptop = deferred();
  const calls = [];
  const first = wrap("model:phone", 300000, () => { calls.push("phone"); return phone.promise; });
  const second = wrap("model:laptop", 300000, () => { calls.push("laptop"); return laptop.promise; });
  await Promise.resolve();
  assert.deepEqual(calls, ["phone", "laptop"]);
  laptop.resolve("laptop offers");
  assert.equal(await second, "laptop offers");
  phone.resolve("phone offers");
  assert.equal(await first, "phone offers");
});

test("clear invalidates a pending cache write without reusing or deleting the replacement call", async () => {
  const stale = deferred();
  const fresh = deferred();
  let calls = 0;
  const oldSearch = wrap("model:phone", 300000, () => { calls += 1; return stale.promise; });
  await Promise.resolve();
  clear();
  const newSearch = wrap("model:phone", 300000, () => { calls += 1; return fresh.promise; });
  await Promise.resolve();
  assert.equal(calls, 2);

  stale.resolve("old offers");
  assert.equal(await oldSearch, "old offers");
  assert.equal(get("model:phone"), undefined);
  const sameNewSearch = wrap("model:phone", 300000, () => {
    calls += 1;
    return "unwanted duplicate";
  });
  fresh.resolve("fresh offers");
  assert.deepEqual(await Promise.all([newSearch, sameNewSearch]), ["fresh offers", "fresh offers"]);
  assert.equal(calls, 2);
  assert.equal(get("model:phone"), "fresh offers");
});

test("cache lifetime still starts when the provider completes and expired results are refreshed", async (t) => {
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const response = deferred();
  const result = wrap("model:phone", 100, () => response.promise);
  now = 5000;
  response.resolve("offers");
  await result;
  now = 5050;
  assert.equal(get("model:phone"), "offers");
  now = 5101;
  assert.equal(get("model:phone"), undefined);
  assert.equal(await wrap("model:phone", 100, () => "updated offers"), "updated offers");
});

test("get, set and clear preserve ordinary cache behavior", () => {
  const offers = [];
  set("model:phone", offers, 300000);
  assert.equal(get("model:phone"), offers);
  clear();
  assert.equal(get("model:phone"), undefined);
});
