import { test } from "node:test";
import assert from "node:assert/strict";
import { matchMacbookModel as match } from "../utils/macbookModel.js";

test("non-MacBook names delegate to the normal model matcher", () => {
  assert.equal(match("Dell XPS 13 Laptop", "Dell XPS 13", "Dell"), null);
});

test("MacBook chip identity survives inserted retail presentation text", () => {
  for (const title of [
    "Apple MacBook Air 13.6-inch Laptop (Apple M3 chip/16GB/512GB SSD)",
    "MacBook Air 13.6 Inch Notebook Apple M3 Chip, 16 GB Unified Memory, 512 GB SSD",
    "2024 Apple MacBook Air 13.6-inch Laptop with Apple M3 Chip",
  ]) assert.equal(match(title, "Apple MacBook Air M3", "Apple"), true, title);
});

test("MacBook family, chip generation and chip modifiers stay mandatory", () => {
  for (const title of [
    "Apple MacBook Air 13.6-inch Laptop M2 16GB 512GB",
    "Apple MacBook Pro 14-inch Laptop M3 16GB 512GB",
    "Apple MacBook Air 13.6-inch Laptop M3 Pro 16GB 512GB",
    "Apple MacBook Air 13.6-inch Laptop M3 Max 16GB 512GB",
    "Apple MacBook Air Laptop Intel Core i7 16GB 512GB",
    "Apple MacBook Air M3 / M4 Laptop 16GB 512GB",
  ]) assert.equal(match(title, "Apple MacBook Air M3", "Apple"), false, title);
  assert.equal(match("MacBook Pro 14-inch Laptop (Apple M3 Pro chip/18GB/512GB SSD)", "Apple MacBook Pro M3 Pro", "Apple"), true);
  assert.equal(match("MacBook Pro M3 Max Laptop", "Apple MacBook Pro M3 Pro", "Apple"), false);
  assert.equal(match("MacBook Air M3 Laptop", "Apple MacBook Air M10", "Apple"), false);
});

test("explicit MacBook screen sizes remain evidence requirements", () => {
  assert.equal(match("Apple MacBook Air 13.6-inch Laptop M3 16GB 512GB", "Apple MacBook Air 13.6 M3", "Apple"), true);
  assert.equal(match("Apple MacBook Air 15-inch Laptop M3 16GB 512GB", "Apple MacBook Air 13.6 M3", "Apple"), false);
  assert.equal(match("Apple MacBook Air M3 16GB 512GB", "Apple MacBook Air 13.6 M3", "Apple"), false);
  assert.equal(match("Apple MacBook Air 13.6-inch M3", "Apple MacBook Air 13 M3", "Apple"), true);
  assert.equal(match("Apple MacBook Air 13.6-inch Laptop with M5 chip", "MacBook Air 13 (M5)", "Apple"), true);
  assert.equal(match("Apple MacBook Air 15.3-inch Laptop with M5 chip", "MacBook Air 13 (M5)", "Apple"), false);
  assert.equal(match("Apple 2026 MacBook Air 13″ Laptop with M5 chip: AI and Apple Intelligence, 34.46 cm (13.6″) Liquid Retina Display, 24GB Unified Memory, 1TB SSD Storage", "MacBook Air 13 (M5)", "Apple"), true);
});

test("unsupported observed MacBook screen formats do not become another configuration", () => {
  assert.equal(match("Apple MacBook Air 17-inch M3 16GB 256GB", "Apple MacBook Air M3", "Apple"), false);
  assert.equal(match("Apple MacBook Air 13.3-inch M3 16GB 256GB", "Apple MacBook Air M3", "Apple"), false);
  assert.equal(match("Apple MacBook Air 13.3-inch M2 16GB 256GB", "Apple MacBook Air M2", "Apple"), false);
  assert.equal(match("Apple MacBook Air 13.3-inch M1 16GB 256GB", "Apple MacBook Air M1", "Apple"), true);
  assert.equal(match("Apple MacBook Air 13.6-inch M3 16GB 256GB", "Apple MacBook Air M3", "Apple"), true);
});

test("requested Apple hardware and part codes stay mandatory instead of being discarded", () => {
  assert.equal(match("Apple MacBook Air M3 Laptop A3113", "Apple MacBook Air M3 A3113", "Apple"), true);
  assert.equal(match("Apple MacBook Air M3 Laptop A3114", "Apple MacBook Air M3 A3113", "Apple"), false);
  assert.equal(match("Apple MacBook Air M3 Laptop", "Apple MacBook Air M3 A3113", "Apple"), false);
  assert.equal(match("Apple MacBook Air M3 Laptop A31130", "Apple MacBook Air M3 A3113", "Apple"), false);
  assert.equal(match("Apple MacBook Air M3 Laptop MRX33HN/A", "Apple MacBook Air M3 MRX33HN/A", "Apple"), true);
  assert.equal(match("Apple MacBook Air M3 Laptop MRX33LL/A", "Apple MacBook Air M3 MRX33HN/A", "Apple"), false);
  assert.equal(match("Apple MacBook Air M3 Laptop ABC123", "Apple MacBook Air M3 SKU: ABC123", "Apple"), true);
  assert.equal(match("Apple MacBook Air M3 Laptop ABC1234", "Apple MacBook Air M3 SKU: ABC123", "Apple"), false);
  assert.equal(match("Apple MacBook Air M3 Laptop", "Apple MacBook Air M3X", "Apple"), false);
});

test("explicit RAM and storage tolerate labels, punctuation and TB aliases", () => {
  const model = "Apple MacBook Air M3 16GB 512GB";
  assert.equal(match("Apple MacBook Air 13.6-inch Laptop (Apple M3 chip/16 GB Unified Memory/512 GB SSD)", model, "Apple"), true);
  assert.equal(match("Apple MacBook Air M3 Laptop 24GB RAM 512GB SSD", model, "Apple"), false);
  assert.equal(match("Apple MacBook Air M3 Laptop 16GB RAM 1TB SSD", model, "Apple"), false);
  assert.equal(match("Apple MacBook Air M3 Laptop 512GB SSD", model, "Apple"), false);
  assert.equal(match("Apple MacBook Air M3 Laptop 16GB RAM 1024GB SSD", "Apple MacBook Air M3 16GB 1TB", "Apple"), true);
  assert.equal(match("Apple MacBook Pro M3 Max Laptop 128GB RAM 4TB SSD", "Apple MacBook Pro M3 Max 128GB 4TB", "Apple"), true);
  assert.equal(match("Apple MacBook Pro M3 Max Laptop 128GB", "Apple MacBook Pro M3 Max 128GB", "Apple"), false);
});

test("a requested release year cannot be inferred from its chip or silently ignored", () => {
  assert.equal(match("Apple MacBook Air 2024 Laptop Apple M3 chip", "Apple MacBook Air M3 (2024)", "Apple"), true);
  assert.equal(match("Apple MacBook Air Laptop Apple M3 chip", "Apple MacBook Air M3 (2024)", "Apple"), false);
  assert.equal(match("Apple MacBook Air 2023 Laptop Apple M3 chip", "Apple MacBook Air M3 (2024)", "Apple"), false);
});

test("MacBook parts and compatibility references never establish the primary device", () => {
  for (const title of [
    "Compatible for Apple MacBook Air M3 LCD Display Assembly",
    "Apple MacBook Air M3 Replacement Keyboard",
    "Case for Apple MacBook Air M3 Laptop",
    "OtherBrand Apple MacBook Air M3 Laptop",
    "Apple MacBook Air M3 Laptop Stand",
  ]) assert.equal(match(title, "Apple MacBook Air M3", "Apple"), false, title);
  assert.equal(match("Apple MacBook Air M3 Laptop with Charger", "Apple MacBook Air M3", "Apple"), true);
});
