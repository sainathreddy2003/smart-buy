import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesShoppingModel } from "../services/productSearch.service.js";

test("plus symbols identify a distinct phone model", () => {
  assert.equal(matchesShoppingModel("Samsung Galaxy S25+ 256GB", "Samsung Galaxy S25", "Samsung"), false);
  assert.equal(matchesShoppingModel("Samsung Galaxy S25 Plus 256GB", "Samsung Galaxy S25", "Samsung"), false);
  assert.equal(matchesShoppingModel("Samsung Galaxy S25+ 256GB", "Samsung Galaxy S25 Plus", "Samsung"), true);
  assert.equal(matchesShoppingModel("Samsung Galaxy S25 Plus 256GB", "Samsung Galaxy S25+", "Samsung"), true);
  assert.equal(matchesShoppingModel("Samsung Galaxy S25 256GB", "Samsung Galaxy S25+", "Samsung"), false);
  assert.equal(matchesShoppingModel("Samsung Galaxy S25Plus 256GB", "Samsung Galaxy S25", "Samsung"), false);
  assert.equal(matchesShoppingModel("Samsung Galaxy S25+ 256GB", "Samsung Galaxy S25Plus", "Samsung"), true);
  assert.equal(matchesShoppingModel("Samsung Galaxy S25Plus 256GB", "Samsung Galaxy S25+", "Samsung"), true);
});

test("fold and flip suffixes cannot substitute for a base model", () => {
  assert.equal(matchesShoppingModel("Google Pixel 9 Pro Fold 256GB", "Google Pixel 9 Pro", "Google"), false);
  assert.equal(matchesShoppingModel("Example Phone Flip 256GB", "Example Phone", "Example"), false);
  assert.equal(matchesShoppingModel("Google Pixel 9 Pro Fold 256GB", "Google Pixel 9 Pro Fold", "Google"), true);
});

test("MacBook model searches allow a retailer to insert a supported screen size before the chip", () => {
  for (const size of ["13", "13.6", "14", "15", "16"]) {
    for (const unit of ["", "-inch", " inch", " in", '"', "″"]) {
      const title = `Apple MacBook Air ${size}${unit} M3 16GB 256GB`;
      assert.equal(matchesShoppingModel(title, "Apple MacBook Air M3", "Apple"), true, title);
    }
  }
  assert.equal(matchesShoppingModel("MacBook Pro 14-inch M3 Pro 18GB 512GB", "Apple MacBook Pro M3 Pro", "Apple"), true);
});

test("a requested MacBook screen size remains mandatory", () => {
  assert.equal(matchesShoppingModel("MacBook Air 13-inch M3 16GB", "Apple MacBook Air 13 M3", "Apple"), true);
  assert.equal(matchesShoppingModel("MacBook Air 13.6-inch M3 16GB", "Apple MacBook Air 13.6 M3", "Apple"), true);
  assert.equal(matchesShoppingModel("MacBook Air 15-inch M3 16GB", "Apple MacBook Air 13 M3", "Apple"), false);
  assert.equal(matchesShoppingModel("MacBook Air 13.6-inch M3 16GB", "Apple MacBook Air 13 M3", "Apple"), false);
  assert.equal(matchesShoppingModel("MacBook Air M3 16GB", "Apple MacBook Air 13 M3", "Apple"), false);
});

test("MacBook size tolerance preserves family, chip, suffix and requested capacity", () => {
  const model = "Apple MacBook Air M3";
  for (const title of [
    "Apple MacBook Air 13-inch M2 16GB 256GB",
    "Apple MacBook Pro 13-inch M3 16GB 256GB",
    "Apple MacBook Air 13-inch M3 Pro 16GB 256GB",
    "Apple MacBook Air 17-inch M3 16GB 256GB",
    "Apple MacBook Air 13.3-inch M3 16GB 256GB",
  ]) assert.equal(matchesShoppingModel(title, model, "Apple"), false, title);

  assert.equal(matchesShoppingModel("Apple MacBook Air 13-inch M3 16GB 512GB", "Apple MacBook Air M3 16GB 256GB", "Apple"), false);
  assert.equal(matchesShoppingModel("Apple MacBook Air 13-inch M3 16GB 256GB", "Apple MacBook Air M3 16GB 256GB", "Apple"), true);
  assert.equal(matchesShoppingModel("Example Laptop 14-inch M3 16GB", "Example Laptop M3", "Example"), false);
});
