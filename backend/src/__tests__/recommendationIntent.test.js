import { test } from "node:test";
import assert from "node:assert/strict";
import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { Product } from "../models/Product.js";
import { PriceHistory } from "../models/PriceHistory.js";
import { Recommendation } from "../models/Recommendation.js";
import { clear } from "../services/cache.service.js";
import { isLiveModeActive, searchProducts } from "../services/productSearch.service.js";
import { parseRequirementDeterministically } from "../utils/deterministicParser.js";

env.groq.apiKey ??= "test";
const { generateRecommendation } = await import("../services/recommendation.service.js");

function liveSearchFixture(t, listings) {
  const original = { useMockData: env.useMockData, serpApiKey: env.serpApi.key, rapidApiKey: env.rapidApi.key };
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = null;
  clear();
  t.after(() => {
    env.useMockData = original.useMockData;
    env.serpApi.key = original.serpApiKey;
    env.rapidApi.key = original.rapidApiKey;
    clear();
  });

  return t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.hostname, "serpapi.com");
    return Response.json({ shopping_results: listings ?? [
      { title: "Example Phone 256GB", price: "₹45,000", direct_link: "https://www.amazon.in/dp/B000000001" },
      { title: "Example Other Phone 128GB", price: "₹40,000", direct_link: "https://www.flipkart.com/item/p/128" },
      { title: "Example Expensive Phone 256GB", price: "₹65,000", direct_link: "https://www.amazon.in/dp/B000000002" },
    ] });
  });
}

function mockPersistence(t) {
  const products = new Map();
  t.mock.method(Product, "findOneAndUpdate", async (_, { $set }) => {
    const product = { _id: $set.name, ...$set };
    products.set(product._id, product);
    return product;
  });
  t.mock.method(PriceHistory, "create", async () => {});
  t.mock.method(Recommendation, "create", async (data) => ({
    populate: async () => {},
    toObject: () => ({ ...data, picks: data.picks.map((pick) => ({
      ...pick, product: products.get(pick.product),
    })) }),
  }));
}

test("general phone requests ignore camera intent inferred by AI and return live offers", async (t) => {
  const fetch = liveSearchFixture(t);
  mockPersistence(t);
  const groq = t.mock.method(Groq.Chat.Completions.prototype, "create", async () => {
    throw new Error("A general phone request must not require camera shortlisting");
  });
  const query = "best phone under 50000";
  const requirement = {
    ...parseRequirementDeterministically(query),
    useCases: ["photography", "everyday"],
    keywords: ["camera", "phone"],
  };

  const result = await generateRecommendation(requirement, undefined, query);

  assert.equal(groq.mock.callCount(), 0);
  assert.equal(fetch.mock.callCount(), 1);
  assert.doesNotMatch(fetch.mock.calls[0].arguments[0].searchParams.get("q"), /camera|photography/i);
  assert.equal(result.picks.length, 2);
  assert.ok(result.picks.every(({ product, rankingSource }) => product.bestPrice <= 50000 && !rankingSource));
  assert.doesNotMatch(result.summary, /camera|Groq/);
});

test("phone storage is not counted as RAM and labelled memory is kept separate", async (t) => {
  const fetch = liveSearchFixture(t, [
    { title: "Infinix Note 60 Pro 256 GB", price: "₹37,999", direct_link: "https://www.amazon.in/dp/B000000001" },
    { title: "OnePlus 13s 12GB RAM 256GB storage", price: "₹64,999", direct_link: "https://www.amazon.in/dp/B000000002" },
    { title: "Example Phone 128 GB (8 GB RAM)", price: "₹40,000", direct_link: "https://www.flipkart.com/item/p/128" },
  ]);
  mockPersistence(t);
  const query = "phone between 30000 and 90000";
  const result = await generateRecommendation(parseRequirementDeterministically(query), undefined, query);
  const specs = Object.fromEntries(result.picks.map(({ product }) => [product.name, product.normalizedSpecs]));

  assert.deepEqual(specs["Infinix Note 60 Pro 256 GB"], { ramGB: undefined, storageGB: 256 });
  assert.deepEqual(specs["OnePlus 13s 12GB RAM 256GB storage"], { ramGB: 12, storageGB: 256 });
  assert.deepEqual(specs["Example Phone 128 GB (8 GB RAM)"], { ramGB: 8, storageGB: 128 });
  assert.equal(fetch.mock.callCount(), 1);
});

test("a ₹90,000 phone request prefers an available offer in its price tier", async (t) => {
  const fetch = liveSearchFixture(t, [
    { title: "Infinix Note 60 Pro 256 GB", price: "₹37,999", direct_link: "https://www.amazon.in/dp/B000000001" },
    { title: "OnePlus 13s", price: "₹64,999", direct_link: "https://www.amazon.in/dp/B000000002" },
    { title: "Example Over Budget Phone", price: "₹90,001", direct_link: "https://www.flipkart.com/item/p/over" },
  ]);
  mockPersistence(t);
  const query = "I’m looking for a phone. My budget is 90000";
  const result = await generateRecommendation(parseRequirementDeterministically(query), undefined, query);

  assert.deepEqual(result.picks.map(({ product }) => product.bestPrice), [64999]);
  assert.equal(fetch.mock.callCount(), 1);
});

test("phone listings with ambiguous capacities or RAM alone keep unknown storage", async (t) => {
  const fetch = liveSearchFixture(t, [
    { title: "Example Phone 8GB + 256GB", price: "₹40,000", direct_link: "https://www.amazon.in/dp/B000000001" },
    { title: "Example Other Phone 8GB RAM", price: "₹41,000", direct_link: "https://www.amazon.in/dp/B000000002" },
  ]);
  mockPersistence(t);
  const query = "phone under 50000";
  const result = await generateRecommendation(parseRequirementDeterministically(query), undefined, query);
  const specs = Object.fromEntries(result.picks.map(({ product }) => [product.name, product.normalizedSpecs]));

  assert.deepEqual(specs["Example Phone 8GB + 256GB"], { ramGB: undefined, storageGB: undefined });
  assert.deepEqual(specs["Example Other Phone 8GB RAM"], { ramGB: 8, storageGB: undefined });
  assert.equal(fetch.mock.callCount(), 1);
});

for (const query of ["phone between 30000 and 90000", "cheapest phone under 90000"]) {
  test(`phone price-tier preference preserves explicit intent for ${query}`, async (t) => {
    const fetch = liveSearchFixture(t, [
      { title: "Example Affordable Phone 256 GB", price: "₹37,999", direct_link: "https://www.amazon.in/dp/B000000001" },
      { title: "Example Premium Phone 256 GB", price: "₹64,999", direct_link: "https://www.amazon.in/dp/B000000002" },
      { title: "Example Over Budget Phone", price: "₹90,001", direct_link: "https://www.flipkart.com/item/p/over" },
    ]);
    mockPersistence(t);
    const result = await generateRecommendation(parseRequirementDeterministically(query), undefined, query);

    assert.deepEqual(result.picks.map(({ product }) => product.bestPrice).sort((a, b) => a - b), [37999, 64999]);
    assert.doesNotMatch(result.summary, /lower-priced alternatives/);
    assert.equal(fetch.mock.callCount(), 1);
  });
}

test("a phone search explains cheaper fallback offers and keeps explicit price bounds", async (t) => {
  const fetch = liveSearchFixture(t, [
    { title: "Example Phone 256 GB", price: "₹37,999", direct_link: "https://www.amazon.in/dp/B000000001" },
    { title: "Example Other Phone 128 GB", price: "₹40,000", direct_link: "https://www.flipkart.com/item/p/128" },
    { title: "Example Over Budget Phone", price: "₹90,001", direct_link: "https://www.flipkart.com/item/p/over" },
  ]);
  mockPersistence(t);
  const query = "phone under 90000";
  const result = await generateRecommendation(parseRequirementDeterministically(query), undefined, query);

  assert.equal(result.picks.length, 2);
  assert.match(result.summary, /₹58,500 and ₹90,000.*lower-priced alternatives/);
  assert.equal(fetch.mock.callCount(), 1);

  clear();
  const rangeQuery = "phone between 39000 and 90000";
  const ranged = await generateRecommendation(parseRequirementDeterministically(rangeQuery), undefined, rangeQuery);
  assert.deepEqual(ranged.picks.map(({ product }) => product.bestPrice), [40000]);
  assert.equal(fetch.mock.callCount(), 2);
});

test("an explicit camera request still uses the camera shortlist when AI omits that use case", async (t) => {
  liveSearchFixture(t);
  mockPersistence(t);
  const groq = t.mock.method(Groq.Chat.Completions.prototype, "create", async ({ messages }) => {
    assert.equal(JSON.parse(messages.at(-1).content).cameraFocused, true);
    return { choices: [{ message: { content: JSON.stringify({ products: [
      { name: "Example Phone 256GB", cameraFit: "strong" },
    ] }) } }] };
  });
  const query = "best camera phone under 50000";
  const requirement = { ...parseRequirementDeterministically(query), useCases: [], keywords: ["phone"] };

  const result = await generateRecommendation(requirement, undefined, query);

  assert.equal(groq.mock.callCount(), 1);
  assert.equal(result.picks.length, 1);
  assert.equal(result.picks[0].rankingSource, "groq");
});

test("a ₹1 lakh camera search shortlists available phones in its preferred tier before cheaper models", async (t) => {
  const premiumName = "Example Camera Pro 256GB";
  const fetch = liveSearchFixture(t, [
    { title: "Samsung Galaxy A56 5G 256GB", price: "₹38,990", direct_link: "https://www.amazon.in/dp/B000000001" },
    { title: premiumName, price: "₹74,999", direct_link: "https://www.amazon.in/dp/B000000002" },
    { title: "Example Over Budget Camera Phone", price: "₹1,00,001", direct_link: "https://www.flipkart.com/item/p/over" },
  ]);
  mockPersistence(t);
  const groq = t.mock.method(Groq.Chat.Completions.prototype, "create", async ({ messages }) => {
    const request = JSON.parse(messages.at(-1).content);
    assert.equal(request.preferredMinPrice, 65000);
    assert.deepEqual(request.availableProducts, [
      { name: premiumName, brand: "Example", price: 74999, currency: "INR" },
    ]);
    return { choices: [{ message: { content: JSON.stringify({ products: [
      { name: premiumName, cameraFit: "strong" },
    ] }) } }] };
  });
  const query = "best phone with great camera under 1 lakh";
  const result = await generateRecommendation(parseRequirementDeterministically(query), undefined, query);

  assert.equal(result.preferences.budget.max, 100000);
  assert.deepEqual(result.picks.map(({ product }) => product.bestPrice), [74999]);
  assert.doesNotMatch(result.summary, /lower-priced/);
  assert.match(fetch.mock.calls[0].arguments[0].searchParams.get("q"), /65000.*100000/);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(groq.mock.callCount(), 1);
});

test("a ₹1 lakh camera search identifies its only ₹38,990 result as a cheaper alternative", async (t) => {
  const name = "Samsung Galaxy A56 5G 256GB";
  const fetch = liveSearchFixture(t, [
    { title: name, price: "₹38,990", direct_link: "https://www.amazon.in/dp/B000000001" },
  ]);
  mockPersistence(t);
  t.mock.method(Groq.Chat.Completions.prototype, "create", async ({ messages }) => {
    const request = JSON.parse(messages.at(-1).content);
    assert.deepEqual(request.availableProducts, [
      { name, brand: "Samsung", price: 38990, currency: "INR" },
    ]);
    return { choices: [{ message: { content: JSON.stringify({ products: [
      { name, cameraFit: "strong" },
    ] }) } }] };
  });
  const query = "best phone with great camera under 1 lakh";
  const result = await generateRecommendation(parseRequirementDeterministically(query), undefined, query);

  assert.equal(result.preferences.budget.max, 100000);
  assert.deepEqual(result.picks.map(({ product }) => product.bestPrice), [38990]);
  assert.match(result.summary, /₹65,000 and ₹1,00,000.*lower-priced camera alternatives/);
  assert.doesNotMatch(result.summary, /^Groq shortlisted/);
  assert.equal(fetch.mock.callCount(), 1);
});

for (const query of ["cheapest camera phone under 1 lakh", "camera phone between 30000 and 100000"]) {
  test(`camera price-tier preference preserves explicit intent for ${query}`, async (t) => {
    const cheapName = "Example Camera Phone 128GB";
    const premiumName = "Example Camera Pro 256GB";
    const fetch = liveSearchFixture(t, [
      { title: cheapName, price: "₹38,990", direct_link: "https://www.amazon.in/dp/B000000001" },
      { title: premiumName, price: "₹74,999", direct_link: "https://www.amazon.in/dp/B000000002" },
    ]);
    mockPersistence(t);
    t.mock.method(Groq.Chat.Completions.prototype, "create", async ({ messages }) => {
      const request = JSON.parse(messages.at(-1).content);
      assert.equal(request.preferredMinPrice, undefined);
      assert.deepEqual(request.availableProducts.map(({ price }) => price), [38990, 74999]);
      return { choices: [{ message: { content: JSON.stringify({ products: [
        { name: cheapName, cameraFit: "strong" },
        { name: premiumName, cameraFit: "strong" },
      ] }) } }] };
    });
    const result = await generateRecommendation(parseRequirementDeterministically(query), undefined, query);

    assert.deepEqual(result.picks.map(({ product }) => product.bestPrice), [38990, 74999]);
    assert.doesNotMatch(result.summary, /lower-priced/);
    assert.equal(fetch.mock.callCount(), 1);
  });
}

test("the guided photography choice still uses the camera shortlist without a free-text query", async (t) => {
  liveSearchFixture(t);
  mockPersistence(t);
  const groq = t.mock.method(Groq.Chat.Completions.prototype, "create", async () => ({
    choices: [{ message: { content: '{"products":[{"name":"Example Phone 256GB","cameraFit":"strong"}]}' } }],
  }));

  const result = await generateRecommendation({ category: "smartphone", budgetMax: 50000, useCase: "photography" });

  assert.equal(groq.mock.callCount(), 1);
  assert.equal(result.picks[0].rankingSource, "groq");
});

test("a SerpApi-only deployment can search while mock mode and missing keys remain disabled", async (t) => {
  const fetch = liveSearchFixture(t);
  assert.equal(isLiveModeActive(), true);
  const results = await searchProducts("phone under 50000", { category: "smartphone", budget: { max: 50000 } });
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(results.length, 2);

  env.useMockData = true;
  assert.equal(isLiveModeActive(), false);
  env.useMockData = false;
  env.serpApi.key = null;
  assert.equal(isLiveModeActive(), false);
});
