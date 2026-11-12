import { test } from "node:test";
import assert from "node:assert/strict";
import { env } from "../config/env.js";
import { clear } from "../services/cache.service.js";
import { searchProducts, searchSuggestedProduct } from "../services/productSearch.service.js";

const model = { name: "Samsung Galaxy S25", brand: "Samsung" };
const options = { category: "smartphone", budget: { max: 100000 }, retailers: ["Amazon India", "Flipkart"] };
const listing = { title: "Samsung Galaxy S25 256GB", price: "₹74,999", direct_link: "https://www.amazon.in/dp/B000000001" };
const hosts = ["serpapi.com", "real-time-product-search.p.rapidapi.com", "google-search-master-mega.p.rapidapi.com", "google-search-master.p.rapidapi.com"];

function setup(t) {
  const original = { mock: env.useMockData, serp: env.serpApi.key, rapid: env.rapidApi.key };
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
  clear();
  t.after(() => {
    env.useMockData = original.mock;
    env.serpApi.key = original.serp;
    env.rapidApi.key = original.rapid;
    clear();
  });
}

function responseFor(url) {
  if (url.hostname === hosts[0]) return Response.json({ shopping_results: [listing] });
  if (url.hostname === hosts[1]) return Response.json({ data: { products: [{
    product_id: "catalogid:strict-model", product_title: listing.title,
    offer: { price: listing.price, currency: "INR", store_name: "Amazon India", offer_page_url: listing.direct_link },
  }] } });
  return Response.json({ shopping: [{ ...listing, link: listing.direct_link }] });
}

test("a suggested-model lookup cannot start from missing model or brand", async (t) => {
  setup(t);
  const fetch = t.mock.method(globalThis, "fetch", () => assert.fail("Invalid models must not consume a shopping call"));
  for (const invalid of [undefined, {}, { name: " ", brand: "Samsung" }, { name: model.name }, { name: model.name, brand: " " }]) {
    await assert.rejects(searchSuggestedProduct(invalid, options), { statusCode: 400 });
  }
  assert.equal(fetch.mock.callCount(), 0);
});

for (let respondingProvider = 0; respondingProvider < hosts.length; respondingProvider += 1) {
  test(`strict model query stays unchanged through provider ${hosts[respondingProvider]}`, async (t) => {
    setup(t);
    const fetch = t.mock.method(globalThis, "fetch", async (url) => {
      assert.equal(url.searchParams.get("q"), model.name);
      assert.equal(url.searchParams.get(url.hostname === hosts[1] ? "country" : "gl"), "in");
      if (url.hostname.includes("google-search-master")) assert.equal(url.searchParams.get("autocorrect"), "false");
      return url.hostname === hosts[respondingProvider] ? responseFor(url) : new Response(null, { status: 503 });
    });
    const [product] = await searchSuggestedProduct(model, options);
    assert.equal(product.name, listing.title);
    assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url.hostname), hosts.slice(0, respondingProvider + 1));
  });
}

test("a model constraint overrides broad text instead of sending it to a provider", async (t) => {
  setup(t);
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.searchParams.get("q"), model.name);
    return responseFor(url);
  });
  const results = await searchProducts("best camera phones under 1 lakh", { ...options, modelName: model.name, modelBrand: model.brand });
  assert.equal(results.length, 1);
  assert.equal(fetch.mock.callCount(), 1);
});

test("a separate Groq manufacturer is included in the canonical product query", async (t) => {
  setup(t);
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.searchParams.get("q"), "Apple MacBook Air 13 M5");
    return Response.json({ shopping_results: [{ title: "Apple MacBook Air 13.6-inch Laptop with M5 chip", price: "₹1,39,999", direct_link: "https://www.amazon.in/dp/B000000001" }] });
  });
  const products = await searchSuggestedProduct({ name: "MacBook Air 13 (M5)", brand: "Apple" }, { category: "laptop", budget: { max: 200000 } });
  assert.equal(products.length, 1);
  assert.equal(fetch.mock.callCount(), 1);
});

test("a single configured provider cannot substitute an unrelated model", async (t) => {
  setup(t);
  env.rapidApi.key = null;
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.hostname, hosts[0]);
    assert.equal(url.searchParams.get("q"), model.name);
    return Response.json({ shopping_results: [{ ...listing, title: "Samsung Galaxy S25 Ultra 256GB" }] });
  });
  assert.deepEqual(await searchSuggestedProduct(model, options), []);
  assert.equal(fetch.mock.callCount(), 1);
});

test("simultaneous model lookups share a fetch while independently applying each budget", async (t) => {
  setup(t);
  env.rapidApi.key = null;
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    await new Promise((resolve) => setImmediate(resolve));
    return responseFor(url);
  });
  const results = await Promise.all([
    ...Array.from({ length: 6 }, () => searchSuggestedProduct(model, options)),
    searchSuggestedProduct(model, { ...options, budget: { max: 50000 } }),
  ]);
  assert.ok(results.slice(0, 6).every((products) => products.length === 1));
  assert.deepEqual(results[6], []);
  assert.equal(fetch.mock.callCount(), 1);
  await searchSuggestedProduct(model, options);
  assert.equal(fetch.mock.callCount(), 1);
});

test("one caller's deadline does not abort another caller's shared model lookup", async (t) => {
  setup(t);
  const firstController = new AbortController();
  const secondController = new AbortController();
  let finish, providerSignal, markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const fetch = t.mock.method(globalThis, "fetch", (url, { signal }) => {
    assert.equal(url.hostname, hosts[0]);
    providerSignal = signal;
    markStarted();
    return new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      finish = () => resolve(responseFor(url));
    });
  });

  const first = searchSuggestedProduct(model, { ...options, signal: firstController.signal });
  const firstFailure = assert.rejects(first, { statusCode: 503 });
  await started;
  const second = searchSuggestedProduct(model, { ...options, signal: secondController.signal });
  await Promise.resolve();
  firstController.abort(new Error("First shopper's deadline expired"));
  await firstFailure;
  assert.equal(providerSignal.aborted, false);
  assert.equal(secondController.signal.aborted, false);
  finish();

  const [product] = await second;
  assert.equal(product.name, listing.title);
  assert.equal(fetch.mock.callCount(), 1);
  // The completed shared response also remains cached for later shoppers.
  assert.equal((await searchSuggestedProduct(model, options))[0].name, listing.title);
  assert.equal(fetch.mock.callCount(), 1);
});

test("an already-aborted caller does not start a shopping request", async (t) => {
  setup(t);
  const fetch = t.mock.method(globalThis, "fetch", () => assert.fail("Aborted searches must not consume API quota"));
  await assert.rejects(searchSuggestedProduct(model, {
    ...options, signal: AbortSignal.abort(new Error("Search deadline expired")),
  }), { statusCode: 503 });
  assert.equal(fetch.mock.callCount(), 0);
});
