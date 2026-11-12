import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Groq from "groq-sdk";
import { Product } from "../models/Product.js";
import { PriceHistory } from "../models/PriceHistory.js";
import { Recommendation, serializeRecommendation } from "../models/Recommendation.js";
import { clear } from "../services/cache.service.js";
import { env } from "../config/env.js";
import { searchProducts } from "../services/productSearch.service.js";
import { parseRequirementDeterministically } from "../utils/deterministicParser.js";

env.groq.apiKey ??= "test";
env.groq.liveSearch = false;
const { generateRecommendation } = await import("../services/recommendation.service.js");

const serpHost = "serpapi.com";
const realTimeHost = "real-time-product-search.p.rapidapi.com";
const megaHost = "google-search-master-mega.p.rapidapi.com";
const googleHost = "google-search-master.p.rapidapi.com";
const amazonIndia = "https://www.amazon.in/dp/B000000001";
const flipkartHost = "flipkart-fixture.p.rapidapi.com";

beforeEach(() => clear());

function realTimeListings(url, name, headers = {}) {
  assert.equal(url.hostname, realTimeHost);
  assert.equal(url.pathname, "/search");
  assert.equal(url.searchParams.get("country"), "in");
  assert.equal(url.searchParams.get("language"), "en");
  return Response.json({ data: { products: [{
    product_id: "catalogid:42,gpcid:43", product_title: name,
    offer: { price: "₹55,000", currency: "INR", offer_page_url: amazonIndia, store_name: "Amazon India" },
  }] } }, { headers });
}

function shoppingListings(url, listings) {
  assert.equal(url.hostname, serpHost);
  assert.equal(url.searchParams.get("engine"), "google_shopping");
  assert.equal(url.searchParams.get("gl"), "in");
  return Response.json({ shopping_results: listings });
}

function mockRecommendationPersistence(t) {
  const savedProducts = new Map();
  t.mock.method(Product, "findOneAndUpdate", async (_, { $set }) => {
    const saved = { _id: $set.name, ...$set };
    savedProducts.set(saved._id, saved);
    return saved;
  });
  t.mock.method(PriceHistory, "create", async () => {});
  t.mock.method(Recommendation, "create", async (data) => ({
    populate: async () => {},
    toObject: () => ({ ...data, picks: data.picks.map((pick) => ({
      ...pick, product: { ...savedProducts.get(pick.product) },
    })) }),
  }));
}

test("saved product and recommendation prices exclude unapproved sellers", () => {
  const sellers = [
    { platform: "Ovantica", price: 62000, currency: "INR", url: "https://ovantica.com/item" },
    { platform: "Amazon", price: 68000, currency: "INR", url: amazonIndia },
    { platform: "Flipkart", price: 70000, currency: "INR", url: "https://www.flipkart.com/item/p/123" },
    { platform: "Croma", price: 65000, currency: "INR", url: "https://croma.com.example.org/item" },
  ];
  const product = new Product({ name: "Example phone", category: "smartphone", bestPrice: 62000, sellers });
  const publicProduct = JSON.parse(JSON.stringify(product));
  assert.equal(publicProduct.bestPrice, 68000);
  assert.deepEqual(publicProduct.sellers.map(({ platform }) => platform), ["Amazon India", "Flipkart"]);

  const saved = serializeRecommendation({ toObject: () => ({
    preferences: { budget: { max: 69000 } },
    picks: [{ product: product.toObject(), offers: sellers }],
  }) });
  assert.equal(saved.picks[0].product.bestPrice, 68000);
  assert.deepEqual(saved.picks[0].product.sellers.map(({ platform }) => platform), ["Amazon India"]);
});

test("SerpApi searches India first and keeps eligible offers beyond the first result", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.hostname, serpHost);
    assert.equal(url.searchParams.get("engine"), "google_shopping");
    assert.equal(url.searchParams.get("gl"), "in");
    assert.equal(url.searchParams.get("google_domain"), "google.co.in");
    return Response.json({ shopping_results: [
      { title: "Example Laptop", price: "₹40,000", link: "https://ovantica.com/item", source: "Ovantica" },
      { title: "Example Laptop", price: "₹45,000", link: "https://www.amazon.com/dp/B000000001", source: "Amazon India" },
      { title: "Example Laptop", price: "₹50,000", link: "https://www.google.com/shopping/product/42?gl=in", source: "Croma" },
    ] });
  });

  const [product] = await searchProducts("example India laptop", { category: "laptop", limit: 1 });
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(product.sellers[0].platform, "Croma");
  assert.equal(product.sellers[0].price, 50000);
});

test("a SerpApi-only search filters unsuitable offers without substituting another model", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = null;
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.hostname, serpHost);
    assert.equal(url.searchParams.get("gl"), "in");
    return Response.json({ shopping_results: [
      { title: "Example Phone 13", price: "₹60,001", link: amazonIndia },
      { title: "Case for Example Phone 13", price: "₹30,000", link: amazonIndia },
      { title: "Example Phone 13", price: "$499", extracted_price: 499, link: amazonIndia },
      { title: "Example Phone 12", price: "₹50,000", link: amazonIndia },
    ] });
  });

  const results = await searchProducts("Example Phone 13", {
    category: "smartphone",
    modelName: "Example Phone 13",
    budget: { min: 30000, max: 60000 },
  });

  assert.equal(fetch.mock.callCount(), 1);
  assert.deepEqual(results, []);
});

test("a slow primary provider is aborted and an eligible fallback can still win", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
  const fetch = t.mock.method(globalThis, "fetch", async (url, { signal }) => {
    if (url.hostname === serpHost) {
      await new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
    return realTimeListings(url, "Example Laptop");
  });

  // Keep the event loop alive while the native fetch timeout is simulated.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const results = await searchProducts("laptop timeout fixture", {
      category: "laptop",
      budget: { max: 60000 },
    });
    assert.equal(fetch.mock.callCount(), 2);
    assert.equal(fetch.mock.calls[0].arguments[1].signal.aborted, true);
    assert.equal(results[0].sellers[0].price, 55000);
  } finally {
    clearInterval(keepAlive);
  }
});

test("model searches compare camera-phone prices without separate retailer calls", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = null;
  const previousConfig = env.rapidApi.flipkartSearchConfig;
  env.rapidApi.flipkartSearchConfig = JSON.stringify({
    url: `https://${flipkartHost}/fixture`, queryParam: "term", results: "data.items",
    name: "title", price: "amount", link: "url", availability: "inStock",
  });
  t.after(() => { env.rapidApi.flipkartSearchConfig = previousConfig; });
  t.mock.method(Groq.Chat.Completions.prototype, "create", async () => ({
    choices: [{ message: { content: JSON.stringify({ products: [
      { name: "Example Camera Phone Plus", brand: "Example", cameraFit: "strong" },
      { name: "Example Camera Phone", brand: "Example", cameraFit: "strong" },
    ] }) } }],
  }));
  mockRecommendationPersistence(t);
  const name = "Example Camera Phone 256 GB";
  const flipkart = "https://www.flipkart.com/item/p/256";
  const fetch = t.mock.method(globalThis, "fetch", async (url) => shoppingListings(url, [
    { title: name, price: "₹1,22,999", direct_link: amazonIndia },
    { title: name, price: "₹1,21,999", direct_link: flipkart },
    { title: name, price: "$900", extracted_price: 900, direct_link: flipkart },
    { title: name, price: "₹80,000", source: "Flipkart", direct_link: "https://www.flipkart.com.example.org/item/p/256" },
    { title: name, price: "₹81,000", direct_link: flipkart, in_stock: false },
    { title: "Refurbished Example Camera Phone 256 GB", price: "₹89,000", direct_link: flipkart },
    { title: "Case for Example Camera Phone 256 GB", price: "₹900", direct_link: flipkart },
    { title: "Example Camera Phone Plus 512 GB", price: "₹1,50,001", direct_link: flipkart },
  ]));

  const query = "best phone with great camera under 1.50 lakhs";
  const result = await generateRecommendation(parseRequirementDeterministically(query), undefined, query);
  assert.equal(result.preferences.budget.max, 150000);
  assert.equal(fetch.mock.callCount(), 2);
  assert.deepEqual(result.picks.map(({ product }) => product.name), [name]);
  const offers = result.picks.flatMap(({ product }) => product.sellers);
  assert.deepEqual(offers.map(({ platform, price }) => [platform, price]), [["Flipkart", 121999], ["Amazon India", 122999]]);
  assert.equal(result.picks[0].rankingSource, "groq");
  assert.equal(result.picks[0].matchScore, undefined);
});

test("best camera phone under ₹2 lakh follows Groq's camera order and skips value models", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
  mockRecommendationPersistence(t);
  const query = "best camera phone under 2 lakhs";
  const pixelName = "Pixel 10 Pro 256 GB";
  const galaxyName = "Samsung Galaxy S26 Ultra 256 GB";
  t.mock.method(Groq.Chat.Completions.prototype, "create", async ({ messages }) => {
    const request = JSON.parse(messages.at(-1).content);
    assert.equal(request.originalQuery, query);
    assert.equal(request.budget.max, 200000);
    assert.equal(request.cameraFocused, true);
    assert.equal(fetch.mock.callCount(), 0, "Groq runs before either model search");
    assert.equal(request.availableProducts, undefined);
    return { choices: [{ message: { content: JSON.stringify({ products: [
      { name: "Motorola G57 Power 5G", brand: "Motorola", cameraFit: "value" },
      { name: "Google Pixel 10 Pro", brand: "Google", cameraFit: "strong" },
      { name: "Samsung Galaxy S26 Ultra", brand: "Samsung", cameraFit: "strong" },
    ] }) } }] };
  });
  const fetch = t.mock.method(globalThis, "fetch", async (url) => shoppingListings(url, [
    { title: galaxyName, price: "₹1,25,000", direct_link: "https://www.amazon.in/dp/B000000002", rating: 5 },
    { title: "Pixel 10 Pro XL 256 GB", price: "₹98,000", direct_link: amazonIndia },
    { title: pixelName, price: "₹99,000", direct_link: amazonIndia },
    { title: "Motorola G57 Power 5G 256 GB", price: "₹25,000", direct_link: amazonIndia },
  ]));

  const result = await generateRecommendation(parseRequirementDeterministically(query), undefined, query);
  assert.deepEqual(result.picks.map(({ product }) => product.name), [pixelName, galaxyName]);
  assert.ok(result.picks.every(({ rankingSource, matchScore }) => rankingSource === "groq" && matchScore == null));
  assert.equal(fetch.mock.callCount(), 2);
  assert.ok(fetch.mock.calls.every(({ arguments: [url] }) => !/Motorola/i.test(url.searchParams.get("q"))));
});

test("a value-only camera shortlist returns no recommendation instead of a generic top pick", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
  clear();
  t.mock.method(Groq.Chat.Completions.prototype, "create", async () => ({
    choices: [{ message: { content: '{"products":[{"name":"Motorola G57 Power 5G","brand":"Motorola","cameraFit":"value"}]}' } }],
  }));
  const fetch = t.mock.method(globalThis, "fetch", async (url) => shoppingListings(url, [
    { title: "Motorola G57 Power 5G 256 GB", price: "₹25,000", direct_link: amazonIndia },
  ]));
  const query = "best camera phone under 2 lakhs";
  await assert.rejects(generateRecommendation(parseRequirementDeterministically(query), undefined, query), {
    statusCode: 404,
    message: /shortlisted camera phone/,
  });
  assert.equal(fetch.mock.callCount(), 0);
});

test("laptop recommendations prefer the requested price tier and explain cheaper fallbacks", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = null;
  t.mock.method(Groq.Chat.Completions.prototype, "create", async () => ({
    choices: [{ message: { content: '{"products":[{"name":"Example Everyday Laptop","brand":"Example"},{"name":"Example Laptop Core Ultra 7","brand":"Example"}]}' } }],
  }));
  mockRecommendationPersistence(t);

  let preferredOfferAvailable = true;
  const fetch = t.mock.method(globalThis, "fetch", async (url) => shoppingListings(url, [
    { title: "Example Everyday Laptop 512GB SSD, 16GB RAM", price: "₹60,000", link: amazonIndia },
    ...(preferredOfferAvailable ? [
      { title: "Example Laptop Core Ultra 7, 1TB SSD, 32GB RAM", price: "₹1,55,000", link: "https://www.amazon.in/dp/B000000002" },
      { title: "Example Laptop Core Ultra 7, 512GB SSD, 16GB RAM", price: "₹98,000", direct_link: "https://www.flipkart.com/item/p/512" },
    ] : []),
  ]));

  const preferences = { category: "laptop", budgetMax: 200000, useCase: "everyday use" };
  const result = await generateRecommendation(preferences, undefined, "Laptop for everyday use. My budget is 200000");
  assert.deepEqual(result.picks.map(({ product }) => product.bestPrice), [155000]);
  assert.deepEqual(result.picks[0].product.normalizedSpecs, {
    ramGB: 32, storageGB: 1024, cpuTier: 4, gpuTier: undefined,
  });
  assert.deepEqual(result.picks[0].product.sellers.map(({ platform }) => platform), ["Amazon India"]);
  assert.equal(fetch.mock.callCount(), 2);

  preferredOfferAvailable = false;
  clear();
  const fallback = await generateRecommendation(preferences, undefined, "Laptop for everyday use. My budget is 200000");
  assert.deepEqual(fallback.picks.map(({ product }) => product.bestPrice), [60000]);
  assert.match(fallback.summary, /₹1,30,000 and ₹2,00,000.*lower-priced alternatives/);
  assert.equal(fetch.mock.callCount(), 4);

  clear();
  const cheapest = await generateRecommendation(preferences, undefined, "Cheapest laptop for everyday use under ₹2 lakh");
  assert.deepEqual(cheapest.picks.map(({ product }) => product.bestPrice), [60000]);
  assert.doesNotMatch(cheapest.summary, /lower-priced alternatives/);
  assert.equal(fetch.mock.callCount(), 6);
});

test("a recommendation switches providers after a failure and uses the fallback's prices", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
  t.mock.method(Groq.Chat.Completions.prototype, "create", async () => ({
    choices: [{ message: { content: '{"products":[{"name":"Fallback Work Laptop","brand":"Fallback"}]}' } }],
  }));
  mockRecommendationPersistence(t);
  const title = "Fallback Work Laptop, 512GB SSD, 16GB RAM";
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    if (url.hostname === serpHost) return new Response(null, { status: 503 });
    assert.equal(url.hostname, realTimeHost);
    assert.equal(url.pathname, "/search");
    assert.equal(url.searchParams.get("country"), "in");
    return Response.json({ data: { products: [{
      product_title: title,
      product_id: "catalogid:123",
      offer: { price: "₹57,000", currency: "INR", offer_page_url: amazonIndia, store_name: "Amazon India" },
      offers: [
        { price: "₹56,000", currency: "INR", offer_page_url: "https://www.flipkart.com/laptop/p/123", store_name: "Flipkart" },
        { price: "₹40,000", currency: "INR", store_name: "Flipkart" },
        { price: "₹41,000", currency: "INR", offer_page_url: "https://www.flipkart.com/laptop/p/used", store_name: "Flipkart", product_condition: "REFURBISHED" },
      ],
    }] } });
  });

  const result = await generateRecommendation({ category: "laptop", budgetMax: 60000 }, undefined, "Work laptop under ₹60,000");
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url.hostname), [serpHost, realTimeHost]);
  assert.deepEqual(result.picks.map(({ product }) => product.name), [title]);
  assert.deepEqual(result.picks[0].product.sellers.map(({ platform, price }) => [platform, price]), [["Flipkart", 56000], ["Amazon India", 57000]]);
});

test("Google Search Master MEGA and standard use separate discovery caches", async (t) => {
  env.useMockData = false;
  env.serpApi.key = null;
  env.rapidApi.key = "test";
  let megaAvailable = false;
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    if (url.hostname === realTimeHost || (url.hostname === megaHost && !megaAvailable)) {
      return new Response(null, { status: 503 });
    }
    assert.equal(url.searchParams.get("gl"), "in");
    const title = url.hostname === megaHost ? "MEGA Laptop" : "Standard Laptop";
    return Response.json({ shopping: [{ title, price: "₹50,000", link: amazonIndia }] });
  });

  const options = { category: "laptop" };
  const [standard] = await searchProducts("Google provider cache isolation", options);
  assert.equal(standard.name, "Standard Laptop");
  megaAvailable = true;
  const [mega] = await searchProducts("Google provider cache isolation", options);
  assert.equal(mega.name, "MEGA Laptop");
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url.hostname), [realTimeHost, megaHost, googleHost, realTimeHost, megaHost]);
});

test("SerpApi quota exhaustion switches to Real-Time Product Search for India", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    if (url.hostname === serpHost) {
      return Response.json({ error: "Your account has run out of searches." }, { status: 429 });
    }
    return realTimeListings(url, "Quota Fallback Laptop");
  });

  const [product] = await searchProducts("SerpApi quota fallback laptop", { category: "laptop" });
  assert.equal(product.sellers[0].price, 55000);
  assert.equal(product.shoppingHistoryId, "catalogid:42,gpcid:43");
  await searchProducts("another SerpApi quota fallback laptop", { category: "laptop" });
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url.hostname), [serpHost, realTimeHost, realTimeHost]);
});

test("concurrent searches use the last Real-Time request once and fall through MEGA to standard", async (t) => {
  env.useMockData = false;
  env.serpApi.key = null;
  env.rapidApi.key = "test";
  let realTimeCalls = 0;
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    if (url.hostname === realTimeHost) {
      realTimeCalls += 1;
      return realTimeListings(url, "Real-Time Laptop", { "x-ratelimit-requests-remaining": realTimeCalls === 1 ? "1" : "0" });
    }
    if (url.hostname === megaHost) return new Response(null, { status: 429 });
    assert.equal(url.hostname, googleHost);
    assert.equal(url.searchParams.get("gl"), "in");
    return Response.json({ shopping: [{ title: "Google Laptop", price: "₹50,000", link: amazonIndia }] });
  });

  const options = { category: "laptop", budget: { max: 60000 } };
  await searchProducts("quota starting search", options);
  const results = await Promise.all([
    searchProducts("quota parallel search 1", options),
    searchProducts("quota parallel search 2", options),
  ]);
  assert.equal(realTimeCalls, 2);
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url.hostname), [realTimeHost, realTimeHost, megaHost, googleHost]);
  assert.deepEqual(results.map(([product]) => product.name).sort(), ["Google Laptop", "Real-Time Laptop"]);

  const [cached] = await searchProducts("quota starting search", options);
  assert.equal(cached.name, "Real-Time Laptop");
  assert.equal(fetch.mock.callCount(), 4);
});

test("recommendations fail clearly when live search is disabled", async () => {
  env.useMockData = true;
  await assert.rejects(
    generateRecommendation({ category: "laptop", budgetMax: 60000 }),
    { statusCode: 503 }
  );
});
