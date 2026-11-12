import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeRecommendation } from "../models/Recommendation.js";

function pick(name, price = 4999, fields = {}) {
  return { rank: 1, product: { name, category: "smartphone", ...fields, sellers: [{
    platform: "Amazon India", price, currency: "INR", availability: true,
    url: "https://www.amazon.in/dp/B000000001",
  }] } };
}

test("saved accessory recommendations no longer present parts or cases as phones", () => {
  const result = serializeRecommendation({ toObject: () => ({
    preferences: { category: "smartphone", budget: { max: 100000 } },
    picks: [
      pick("Compatible for Apple iPhone 15 Plus LCD Display Touch Screen Digitizer Frame Assembly"),
      pick("iPhone 14 Plus Cover Case Scratch Resistant", 379),
    ],
    summary: "Old lower-priced alternatives",
  }) });
  assert.deepEqual(result.picks, []);
  assert.match(result.summary, /Start a new search/);
});

test("saved validation uses the full provider title rather than a shortened display name", () => {
  const result = serializeRecommendation({ toObject: () => ({
    preferences: { category: "smartphone", budget: { max: 100000 } },
    picks: [
      pick("Apple iPhone 15 Plus", 4999, { listingTitle: "Compatible for Apple iPhone 15 Plus LCD Display Assembly" }),
      pick("Apple iPhone 15 Plus 128GB Blue", 54999),
    ],
  }) });
  assert.deepEqual(result.picks.map(({ product }) => product.name), ["Apple iPhone 15 Plus 128GB Blue"]);
});

test("saved summaries and pick explanations use SmartBuy branding without changing shopper data", () => {
  const originalQuery = "Groq suggested a phone; compare it under 1 lakh";
  const result = serializeRecommendation({ toObject: () => ({
    originalQuery,
    preferences: { category: "smartphone", budget: { max: 100000 } },
    picks: [{ ...pick("Apple iPhone 15 Plus 128GB", 54999), reasoning: "Shortlisted by Groq for your stated needs • Fits your budget" }],
    summary: "Groq shortlisted these products. Prices are from live shopping listings.",
  }) });
  assert.equal(result.summary, "SmartBuy suggested these products. Prices are from live shopping listings.");
  assert.equal(result.picks[0].reasoning, "Suggested by SmartBuy for your stated needs • Fits your budget");
  assert.equal(result.originalQuery, originalQuery);
});
