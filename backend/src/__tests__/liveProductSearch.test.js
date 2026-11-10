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

const serpHost = "serpapi.com";
const realTimeHost = "real-time-product-search.p.rapidapi.com";
const megaHost = "google-search-master-mega.p.rapidapi.com";
const googleHost = "google-search-master.p.rapidapi.com";
const amazonHost = "real-time-amazon-data.p.rapidapi.com";
const amazonIndia = "https://www.amazon.in/dp/B000000001";
const flipkartHost = "flipkart-fixture.p.rapidapi.com";

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

function amazonListings(url, products) {
  assert.equal(url.hostname, amazonHost);
  assert.equal(url.searchParams.get("country"), "IN");
  return Response.json({ status: "OK", data: { products: products.map(([title, price]) => ({
    product_title: title, product_price: price, currency: "INR", product_url: amazonIndia,
  })) } });
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

test("a successful SerpApi search filters unsuitable offers without using Google Search Master", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
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

test("camera-phone searches compare matching Amazon and Flipkart prices under ₹1.50 lakh", async (t) => {
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
  const previousConfig = env.rapidApi.flipkartSearchConfig;
  env.rapidApi.flipkartSearchConfig = JSON.stringify({
    url: `https://${flipkartHost}/fixture`, queryParam: "term", results: "data.items",
    name: "title", price: "amount", link: "url", availability: "inStock",
  });
  t.after(() => { env.rapidApi.flipkartSearchConfig = previousConfig; });
  t.mock.method(Groq.Chat.Completions.prototype, "create", async () => ({
    choices: [{ message: { content: '{"products":[]}' } }],
  }));
  mockRecommendationPersistence(t);
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    if (url.hostname === serpHost) {
      if (!url.searchParams.get("q").includes("site:amazon.in")) return Response.json({ shopping_results: [] });
      assert.equal(url.searchParams.get("gl"), "in");
      return Response.json({ shopping_results: [
        { title: "Example Camera Phone 256 GB", price: "₹1,19,999", source: "Amazon", product_link: "https://www.google.com/search?ibp=oshop&prds=catalogid:42&gl=in" },
        { title: "Example Camera Phone Plus 512 GB", price: "₹1,25,000", direct_link: "https://www.flipkart.com/item/p/123" },
        { title: "Example Camera Phone Ultra", price: "₹1,50,001", direct_link: amazonIndia },
      ] });
    }
    if (url.hostname === amazonHost) {
      return amazonListings(url, url.searchParams.get("query").includes("Plus") ? [
        ["Example Camera Phone Plus 256 GB", "₹80,000"],
        ["Example Camera Phone Plus 512 GB", "₹1,50,001"],
      ] : [
        ["Example Camera Phone", "₹70,000"],
        ["Example Camera Phone 128 GB", "₹90,000"],
        ["Example Camera Phone 256 GB", "₹1,22,999"],
      ]);
    }
    if (url.hostname === flipkartHost) {
      const items = url.searchParams.get("term").includes("Plus") ? [] : [
        { title: "Example Camera Phone 128 GB", amount: 89000, url: "https://www.flipkart.com/item/p/128" },
        { title: "Example Camera Phone 256 GB", amount: 90000, url: "https://www.flipkart.com/item/p/90000", inStock: false },
        { title: "Example Camera Phone 256 GB", amount: 121999, url: "https://www.flipkart.com/item/p/256" },
      ];
      return Response.json({ data: { items } });
    }
    return Response.json({}, { status: 403 });
  });

  const query = "best phone with great camera under 1.50 lakhs";
  const result = await generateRecommendation(parseRequirementDeterministically(query), undefined, query);
  assert.equal(result.preferences.budget.max, 150000);
  const searchedHosts = fetch.mock.calls.map(({ arguments: [url] }) => url.hostname);
  assert.equal(searchedHosts.filter((host) => host === serpHost).length, 2);
  assert.equal(searchedHosts.filter((host) => host === amazonHost).length, 2);
  assert.equal(searchedHosts.filter((host) => host === flipkartHost).length, 2);
  assert.ok(!searchedHosts.includes(googleHost));
  assert.ok(!searchedHosts.includes(realTimeHost));
  const offers = result.picks.flatMap(({ product }) => product.sellers);
  assert.deepEqual(offers.map(({ platform, price }) => [platform, price]), [["Flipkart", 121999], ["Amazon India", 122999]]);
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
    if (url.hostname === serpHost) {
      return Response.json({ shopping_results: [
        { title: "Example Everyday Laptop 512GB SSD, 16GB RAM", price: "₹60,000", link: amazonIndia },
        ...(preferredOfferAvailable ? [
          { title: "Example Laptop Core Ultra 7, 1TB SSD, 32GB RAM", price: "₹1,55,000", link: amazonIndia },
        ] : []),
      ] });
    }
    if (url.hostname === amazonHost) {
      return amazonListings(url, url.searchParams.get("query").includes("Core Ultra 7")
        ? [["Example Laptop Core Ultra 7, 1TB SSD, 32GB RAM", "₹1,55,000"]]
        : [["Example Everyday Laptop 512GB SSD, 16GB RAM", "₹60,000"]]);
    }
    return Response.json({}, { status: 403 });
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
