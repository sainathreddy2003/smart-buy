import { test } from "node:test";
import assert from "node:assert/strict";
import { env } from "../config/env.js";
import { searchAmazonOffers } from "../services/providers/AmazonRetailProvider.js";
import { AmazonProductProvider } from "../services/providers/AmazonProductProvider.js";
import { FlipkartProductProvider } from "../services/providers/FlipkartProductProvider.js";
import { isWholeProductListing } from "../utils/productListing.js";
import { searchFlipkartOffers } from "../services/providers/FlipkartRetailProvider.js";

const name = "Apple MacBook Air M3";
const link = "https://www.amazon.in/dp/B000000001";
const goodProduct = {
  product_title: "Apple MacBook Air M3 16GB RAM 512GB SSD",
  product_price: "₹1,19,999", currency: "INR", product_url: link,
  product_photo: "https://images.example.com/laptop.jpg", product_star_rating: "4.6",
  product_condition: "NEW", product_availability: "In stock",
};

function amazonFixture(t, products = [goodProduct]) {
  const original = { key: env.rapidApi.key, flipkart: env.rapidApi.flipkartSearchConfig };
  env.rapidApi.key = "fixture-key";
  t.after(() => {
    env.rapidApi.key = original.key;
    env.rapidApi.flipkartSearchConfig = original.flipkart;
  });
  return t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.hostname, "real-time-amazon-data.p.rapidapi.com");
    assert.equal(url.pathname, "/search");
    assert.equal(url.searchParams.get("query"), name);
    assert.equal(url.searchParams.get("country"), "IN");
    return Response.json({ status: "OK", data: { products } });
  });
}

test("native Amazon model lookup preserves the provider title, photo, rating and ASIN in one call", async (t) => {
  const fetch = amazonFixture(t);
  const [product] = await new AmazonProductProvider().search(name, { category: "laptop", exactModel: true });
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(product.name, goodProduct.product_title);
  assert.equal(product._rawTitle, goodProduct.product_title);
  assert.equal(product.category, "laptop");
  assert.equal(product.image, goodProduct.product_photo);
  assert.equal(product.rating, 4.6);
  assert.equal(product.source, "rapidapi");
  assert.equal(product.sourceProductId, "B000000001");
  assert.equal(product.condition, "NEW");
  assert.equal(product.shoppingHistoryId, undefined, "An ASIN is not a Google Shopping history identifier");
  assert.deepEqual(product.sellers, [{ platform: "Amazon India", price: 119999, currency: "INR", url: link, availability: true }]);
});

test("legacy Amazon offer results retain their existing public shape", async (t) => {
  const fetch = amazonFixture(t);
  assert.deepEqual(await searchAmazonOffers(name), [{
    name: goodProduct.product_title, platform: "Amazon India", price: 119999,
    currency: "INR", url: link, availability: true,
  }]);
  assert.equal(fetch.mock.callCount(), 1);
});

test("native Amazon rejects raw refurbished condition and unavailable rows even without title warnings", async (t) => {
  const fetch = amazonFixture(t, [
    { ...goodProduct, product_condition: "REFURBISHED" },
    { ...goodProduct, product_condition: "USED" },
    { ...goodProduct, product_condition: undefined, condition: "renewed" },
    { ...goodProduct, product_availability: false },
    { ...goodProduct, product_availability: "Currently unavailable" },
    { ...goodProduct, product_availability: "Sold out" },
    { ...goodProduct, in_stock: false },
    goodProduct,
  ]);
  const products = await new AmazonProductProvider().search(name, { category: "laptop" });
  assert.equal(products.length, 1);
  assert.equal(products[0].sellers[0].price, 119999);
  assert.equal(fetch.mock.callCount(), 1);
});

test("native Amazon rejects foreign currency, spoofed stores and malformed product links", async (t) => {
  amazonFixture(t, [
    { ...goodProduct, currency: "USD", product_price: "$999" },
    { ...goodProduct, currency: "USD" },
    { ...goodProduct, product_url: "https://www.amazon.com/dp/B000000001" },
    { ...goodProduct, product_url: "https://www.amazon.in.example.org/dp/B000000001" },
    { ...goodProduct, product_url: "https://www.amazon.in/s?k=laptop" },
    { ...goodProduct, product_url: "https://user:password@www.amazon.in/dp/B000000001" },
    { ...goodProduct, product_url: "https://www.amazon.in:8443/dp/B000000001" },
    { ...goodProduct, product_price: null },
  ]);
  assert.deepEqual(await new AmazonProductProvider().search(name, { category: "laptop" }), []);
});

test("native Amazon keeps the full title for downstream accessory checks even after display truncation", async (t) => {
  const title = `${goodProduct.product_title} ${"compatible accessory description ".repeat(5)}Replacement Keyboard Assembly`;
  amazonFixture(t, [{ ...goodProduct, product_title: title }]);
  const [product] = await new AmazonProductProvider().search(name, { category: "laptop", limit: 1 });
  assert.equal(product.name.length, 120);
  assert.equal(product._rawTitle, title);
  assert.equal(isWholeProductListing(product._rawTitle, product.category), false);
});

test("native Amazon respects result limits without another pricing request", async (t) => {
  const fetch = amazonFixture(t, [goodProduct, { ...goodProduct, product_url: "https://www.amazon.in/dp/B000000002" }]);
  assert.equal((await new AmazonProductProvider().search(name, { category: "laptop", limit: 1 })).length, 1);
  assert.equal(fetch.mock.callCount(), 1);
});

test("native Flipkart makes no request without a configured endpoint", async (t) => {
  const original = env.rapidApi.flipkartSearchConfig;
  env.rapidApi.flipkartSearchConfig = null;
  t.after(() => { env.rapidApi.flipkartSearchConfig = original; });
  const fetch = t.mock.method(globalThis, "fetch", () => assert.fail("No endpoint must mean no call"));
  assert.deepEqual(await new FlipkartProductProvider().search(name, { category: "laptop" }), []);
  assert.equal(fetch.mock.callCount(), 0);
});

test("native Flipkart maps a configured exact-model response into product listings", async (t) => {
  const original = { key: env.rapidApi.key, config: env.rapidApi.flipkartSearchConfig };
  env.rapidApi.key = "fixture-key";
  env.rapidApi.flipkartSearchConfig = JSON.stringify({
    url: "https://flipkart-native-fixture.p.rapidapi.com/search", queryParam: "q", results: "data.items",
    name: "title", price: "price", link: "url", currency: "currency", availability: "available",
    condition: "state", image: "photo", rating: "stars",
  });
  t.after(() => { env.rapidApi.key = original.key; env.rapidApi.flipkartSearchConfig = original.config; });
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.searchParams.get("q"), name);
    const valid = { title: goodProduct.product_title, price: "₹1,14,999", currency: "INR", available: true,
      url: "https://www.flipkart.com/macbook/p/item123?pid=LAPTEST123", state: "NEW", photo: goodProduct.product_photo, stars: "4.4" };
    return Response.json({ data: { items: [
      { ...valid, state: "REFURBISHED" }, { ...valid, available: "Currently unavailable" },
      { ...valid, currency: "USD" }, { ...valid, url: "https://flipkart.com.example.org/p/item123" }, valid,
    ] } });
  });
  const [product] = await new FlipkartProductProvider().search(name, { category: "laptop" });
  assert.equal(product._rawTitle, goodProduct.product_title);
  assert.equal(product.category, "laptop");
  assert.equal(product.sellers[0].platform, "Flipkart");
  assert.equal(product.sourceProductId, "flipkart:pid:LAPTEST123");
  assert.equal(product.condition, "NEW");
  assert.equal(product.image, goodProduct.product_photo);
  assert.equal(product.rating, 4.4);
  assert.equal(product.shoppingHistoryId, undefined);
  assert.equal(fetch.mock.callCount(), 1);
});

test("optional Flipkart metadata stays unknown without mapped fields and legacy offers keep their shape", async (t) => {
  const original = { key: env.rapidApi.key, config: env.rapidApi.flipkartSearchConfig };
  env.rapidApi.key = "fixture-key";
  env.rapidApi.flipkartSearchConfig = JSON.stringify({
    url: "https://flipkart-native-fixture.p.rapidapi.com/search", queryParam: "q",
    name: "title", price: "price", link: "url",
  });
  t.after(() => { env.rapidApi.key = original.key; env.rapidApi.flipkartSearchConfig = original.config; });
  const url = "https://www.flipkart.com/macbook/p/item123?pid=LAPTEST123";
  t.mock.method(globalThis, "fetch", async () => Response.json([
    { title: goodProduct.product_title, price: "₹1,14,999", url },
    { title: goodProduct.product_title, price: "₹1,14,999", url, condition: "USED" },
    { title: goodProduct.product_title, price: "₹1,14,999", url, availability: false },
  ]));
  const products = await new FlipkartProductProvider().search(name, { category: "laptop" });
  assert.equal(products.length, 1);
  assert.equal(products[0].condition, undefined);
  assert.equal(products[0].image, undefined);
  assert.equal(products[0].rating, undefined);
  assert.equal(products[0].sellers[0].availability, undefined);
  assert.deepEqual(await searchFlipkartOffers(name), [{ name: goodProduct.product_title,
    platform: "Flipkart", price: 114999, currency: "INR", url, availability: true }]);
});
