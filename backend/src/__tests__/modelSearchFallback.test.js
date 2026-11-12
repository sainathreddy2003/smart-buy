import { test } from "node:test";
import assert from "node:assert/strict";
import { env } from "../config/env.js";
import { clear } from "../services/cache.service.js";
import { searchSuggestedProduct } from "../services/productSearch.service.js";

const model = { name: "Apple MacBook Air M3", brand: "Apple" };
const title = "Apple MacBook Air M3 16GB 512GB SSD";
const amazonUrl = "https://www.amazon.in/dp/B000000001";
const hosts = ["serpapi.com", "real-time-product-search.p.rapidapi.com", "google-search-master-mega.p.rapidapi.com", "google-search-master.p.rapidapi.com", "real-time-amazon-data.p.rapidapi.com"];
const options = { category: "laptop", budget: { max: 200000 }, retailers: ["Amazon India", "Flipkart"], limit: 40 };

function setup(t) {
  const original = { mock: env.useMockData, serp: env.serpApi.key, rapid: env.rapidApi.key, flipkart: env.rapidApi.flipkartSearchConfig };
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
  env.rapidApi.flipkartSearchConfig = null;
  clear();
  t.after(() => {
    env.useMockData = original.mock;
    env.serpApi.key = original.serp;
    env.rapidApi.key = original.rapid;
    env.rapidApi.flipkartSearchConfig = original.flipkart;
    clear();
  });
}

function assertExactModelQuery(url) {
  const nativeAmazon = url.hostname === hosts[4];
  assert.equal(url.searchParams.get(nativeAmazon ? "query" : "q"), model.name);
  assert.equal(url.searchParams.get(nativeAmazon || url.hostname === hosts[1] ? "country" : "gl"), nativeAmazon ? "IN" : "in");
}

function empty(url) {
  if (url.hostname === hosts[0]) return Response.json({ shopping_results: [] });
  if (url.hostname === hosts[1]) return Response.json({ data: { products: [] } });
  if (url.hostname === hosts[4]) return Response.json({ status: "OK", data: { products: [] } });
  return Response.json({ shopping: [] });
}

function realtimeModelOffer() {
  return Response.json({ data: { products: [{
    product_id: "catalogid:exact-fallback", product_title: title,
    offer: { price: "₹1,29,999", currency: "INR", store_name: "Amazon India", offer_page_url: amazonUrl },
  }] } });
}

for (const [reason, rejected] of [
  ["accessory-only", { title: "Apple MacBook Air M3 Replacement Keyboard", price: "₹5,000", link: amazonUrl }],
  ["unapproved retailer", { title, price: "₹1,20,000", link: "https://unapproved.example/product", source: "Unknown Store" }],
  ["over-budget", { title, price: "₹2,00,001", link: amazonUrl }],
  ["wrong model", { title: "Apple MacBook Air M2 16GB 512GB SSD", price: "₹1,20,000", link: amazonUrl }],
]) {
  test(`${reason} primary results continue to a valid exact-model fallback`, async (t) => {
    setup(t);
    const fetch = t.mock.method(globalThis, "fetch", async (url) => {
      assertExactModelQuery(url);
      if (url.hostname === hosts[0]) return Response.json({ shopping_results: [rejected] });
      assert.equal(url.hostname, hosts[1]);
      return realtimeModelOffer();
    });
    const [product] = await searchSuggestedProduct(model, options);
    assert.equal(product.name, title);
    assert.equal(product.sellers[0].price, 129999);
    assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url.hostname), hosts.slice(0, 2));
  });
}

test("a valid primary offer stops without discovery retries or native price enrichment", async (t) => {
  setup(t);
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.hostname, hosts[0]);
    assertExactModelQuery(url);
    return Response.json({ shopping_results: [{ title, price: "₹1,29,999", link: amazonUrl }] });
  });
  assert.equal((await searchSuggestedProduct(model, options))[0].sellers[0].price, 129999);
  assert.equal(fetch.mock.callCount(), 1);
});

test("native Amazon searches the same Groq model only after Google providers have no eligible offer", async (t) => {
  setup(t);
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assertExactModelQuery(url);
    if (url.hostname !== hosts[4]) return empty(url);
    return Response.json({ status: "OK", data: { products: [{
      product_title: title, product_price: "₹1,29,999", currency: "INR", product_url: amazonUrl,
      asin: "B000000001", product_photo: "https://example.com/macbook.jpg", product_star_rating: "4.5", product_condition: "NEW",
    }] } });
  });
  const [product] = await searchSuggestedProduct(model, options);
  assert.equal(product.name, title);
  assert.equal(product.sourceProductId, "B000000001");
  assert.equal(product.image, "https://example.com/macbook.jpg");
  assert.equal(product.sellers[0].platform, "Amazon India");
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url.hostname), hosts);
});

test("all completed empty model searches return an empty result rather than a provider error", async (t) => {
  setup(t);
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assertExactModelQuery(url);
    return empty(url);
  });
  assert.deepEqual(await searchSuggestedProduct(model, options), []);
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url.hostname), hosts);
});

test("when every model provider fails the search reports service unavailability", async (t) => {
  setup(t);
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assertExactModelQuery(url);
    return new Response(null, { status: 503 });
  });
  await assert.rejects(searchSuggestedProduct(model, options), { statusCode: 503 });
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url.hostname), hosts);
});

test("an empty completed response remains a no-match result when later providers fail", async (t) => {
  setup(t);
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assertExactModelQuery(url);
    return url.hostname === hosts[0] ? empty(url) : new Response(null, { status: 503 });
  });
  assert.deepEqual(await searchSuggestedProduct(model, options), []);
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url.hostname), hosts);
});

test("native Amazon cannot replace a shortlisted model with an accessory or different chip", async (t) => {
  setup(t);
  t.mock.method(globalThis, "fetch", async (url) => {
    assertExactModelQuery(url);
    if (url.hostname !== hosts[4]) return empty(url);
    return Response.json({ status: "OK", data: { products: [
      { product_title: "Apple MacBook Air M3 Replacement Keyboard", product_price: "₹5,000", product_url: amazonUrl },
      { product_title: "Apple MacBook Air M2 16GB 512GB SSD", product_price: "₹1,19,999", product_url: "https://www.amazon.in/dp/B000000002" },
    ] } });
  });
  assert.deepEqual(await searchSuggestedProduct(model, options), []);
});

test("a configured Flipkart endpoint is tried last using the same shortlisted model", async (t) => {
  setup(t);
  const flipkartHost = "flipkart-fixture.p.rapidapi.com";
  env.rapidApi.flipkartSearchConfig = JSON.stringify({
    url: `https://${flipkartHost}/search`, queryParam: "term", results: "items", name: "title", price: "price", link: "url",
  });
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    if (url.hostname !== flipkartHost) {
      assertExactModelQuery(url);
      return empty(url);
    }
    assert.equal(url.searchParams.get("term"), model.name);
    return Response.json({ items: [{ title, price: "₹1,28,999", url: "https://www.flipkart.com/macbook-air/p/item123" }] });
  });
  const [product] = await searchSuggestedProduct(model, options);
  assert.equal(product.sellers[0].platform, "Flipkart");
  assert.equal(product.sellers[0].price, 128999);
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url.hostname), [...hosts, flipkartHost]);
});
