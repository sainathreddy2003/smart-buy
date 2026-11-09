import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseRAM, parseStorage, tierFromGPU, tierFromCPU, parseBatteryHours, parsePrice } from "../utils/normalization.js";

describe("normalization", () => {
  test("parseRAM handles multiple formats", () => {
    assert.equal(parseRAM("16GB"), 16);
    assert.equal(parseRAM("16 GB RAM"), 16);
    assert.equal(parseRAM("RAM: 16 GB"), 16);
    assert.equal(parseRAM("16-gigabyte"), 16);
  });

  test("parseStorage handles GB and TB, including decimal TB", () => {
    assert.equal(parseStorage("512GB SSD"), 512);
    assert.equal(parseStorage("0.5TB"), 512);
    assert.equal(parseStorage("512 GB storage"), 512);
    assert.equal(parseStorage("1TB"), 1024);
  });

  test("tierFromGPU recognizes integrated graphics as tier 0", () => {
    assert.equal(tierFromGPU("AMD Radeon Graphics (integrated)"), 0);
    assert.equal(tierFromGPU(""), 0);
  });

  test("tierFromGPU ranks a discrete GPU above 0", () => {
    assert.ok(tierFromGPU("NVIDIA RTX 4050 6GB") > 0);
  });

  test("tierFromGPU still credits a confirmed-but-unmodeled dedicated GPU, not just a named RTX/GTX", () => {
    assert.ok(tierFromGPU("Dedicated GPU (model unlisted)") > 0);
  });

  test("tierFromCPU ranks a flagship chip above an entry-level one", () => {
    assert.ok(tierFromCPU("Intel Core Ultra 9 185H") > tierFromCPU("Intel Celeron N4020"));
  });

  test("tierFromCPU does not conflate a cost-down 'Xs' chip variant with its full-tier namesake", () => {
    // Snapdragon 7s Gen 2 is a materially lower tier than Snapdragon 7 Gen 3 —
    // a bare "snapdragon 7" substring match would incorrectly conflate them.
    assert.ok(tierFromCPU("Snapdragon 7 Gen 3") > tierFromCPU("Snapdragon 7s Gen 2"));
  });

  test("parseBatteryHours scores Apple silicon's mAh more favorably than an Android chip at the same capacity", () => {
    const appleHours = parseBatteryHours("3349mAh, 20W wired", "smartphone", "Apple A16 Bionic");
    const androidHours = parseBatteryHours("3349mAh, 20W wired", "smartphone", "Snapdragon 7 Gen 3");
    assert.ok(appleHours > androidHours);
  });

  test("parsePrice handles comma-separated INR and preserves decimals", () => {
    assert.equal(parsePrice("₹11,999"), 11999);
    assert.equal(parsePrice("₹1,299.50"), 1299.5);
  });

  test("parsePrice rejects a nonsensically low price rather than showing it as real", () => {
    // A live provider occasionally returns a malformed/misaligned price field
    // (e.g. "₹8" for a monitor) — this should be dropped, not surfaced as fact.
    assert.equal(parsePrice("₹8"), null);
    assert.equal(parsePrice("₹299"), null);
    assert.equal(parsePrice("₹300"), 300);
  });
});
