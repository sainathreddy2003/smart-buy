import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isSameProduct, mergeSellerOffers } from "../utils/duplicateDetection.js";

describe("duplicate detection", () => {
  test("recognizes the same model with different marketing-noise titles as one product", () => {
    const a = { brand: "ASUS", name: "ASUS TUF Gaming A15 FA507NV" };
    const b = { brand: "ASUS", name: "ASUS TUF A15 FA507NV Gaming Laptop" };
    assert.equal(isSameProduct(a, b), true);
  });

  test("does not merge different brands even with similar titles", () => {
    const a = { brand: "ASUS", name: "TUF Gaming A15" };
    const b = { brand: "Acer", name: "TUF Gaming A15" };
    assert.equal(isSameProduct(a, b), false);
  });

  test("does not merge genuinely different products from the same brand", () => {
    const a = { brand: "Apple", name: "MacBook Air 15 M3" };
    const b = { brand: "Apple", name: "MacBook Pro 16 M3 Max" };
    assert.equal(isSameProduct(a, b), false);
  });

  test("does not merge different phone models that share only brand and generic marketing words", () => {
    // A stale/cheap seed catalog entry ("Galaxy A55") must never get merged
    // into an AI-suggested live search for an unrelated, pricier phone
    // ("Galaxy S24 Ultra") just because both say "Samsung Galaxy ... 5G".
    const seedEntry = { brand: "Samsung", name: "Samsung Galaxy A55 5G" };
    const liveResult = { brand: "Samsung", name: "Samsung Galaxy S24 Ultra 5G 12GB 256GB" };
    assert.equal(isSameProduct(seedEntry, liveResult), false);
  });

  test("mergeSellerOffers adds a new platform and recomputes bestPrice", () => {
    const product = { sellers: [{ platform: "Amazon", price: 80000 }] };
    mergeSellerOffers(product, { platform: "Flipkart", price: 78000 });
    assert.equal(product.sellers.length, 2);
    assert.equal(product.bestPrice, 78000);
  });

  test("mergeSellerOffers replaces an existing platform's offer rather than duplicating it", () => {
    const product = { sellers: [{ platform: "Amazon", price: 80000 }] };
    mergeSellerOffers(product, { platform: "Amazon", price: 76000 });
    assert.equal(product.sellers.length, 1);
    assert.equal(product.sellers[0].price, 76000);
  });
});
