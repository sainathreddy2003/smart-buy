import { test } from "node:test";
import assert from "node:assert/strict";
import Groq from "groq-sdk";
import { Product } from "../models/Product.js";
import { PriceHistory } from "../models/PriceHistory.js";
import { Recommendation, serializeRecommendation } from "../models/Recommendation.js";
import { clear } from "../services/cache.service.js";
import { env } from "../config/env.js";
import { searchProducts } from "../services/productSearch.service.js";
import { generateRecommendation } from "../services/recommendation.service.js";
import { parseRequirementDeterministically } from "../utils/deterministicParser.js";

const megaHost = "google-search-master-mega.p.rapidapi.com";
const amazonIndia = "https://www.amazon.in/dp/B000000001";

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
  const product = new Product({ name: "Example phone", bestPrice: 62000, sellers });
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

test("Google Search Master searches India first and keeps eligible offers beyond the first result", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.hostname, megaHost);
    assert.equal(url.searchParams.get("gl"), "in");
    assert.ok(Number(url.searchParams.get("num")) > 1);
    return Response.json({ shopping: [
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

test("search skips over-budget and misleading listings and tries SerpApi next", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    const link = amazonIndia;
    if (url.hostname === megaHost) {
      return Response.json({ shopping: [
        { title: "Example Phone 13", price: "₹60,001", link },
        { title: "Case for Example Phone 13", price: "₹30,000", link },
        { title: "Example Phone 13", price: "$499", extracted_price: 499, link },
        { title: "Example Phone 12", price: "₹50,000", link },
      ] });
    }
    assert.equal(url.hostname, "serpapi.com");
    assert.equal(url.searchParams.get("gl"), "in");
    return Response.json({ shopping_results: [
      { title: "Example Phone 13", price: "₹60,000", link: "https://www.google.com/search?q=phone", direct_link: link },
      { title: "Example Phone 13", price: "₹29,999", link },
    ] });
  });

  const results = await searchProducts("Example Phone 13", {
    category: "smartphone",
    modelName: "Example Phone 13",
    budget: { min: 30000, max: 60000 },
  });

  assert.equal(fetch.mock.callCount(), 2);
  assert.equal(results[0].sellers[0].platform, "Amazon India");
  assert.deepEqual(results.flatMap((result) => result.sellers.map((offer) => offer.price)), [60000]);
});

test("a slow primary provider is aborted and an eligible fallback can still win", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
  const fetch = t.mock.method(globalThis, "fetch", async (url, { signal }) => {
    if (url.hostname === megaHost) {
      await new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    }
    assert.equal(url.hostname, "serpapi.com");
    return Response.json({ shopping_results: [{
      title: "Example Laptop", price: "₹55,000", link: amazonIndia,
    }] });
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

test("camera-phone searches retry approved retailers and keep the ₹1.50 lakh ceiling", async (t) => {
  env.useMockData = false;
  env.serpApi.key = null;
  env.rapidApi.key = "test";
  t.mock.method(Groq.Chat.Completions.prototype, "create", async () => ({
    choices: [{ message: { content: '{"products":[]}' } }],
  }));
  mockRecommendationPersistence(t);
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    if (url.hostname !== megaHost) return Response.json({ data: { products: [] } });
    if (!url.searchParams.get("q").includes("site:amazon.in")) return Response.json({ shopping: [] });
    assert.equal(url.searchParams.get("gl"), "in");
    return Response.json({ shopping: [
      { title: "Example Camera Phone", price: "₹1,19,999", source: "Amazon", link: "https://www.google.com/search?ibp=oshop&prds=catalogid:42&gl=in" },
      { title: "Example Camera Phone Plus", price: "₹1,25,000", link: `https://www.google.com/url?q=${encodeURIComponent("https://www.flipkart.com/item/p/123")}` },
      { title: "Example Camera Phone Ultra", price: "₹1,50,001", link: amazonIndia },
      { title: "Example Camera Phone US", price: "₹1,00,000", source: "Amazon", link: "https://www.google.com/search?ibp=oshop&prds=catalogid:43&gl=us" },
      { title: "Example Camera Phone Used", price: "₹70,000", source: "Amazon India", link: "https://www.google.com/url?q=https://ovantica.com/item" },
    ] });
  });

  const query = "best phone with great camera under 1.50 lakhs";
  const result = await generateRecommendation(parseRequirementDeterministically(query), undefined, query);
  assert.equal(result.preferences.budget.max, 150000);
  assert.equal(fetch.mock.callCount(), 3);
  const offers = result.picks.flatMap(({ product }) => product.sellers).sort((a, b) => a.price - b.price);
  assert.deepEqual(offers.map(({ platform, price }) => [platform, price]), [["Amazon India", 119999], ["Flipkart", 125000]]);
  assert.equal(offers[1].url, "https://www.flipkart.com/item/p/123");
});

test("laptop recommendations prefer the requested price tier and explain cheaper fallbacks", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
  t.mock.method(Groq.Chat.Completions.prototype, "create", async () => ({
    choices: [{ message: { content: '{"products":[]}' } }],
  }));
  mockRecommendationPersistence(t);

  let preferredOfferAvailable = true;
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    const link = amazonIndia;
    if (url.hostname === "serpapi.com") {
      return Response.json({ shopping_results: [
        { title: "Example Everyday Laptop 512GB SSD, 16GB RAM", price: "₹60,000", link },
      ] });
    }
    if (url.hostname === megaHost) return Response.json({ shopping: [] });
    return Response.json({ data: { products: [
      { product_title: "Example Over Budget Laptop", price: "₹2,00,001", product_url: link },
      ...(preferredOfferAvailable ? [
        { product_title: "Example Laptop Core Ultra 7, 1TB SSD, 32GB RAM", price: "₹1,55,000", product_url: link },
      ] : []),
    ] } });
  });

  const preferences = { category: "laptop", budgetMax: 200000, useCase: "everyday use" };
  const result = await generateRecommendation(preferences, undefined, "Laptop for everyday use. My budget is 200000");
  assert.deepEqual(result.picks.map(({ product }) => product.bestPrice), [155000]);
  assert.deepEqual(result.picks[0].product.normalizedSpecs, {
    ramGB: 32, storageGB: 1024, cpuTier: 4, gpuTier: undefined,
  });
  assert.match(fetch.mock.calls[0].arguments[0].searchParams.get("q"), /₹130000 to ₹200000/);

  preferredOfferAvailable = false;
  clear();
  const fallback = await generateRecommendation(preferences, undefined, "Laptop for everyday use. My budget is 200000");
  assert.deepEqual(fallback.picks.map(({ product }) => product.bestPrice), [60000]);
  assert.match(fallback.summary, /₹1,30,000 and ₹2,00,000.*lower-priced alternatives/);

  clear();
  const cheapest = await generateRecommendation(preferences, undefined, "Cheapest laptop for everyday use under ₹2 lakh");
  assert.deepEqual(cheapest.picks.map(({ product }) => product.bestPrice), [60000]);
  assert.doesNotMatch(cheapest.summary, /lower-priced alternatives/);
});

test("concurrent searches use the last reported Google Shopping request only once", async (t) => {
  env.useMockData = false;
  env.serpApi.key = null;
  env.rapidApi.key = "test";
  let googleCalls = 0;
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    const link = amazonIndia;
    if (url.hostname === megaHost) {
      googleCalls += 1;
      return Response.json({ shopping: [{ title: "Google Laptop", price: "₹50,000", link }] }, {
        headers: { "x-ratelimit-requests-remaining": googleCalls === 1 ? "1" : "0" },
      });
    }
    assert.equal(url.hostname, "real-time-product-search.p.rapidapi.com");
    assert.equal(url.searchParams.get("country"), "in");
    return Response.json({ data: { products: [
      { product_title: "Fallback Laptop", price: "₹55,000", product_url: link },
    ] } });
  });

  const options = { category: "laptop", budget: { max: 60000 } };
  await searchProducts("quota starting search", options);
  const results = await Promise.all([
    searchProducts("quota parallel search 1", options),
    searchProducts("quota parallel search 2", options),
  ]);
  assert.equal(googleCalls, 2);
  assert.equal(fetch.mock.callCount(), 3);
  assert.deepEqual(results.map(([product]) => product.name).sort(), ["Fallback Laptop", "Google Laptop"]);

  const [cached] = await searchProducts("quota starting search", options);
  assert.equal(cached.name, "Google Laptop");
  assert.equal(fetch.mock.callCount(), 3);
});

test("recommendations fail clearly when live search is disabled", async () => {
  env.useMockData = true;
  await assert.rejects(
    generateRecommendation({ category: "laptop", budgetMax: 60000 }),
    { statusCode: 503 }
  );
});
