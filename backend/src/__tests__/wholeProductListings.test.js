import { test } from "node:test";
import assert from "node:assert/strict";
import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { Product } from "../models/Product.js";
import { PriceHistory } from "../models/PriceHistory.js";
import { Recommendation } from "../models/Recommendation.js";
import { clear } from "../services/cache.service.js";
import { searchSuggestedProduct } from "../services/productSearch.service.js";
import { parseRequirementDeterministically } from "../utils/deterministicParser.js";

env.groq.apiKey ??= "test";
env.groq.liveSearch = false;
const { generateRecommendation } = await import("../services/recommendation.service.js");

const iphone15 = { name: "Apple iPhone 15 Plus", brand: "Apple" };
const iphone14 = { name: "Apple iPhone 14 Plus", brand: "Apple" };
const options = { category: "smartphone", budget: { max: 100000 }, retailers: ["Amazon India", "Flipkart"], limit: 40 };

function listing(title, price = "₹4,999", id = "B000000001", retailer = "amazon") {
  return { title, price, direct_link: retailer === "amazon"
    ? `https://www.amazon.in/dp/${id}` : `https://www.flipkart.com/phone/p/${id}` };
}

function fixture(t, listings) {
  const original = { mock: env.useMockData, serp: env.serpApi.key, rapid: env.rapidApi.key };
  env.useMockData = false;
  env.serpApi.key = "test";
  env.rapidApi.key = null;
  clear();
  t.after(() => {
    env.useMockData = original.mock;
    env.serpApi.key = original.serp;
    env.rapidApi.key = original.rapid;
    clear();
  });
  return t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.hostname, "serpapi.com", "Only SerpApi is configured in this validation fixture");
    return Response.json({ shopping_results: listings });
  });
}

const accessories = [
  [iphone15, "Compatible for Apple iPhone 15 Plus LCD Display Touch Screen Digitizer Assembly", "₹4,999"],
  [iphone14, "iPhone 14 Plus Cover Case Scratch Resistant", "₹379"],
  [iphone15, "Apple iPhone 15 Plus OLED Display Assembly", "₹24,999"],
  [iphone15, "Apple iPhone 15 Plus Touch Screen Digitizer Replacement", "₹14,999"],
  [iphone15, "Apple iPhone 15 Plus LCD Screen Only", "₹9,999"],
  [iphone15, "Apple iPhone 15 Plus Clear Silicone Case Shockproof", "₹699"],
  [iphone15, "Apple iPhone 15 Plus USB-C Fast Charging Cable", "₹1,499"],
  [iphone15, "Apple iPhone 15 Plus Camera Lens Protector", "₹599"],
  [iphone15, "Apple iPhone 15 Plus Magnetic Car Mount Holder", "₹1,999"],
  [iphone15, "Apple iPhone 15 Plus Back Panel Battery Cover", "₹2,999"],
  [iphone15, "Apple iPhone 15 Plus Full Body Skin Wrap", "₹999"],
];

for (const [model, title, price] of accessories) {
  test(`a model-name match cannot turn this accessory into a phone: ${title}`, async (t) => {
    const fetch = fixture(t, [listing(title, price)]);
    assert.deepEqual(await searchSuggestedProduct(model, options), []);
    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(fetch.mock.calls[0].arguments[0].searchParams.get("q"), model.name);
  });
}

test("phone-priced accessories are still excluded without imposing a minimum phone price", async (t) => {
  const fetch = fixture(t, [
    listing("Apple iPhone 15 Plus OLED Display Assembly", "₹74,999"),
    listing("Apple iPhone 15 Plus (128 GB) - Black", "₹49,999", "B000000002"),
  ]);
  const products = await searchSuggestedProduct(iphone15, options);
  assert.deepEqual(products.map(({ name }) => name), ["Apple iPhone 15 Plus (128 GB) - Black"]);
  assert.equal(fetch.mock.callCount(), 1);
});

test("mixed search results retain only complete phones and both valid retailer offers", async (t) => {
  const validTitle = "Apple iPhone 15 Plus (128 GB) - Black, Super Retina XDR Display";
  const fetch = fixture(t, [
    listing(accessories[0][1]),
    listing("Apple iPhone 15 Plus Cover Case Scratch Resistant", "₹379", "B000000002"),
    listing(validTitle, "₹74,999", "B000000003"),
    listing(validTitle, "₹72,999", "iphone15plus", "flipkart"),
  ]);
  const products = await searchSuggestedProduct(iphone15, options);
  assert.equal(products.length, 2);
  assert.ok(products.every(({ name }) => name === validTitle));
  assert.deepEqual(products.map(({ sellers }) => [sellers[0].platform, sellers[0].price]), [["Amazon India", 74999], ["Flipkart", 72999]]);
  assert.equal(fetch.mock.callCount(), 1);
});

for (const [category, model, title, price] of [
  ["laptop", { name: "ASUS TUF A15", brand: "ASUS" }, "ASUS TUF A15 RTX 4050 16GB RAM 512GB SSD Gaming Laptop with Charger", "₹79,999"],
  ["headphones", { name: "Sony WF-1000XM5", brand: "Sony" }, "Sony WF-1000XM5 Wireless Earbuds with Charging Case", "₹24,999"],
  ["headphones", { name: "Sony WH-1000XM5", brand: "Sony" }, "Sony WH-1000XM5 Wireless Noise Cancelling Headphones with Carrying Case", "₹29,999"],
]) {
  test(`whole ${category} bundles remain valid: ${title}`, async (t) => {
    fixture(t, [listing(title, price)]);
    const products = await searchSuggestedProduct(model, { ...options, category });
    assert.deepEqual(products.map(({ name }) => name), [title]);
  });
}

for (const [category, model, title] of [
  ["laptop", { name: "ASUS TUF A15", brand: "ASUS" }, "ASUS TUF A15 Replacement Keyboard Backlit Assembly"],
  ["headphones", { name: "Sony WH-1000XM5", brand: "Sony" }, "Sony WH-1000XM5 Replacement Ear Pads Cushions"],
  ["headphones", { name: "Sony WF-1000XM5", brand: "Sony" }, "Sony WF-1000XM5 Replacement Charging Case Only"],
]) {
  test(`parts cannot inherit the requested ${category} category: ${title}`, async (t) => {
    fixture(t, [listing(title)]);
    assert.deepEqual(await searchSuggestedProduct(model, { ...options, category }), []);
  });
}

test("the reported iPhone search cannot save or recommend its accessory-only responses", async (t) => {
  const fetch = fixture(t, accessories.slice(0, 2).map(([, title, price], index) => listing(title, price, `B00000000${index + 1}`)));
  t.mock.method(Groq.Chat.Completions.prototype, "create", async () => ({
    choices: [{ message: { content: JSON.stringify({ products: [iphone15, iphone14] }) } }],
  }));
  const save = t.mock.method(Product, "findOneAndUpdate", () => assert.fail("Accessories must not be persisted as recommended phones"));
  t.mock.method(PriceHistory, "create", () => assert.fail("Accessories must not populate phone price history"));
  t.mock.method(Recommendation, "create", () => assert.fail("An accessory-only recommendation must not be saved"));
  const query = "best iphone under 1 lakh";
  await assert.rejects(generateRecommendation(parseRequirementDeterministically(query), undefined, query), { statusCode: 404 });
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal(save.mock.callCount(), 0);
});
