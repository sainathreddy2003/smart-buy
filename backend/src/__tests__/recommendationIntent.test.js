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
env.groq.liveSearch = false;
const { generateRecommendation } = await import("../services/recommendation.service.js");

const offer = (title, price, suffix = "B000000001", platform = "amazon") => ({
  title, price,
  direct_link: platform === "amazon" ? `https://www.amazon.in/dp/${suffix}` : `https://www.flipkart.com/item/p/${suffix}`,
});

function liveSearchFixture(t, listings = [], events) {
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
    events?.push("search");
    assert.equal(url.hostname, "serpapi.com");
    assert.equal(url.searchParams.get("gl"), "in");
    return Response.json({ shopping_results: typeof listings === "function" ? await listings(url) : listings });
  });
}

function mockShortlist(t, products, inspect) {
  return t.mock.method(Groq.Chat.Completions.prototype, "create", async ({ messages }) => {
    inspect?.(JSON.parse(messages.at(-1).content));
    return { choices: [{ message: { content: JSON.stringify({ products }) } }] };
  });
}

function mockPersistence(t) {
  const products = new Map();
  const save = t.mock.method(Product, "findOneAndUpdate", async (_, { $set }) => {
    const product = { _id: $set.name, ...$set };
    products.set(product._id, product);
    return product;
  });
  t.mock.method(PriceHistory, "create", async () => {});
  t.mock.method(Recommendation, "create", async (data) => ({
    populate: async () => {},
    toObject: () => ({ ...data, picks: data.picks.map((pick) => ({ ...pick, product: products.get(pick.product) })) }),
  }));
  return save;
}

const suggestion = (name, cameraFit) => ({ name, brand: name.split(" ")[0], ...(cameraFit && { cameraFit }) });

async function recommend(query, requirement) {
  return generateRecommendation(requirement || parseRequirementDeterministically(query), undefined, query);
}

test("general phone requests shortlist before searching and ignore AI-inferred camera intent", async (t) => {
  const events = [];
  const fetch = liveSearchFixture(t, [offer("Example One 256GB", "₹45,000"), offer("Example Two 128GB", "₹40,000", "128", "flipkart")], events);
  mockPersistence(t);
  const groq = mockShortlist(t, [suggestion("Example Two"), suggestion("Example One")], (request) => {
    events.push("shortlist");
    assert.equal(request.cameraFocused, false);
    assert.equal(request.availableProducts, undefined);
    assert.deepEqual(request.budget, { min: 0, max: 50000, currency: "INR" });
  });
  const query = "best phone under 50000";
  const requirement = { ...parseRequirementDeterministically(query), useCases: ["photography", "everyday"], keywords: ["camera", "phone"] };
  const result = await recommend(query, requirement);

  assert.deepEqual(events, ["shortlist", "search", "search"]);
  assert.equal(groq.mock.callCount(), 1);
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal(fetch.mock.calls[0].arguments[0].searchParams.get("q"), "Example Two");
  assert.equal(fetch.mock.calls[1].arguments[0].searchParams.get("q"), "Example One");
  assert.deepEqual(result.picks.map(({ product }) => product.bestPrice), [40000, 45000]);
  assert.ok(result.picks.every(({ rankingSource, matchScore }) => rankingSource === "groq" && matchScore == null));
});

test("a one-lakh camera request sends the parsed needs to Groq before any live prices exist", async (t) => {
  const events = [];
  const fetch = liveSearchFixture(t, [offer("Example Camera Pro 256GB", "₹74,999")], events);
  mockPersistence(t);
  mockShortlist(t, [suggestion("Example Camera Pro", "strong")], (request) => {
    events.push("shortlist");
    assert.equal(request.cameraFocused, true);
    assert.equal(request.budget.max, 100000);
    assert.equal(request.preferredMinPrice, 65000);
    assert.equal(request.originalQuery, "best phone with great camera under 1 lakh");
    assert.equal(request.availableProducts, undefined);
    assert.ok(request.requirements);
  });
  const result = await recommend("best phone with great camera under 1 lakh");
  assert.deepEqual(events, ["shortlist", "search"]);
  assert.equal(result.preferences.budget.max, 100000);
  assert.deepEqual(result.picks.map(({ product }) => product.bestPrice), [74999]);
  assert.equal(fetch.mock.callCount(), 1);
});

test("verified results keep Groq's model order and show only one configuration per model", async (t) => {
  const fetch = liveSearchFixture(t, [
    offer("Example Second 8GB RAM 256GB", "₹90,000"),
    offer("Example First 8GB RAM 128GB", "₹70,000", "B000000002"),
    offer("Example First 12GB RAM 256GB", "₹75,000", "B000000003"),
  ]);
  mockPersistence(t);
  mockShortlist(t, [suggestion("Example First"), suggestion("Example Second")]);
  const result = await recommend("phone under 1 lakh with 12GB RAM");
  assert.equal(result.picks.length, 2);
  assert.match(result.picks[0].product.name, /^Example First/);
  assert.match(result.picks[1].product.name, /^Example Second/);
  assert.deepEqual(result.picks.map(({ rank }) => rank), [1, 2]);
  assert.equal(fetch.mock.callCount(), 2);
});

test("live model verification rejects unrelated, upgraded, renewed, foreign, and over-budget offers", async (t) => {
  const fetch = liveSearchFixture(t, [
    offer("Example One 256GB", "₹74,999"),
    offer("Example One Pro 256GB", "₹79,999", "B000000002"),
    offer("Example One Ultra 256GB", "₹89,999", "B000000003"),
    offer("Example One 256GB Renewed", "₹65,999", "B000000004"),
    offer("Example One 512GB", "₹1,00,001", "B000000005"),
    offer("Unrelated Great Camera 256GB", "₹80,000", "B000000006"),
    { title: "Example One 256GB", price: "$899", currency: "USD", direct_link: "https://www.amazon.com/dp/B000000007" },
    { title: "Example One 256GB", price: "₹69,999", direct_link: "https://random-shop.example/product" },
  ]);
  mockPersistence(t);
  mockShortlist(t, [suggestion("Example One", "strong")]);
  const result = await recommend("best camera phone under 1 lakh");
  assert.deepEqual(result.picks.map(({ product }) => product.name), ["Example One 256GB"]);
  assert.deepEqual(result.picks[0].product.sellers.map(({ price }) => price), [74999]);
  assert.equal(fetch.mock.callCount(), 1);
});

test("one model search supplies both retailer prices without separate quote requests", async (t) => {
  const fetch = liveSearchFixture(t, [
    offer("Example One 256GB", "₹74,999"),
    offer("Example One 256GB", "₹72,999", "example-one", "flipkart"),
  ]);
  mockPersistence(t);
  mockShortlist(t, [suggestion("Example One")]);
  const result = await recommend("phone under 1 lakh");
  assert.equal(result.picks.length, 1);
  assert.equal(result.picks[0].product.bestPrice, 72999);
  assert.deepEqual(result.picks[0].product.sellers.map(({ platform, price }) => [platform, price]), [["Flipkart", 72999], ["Amazon India", 74999]]);
  assert.equal(fetch.mock.callCount(), 1);
});

test("unavailable suggested models are omitted without fabricating a price or substituting a generic listing", async (t) => {
  const fetch = liveSearchFixture(t, [offer("Example Available 256GB", "₹74,999"), offer("Example Unrelated 256GB", "₹70,000", "B000000002")]);
  const save = mockPersistence(t);
  mockShortlist(t, [suggestion("Example Missing"), suggestion("Example Available"), suggestion("Example Also Missing")]);
  const result = await recommend("phone under 1 lakh");
  assert.deepEqual(result.picks.map(({ product }) => product.name), ["Example Available 256GB"]);
  assert.equal(save.mock.callCount(), 1);
  assert.equal(fetch.mock.callCount(), 3);
  assert.match(result.summary, /WiseBuy suggested this product/);
  assert.match(result.summary, /verified for 1 of 3 suggested models/);
  assert.match(result.summary, /other models had no matching verified offer/);
  assert.doesNotMatch(result.summary, /Groq|Research identified/);
});

test("no verified shortlisted offers returns not found without saving unrelated products", async (t) => {
  const fetch = liveSearchFixture(t, [offer("Example Unrelated 256GB", "₹74,999")]);
  const save = mockPersistence(t);
  mockShortlist(t, [suggestion("Example Missing")]);
  await assert.rejects(recommend("phone under 1 lakh"), { statusCode: 404 });
  assert.equal(save.mock.callCount(), 0);
  assert.equal(fetch.mock.callCount(), 1);
});

test("a failed Groq shortlist returns an actionable service error before spending a shopping request", async (t) => {
  const fetch = liveSearchFixture(t);
  const save = mockPersistence(t);
  t.mock.method(Groq.Chat.Completions.prototype, "create", async () => { throw new Error("test provider unavailable"); });
  await assert.rejects(recommend("phone under 1 lakh"), { statusCode: 503 });
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(save.mock.callCount(), 0);
});

test("an empty Groq shortlist stops before shopping instead of searching arbitrary products", async (t) => {
  const fetch = liveSearchFixture(t);
  mockPersistence(t);
  mockShortlist(t, []);
  await assert.rejects(recommend("phone under 1 lakh"), { statusCode: 404 });
  assert.equal(fetch.mock.callCount(), 0);
});

test("model lookups run concurrently and retain Groq order when later results finish first", async (t) => {
  const pending = [];
  const fetch = liveSearchFixture(t, (url) => new Promise((resolve) => pending.push({ query: url.searchParams.get("q"), resolve })));
  mockPersistence(t);
  mockShortlist(t, [suggestion("Example First"), suggestion("Example Second")]);
  const recommendation = recommend("phone under 1 lakh");
  // Allow asynchronous Groq validation to complete, without real network waits.
  for (let i = 0; i < 12 && pending.length < 2; i += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 2, "Both requests should start before either shopping response completes");
  assert.match(pending[0].query, /Example First/);
  assert.match(pending[1].query, /Example Second/);
  pending[1].resolve([offer("Example Second 256GB", "₹74,999")]);
  pending[0].resolve([offer("Example First 256GB", "₹79,999", "B000000002")]);
  const result = await recommendation;
  assert.deepEqual(result.picks.map(({ product }) => product.name), ["Example First 256GB", "Example Second 256GB"]);
  assert.equal(fetch.mock.callCount(), 2);
});

test("partial shopping failures retain another model's verified offer", async (t) => {
  const fetch = liveSearchFixture(t, (url) => {
    if (/Example Missing/.test(url.searchParams.get("q"))) throw new Error("test shopping provider unavailable");
    return [offer("Example Available 256GB", "₹74,999")];
  });
  mockPersistence(t);
  mockShortlist(t, [suggestion("Example Missing"), suggestion("Example Available")]);
  const result = await recommend("phone under 1 lakh");
  assert.deepEqual(result.picks.map(({ product }) => product.name), ["Example Available 256GB"]);
  assert.equal(fetch.mock.callCount(), 2);
  assert.match(result.summary, /verified for 1 of 2 suggested models/);
  assert.match(result.summary, /temporarily unavailable for 1 model/);
  assert.doesNotMatch(result.summary, /no matching verified offer/);
});

test("all failed shopping requests report service unavailability rather than no matching products", async (t) => {
  const fetch = liveSearchFixture(t, () => { throw new Error("test shopping provider unavailable"); });
  const save = mockPersistence(t);
  mockShortlist(t, [suggestion("Example One"), suggestion("Example Two")]);
  await assert.rejects(recommend("phone under 1 lakh"), { statusCode: 503 });
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal(save.mock.callCount(), 0);
});

test("a ₹90,000 phone request keeps cheaper verified models alongside a preferred-tier model", async (t) => {
  const fetch = liveSearchFixture(t, [offer("Infinix Note 60 Pro 256 GB", "₹37,999"), offer("OnePlus 13s 256GB", "₹64,999", "B000000002")]);
  mockPersistence(t);
  mockShortlist(t, [suggestion("Infinix Note 60 Pro"), suggestion("OnePlus 13s")]);
  const result = await recommend("I’m looking for a phone. My budget is 90000");
  assert.deepEqual(result.picks.map(({ product }) => product.bestPrice), [37999, 64999]);
  assert.equal(fetch.mock.callCount(), 2);
});

for (const [query, names, cameraFit] of [
  ["phone under 2 lakhs", ["Example First", "Example Second", "Example Third"]],
  ["best camera phone under 2 lakhs", ["Example First", "Example Second", "Example Third"], "strong"],
  ["laptop for video editing under 2 lakhs", ["Example First Laptop", "Example Second Laptop", "Example Third Laptop"]],
]) {
  test(`all three verified shortlisted models remain visible for ${query}`, async (t) => {
    const fetch = liveSearchFixture(t, [
      offer(`${names[0]} 16GB RAM 256GB storage`, "₹1,69,999", "B000000001"),
      offer(`${names[1]} 16GB RAM 256GB storage`, "₹1,19,999", "B000000002"),
      offer(`${names[2]} 16GB RAM 256GB storage`, "₹99,999", "B000000003"),
      offer(`${names[2]} 16GB RAM 512GB storage`, "₹2,00,001", "B000000004"),
    ]);
    const save = mockPersistence(t);
    mockShortlist(t, names.map((name) => suggestion(name, cameraFit)));
    const result = await recommend(query);
    assert.deepEqual(result.picks.map(({ product }) => product.bestPrice), [169999, 119999, 99999]);
    assert.deepEqual(result.picks.map(({ rank }) => rank), [1, 2, 3]);
    assert.equal(result.shortlistedModels.length, 3);
    assert.match(result.summary, /WiseBuy suggested these 3 products/);
    assert.doesNotMatch(result.summary, /Groq|temporarily unavailable|no matching|target is 3/);
    assert.ok(result.picks.every(({ reasoning }) => reasoning.startsWith("Suggested by WiseBuy")));
    assert.equal(fetch.mock.callCount(), 3, "Each model uses its search response for prices without extra quote calls");
    assert.equal(save.mock.callCount(), 3);
  });
}

test("a genuinely shorter research shortlist explains the three-product target", async (t) => {
  const fetch = liveSearchFixture(t, [offer("Example One 256GB", "₹74,999")]);
  mockPersistence(t);
  mockShortlist(t, [suggestion("Example One")]);
  const result = await recommend("phone under 1 lakh");
  assert.equal(result.picks.length, 1);
  assert.match(result.summary, /Research identified 1 suitable model for this request; the target is 3/);
  assert.equal(fetch.mock.callCount(), 1);
});

for (const query of ["cheapest camera phone under 1 lakh", "camera phone between 30000 and 100000"]) {
  test(`explicit price intent remains available for ${query}`, async (t) => {
    const fetch = liveSearchFixture(t, [offer("Example Affordable 128GB", "₹38,990"), offer("Example Premium 256GB", "₹74,999", "B000000002")]);
    mockPersistence(t);
    mockShortlist(t, [suggestion("Example Affordable", "strong"), suggestion("Example Premium", "strong")], (request) => assert.equal(request.preferredMinPrice, undefined));
    const result = await recommend(query);
    assert.deepEqual(result.picks.map(({ product }) => product.bestPrice), [38990, 74999]);
    assert.doesNotMatch(result.summary, /lower-priced/);
    assert.equal(fetch.mock.callCount(), 2);
  });
}

test("a cheaper verified camera alternative is labelled and explicit minimums are enforced", async (t) => {
  const fetch = liveSearchFixture(t, [offer("Samsung Galaxy A56 5G 256GB", "₹38,990")]);
  mockPersistence(t);
  mockShortlist(t, [suggestion("Samsung Galaxy A56 5G", "strong")]);
  const result = await recommend("best phone with great camera under 1 lakh");
  assert.deepEqual(result.picks.map(({ product }) => product.bestPrice), [38990]);
  assert.match(result.summary, /₹65,000 and ₹1,00,000.*lower-priced camera alternatives/);
  assert.equal(fetch.mock.callCount(), 1);
  await assert.rejects(recommend("camera phone between 40000 and 100000"), { statusCode: 404 });
});

test("phone storage is not counted as RAM and labelled memory stays separate", async (t) => {
  const fetch = liveSearchFixture(t, [
    offer("Infinix Note 60 Pro 256 GB", "₹37,999"),
    offer("OnePlus 13s 12GB RAM 256GB storage", "₹64,999", "B000000002"),
    offer("Example Phone 128 GB (8 GB RAM)", "₹40,000", "128", "flipkart"),
  ]);
  mockPersistence(t);
  mockShortlist(t, [suggestion("Infinix Note 60 Pro"), suggestion("OnePlus 13s"), suggestion("Example Phone")]);
  const result = await recommend("phone between 30000 and 90000");
  const specs = Object.fromEntries(result.picks.map(({ product }) => [product.name, product.normalizedSpecs]));
  assert.deepEqual(specs["Infinix Note 60 Pro 256 GB"], { ramGB: undefined, storageGB: 256 });
  assert.deepEqual(specs["OnePlus 13s 12GB RAM 256GB storage"], { ramGB: 12, storageGB: 256 });
  assert.deepEqual(specs["Example Phone 128 GB (8 GB RAM)"], { ramGB: 8, storageGB: 128 });
  assert.equal(fetch.mock.callCount(), 3);
});

test("phone ambiguous capacities and RAM-only listings retain unknown storage", async (t) => {
  const fetch = liveSearchFixture(t, [offer("Example One 8GB + 256GB", "₹40,000"), offer("Example Two 8GB RAM", "₹41,000", "B000000002")]);
  mockPersistence(t);
  mockShortlist(t, [suggestion("Example One"), suggestion("Example Two")]);
  const result = await recommend("phone under 50000");
  assert.deepEqual(result.picks.map(({ product }) => product.normalizedSpecs), [{ ramGB: undefined, storageGB: undefined }, { ramGB: 8, storageGB: undefined }]);
  assert.equal(fetch.mock.callCount(), 2);
});

test("laptops also shortlist before shopping and preserve verified budget bounds", async (t) => {
  const events = [];
  const fetch = liveSearchFixture(t, [offer("Example Creator 16GB RAM 1TB SSD", "₹1,59,999"), offer("Example Creator 32GB RAM 2TB SSD", "₹2,00,001", "B000000002")], events);
  mockPersistence(t);
  mockShortlist(t, [suggestion("Example Creator")], (request) => {
    events.push("shortlist");
    assert.equal(request.category, "laptop");
    assert.equal(request.budget.max, 200000);
    assert.equal(request.cameraFocused, false);
  });
  const result = await recommend("laptop for video editing under 2 lakhs");
  assert.deepEqual(events, ["shortlist", "search"]);
  assert.deepEqual(result.picks.map(({ product }) => product.bestPrice), [159999]);
  assert.equal(result.picks[0].rankingSource, "groq");
  assert.equal(fetch.mock.callCount(), 1);
});

test("the guided photography choice uses the same pre-search shortlist", async (t) => {
  const fetch = liveSearchFixture(t, [offer("Example Camera 256GB", "₹45,000")]);
  mockPersistence(t);
  const groq = mockShortlist(t, [suggestion("Example Camera", "strong")], (request) => assert.equal(request.cameraFocused, true));
  const result = await generateRecommendation({ category: "smartphone", budgetMax: 50000, useCase: "photography" });
  assert.equal(groq.mock.callCount(), 1);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(result.picks[0].rankingSource, "groq");
});

test("repeated identical shortlists reuse cached shopping results", async (t) => {
  const fetch = liveSearchFixture(t, [offer("Example One 256GB", "₹74,999")]);
  mockPersistence(t);
  mockShortlist(t, [suggestion("Example One")]);
  await recommend("phone under 1 lakh");
  await recommend("phone under 1 lakh");
  assert.equal(fetch.mock.callCount(), 1);
});

test("a SerpApi-only deployment can search while mock mode and missing keys remain disabled", async (t) => {
  const fetch = liveSearchFixture(t, [offer("Example One 256GB", "₹45,000"), offer("Example Two 128GB", "₹40,000", "128", "flipkart"), offer("Example Over Budget 256GB", "₹65,000", "B000000002")]);
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
