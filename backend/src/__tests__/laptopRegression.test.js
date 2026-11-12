import { test } from "node:test";
import assert from "node:assert/strict";
import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { Product } from "../models/Product.js";
import { Recommendation } from "../models/Recommendation.js";
import { PriceHistory } from "../models/PriceHistory.js";
import { clear } from "../services/cache.service.js";
import { parseRequirementDeterministically } from "../utils/deterministicParser.js";

env.groq.apiKey ??= "test";
const { generateRecommendation } = await import("../services/recommendation.service.js");

test("the reported two-lakh laptop request recovers a researched MacBook from native Amazon after empty Shopping results", async (t) => {
  const previous = { mock: env.useMockData, serp: env.serpApi.key, rapid: env.rapidApi.key, flipkart: env.rapidApi.flipkartSearchConfig, live: env.groq.liveSearch, model: env.groq.model };
  Object.assign(env, { useMockData: false });
  env.serpApi.key = "test";
  env.rapidApi.key = "test";
  env.rapidApi.flipkartSearchConfig = null;
  env.groq.liveSearch = true;
  env.groq.model = "openai/gpt-oss-120b";
  clear();
  t.after(() => {
    env.useMockData = previous.mock;
    env.serpApi.key = previous.serp;
    env.rapidApi.key = previous.rapid;
    env.rapidApi.flipkartSearchConfig = previous.flipkart;
    env.groq.liveSearch = previous.live;
    env.groq.model = previous.model;
    clear();
  });
  const query = "best laptop under 2 lakhs";
  const groq = t.mock.method(Groq.Chat.Completions.prototype, "create", async (request) => {
    assert.equal(request.tools[0].type, "browser_search");
    assert.ok(request.messages[0].content.includes(query));
    return { choices: [{ message: { content: '[{"name":"MacBook Air 13 (M5)","brand":"Apple"}]' } }] };
  });
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.searchParams.get("q") || url.searchParams.get("query"), "Apple MacBook Air 13 M5");
    if (url.hostname === "serpapi.com") return Response.json({ shopping_results: [] });
    if (url.hostname === "real-time-product-search.p.rapidapi.com") return Response.json({ data: { products: [] } });
    if (url.hostname.startsWith("google-search-master")) return Response.json({ shopping: [] });
    assert.equal(url.hostname, "real-time-amazon-data.p.rapidapi.com");
    return Response.json({ data: { products: [
      { product_title: "Apple 2026 MacBook Air 13″ Laptop with M5 chip: AI and Apple Intelligence, 34.46 cm (13.6″) Liquid Retina Display, 24GB Unified Memory, 1TB SSD Storage", product_price: "₹1,94,990", product_url: "https://www.amazon.in/dp/B0GR1N6KHH", product_photo: "https://example.com/macbook.jpg" },
      { product_title: "Apple 2026 MacBook Air 13″ Laptop with M5 chip: AI and Apple Intelligence, 34.46 cm (13.6″) Liquid Retina Display, 16GB Unified Memory, 1TB SSD Storage", product_price: "₹1,67,290", product_url: "https://www.amazon.in/dp/B0GR1K8S8H" },
      { product_title: "Compatible for MacBook Air M5 Replacement LCD Assembly", product_price: "₹4,999", product_url: "https://www.amazon.in/dp/B000000003" },
    ] } });
  });
  const products = new Map();
  t.mock.method(Product, "findOneAndUpdate", async (_, { $set }) => {
    const saved = { _id: $set.sourceProductId, ...$set };
    products.set(saved._id, saved);
    return saved;
  });
  t.mock.method(PriceHistory, "create", async () => {});
  t.mock.method(Recommendation, "create", async (data) => ({
    populate: async () => {},
    toObject: () => ({ ...data, picks: data.picks.map((pick) => ({ ...pick, product: products.get(pick.product) })) }),
  }));
  const result = await generateRecommendation(parseRequirementDeterministically(query), undefined, query);
  assert.equal(result.preferences.budget.max, 200000);
  assert.equal(result.picks.length, 1);
  assert.equal(result.picks[0].product.bestPrice, 194990);
  assert.equal(result.picks[0].product.normalizedSpecs.ramGB, 24);
  assert.equal(result.picks[0].product.sellers[0].platform, "Amazon India");
  assert.equal(result.picks[0].rankingSource, "groq");
  assert.equal(result.picks[0].matchScore, undefined);
  assert.equal(groq.mock.callCount(), 1);
  assert.equal(fetch.mock.callCount(), 5);
});
