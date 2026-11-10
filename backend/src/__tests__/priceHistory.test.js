import assert from "node:assert/strict";
import { test } from "node:test";
import { env } from "../config/env.js";
import { PriceHistory } from "../models/PriceHistory.js";
import { getPriceHistory } from "../services/price.service.js";

test("price history reads only the last 30 days and compares the latest two observations", async (t) => {
  const now = new Date("2026-11-09T12:00:00Z");
  t.mock.method(Date, "now", () => now.getTime());
  const rows = [
    { price: 70000, platform: "Croma", timestamp: new Date("2026-10-09T12:00:00Z") },
    { price: 80000, platform: "Amazon.in", timestamp: new Date("2026-10-10T12:00:00Z") },
    { price: 60000, platform: "Ovantica.com", timestamp: new Date("2026-11-01T12:00:00Z") },
    { price: 75000, platform: "Flipkart", timestamp: now },
  ];
  t.mock.method(PriceHistory, "find", ({ product, timestamp }) => {
    assert.equal(product, "product-id");
    assert.deepEqual(timestamp, { $gte: new Date("2026-10-10T12:00:00Z"), $lte: now });
    return {
      sort: () => ({ lean: async () => rows.filter((row) => row.timestamp >= timestamp.$gte && row.timestamp <= timestamp.$lte) }),
    };
  });

  const history = await getPriceHistory("product-id");
  assert.deepEqual(history.entries.map((entry) => entry.price), [80000, 75000]);
  assert.equal(history.low, 75000);
  assert.equal(history.high, 80000);
  assert.equal(history.current, 75000);
  assert.equal(history.changePercent, -6.2);
  assert.equal(history.limited, false);

  rows.splice(1, 1);
  const single = await getPriceHistory("product-id");
  assert.equal(single.entries.length, 1);
  assert.equal(single.changePercent, null);
  assert.equal(single.limited, true);
});

test("RapidAPI fills missing days with verified INR prices and leaves local observations intact", async (t) => {
  const originalKey = env.rapidApi.key;
  env.rapidApi.key = "fixture-key";
  t.after(() => { env.rapidApi.key = originalKey; });
  const now = new Date("2026-11-09T22:00:00Z");
  const earlierSameDay = new Date("2026-11-09T19:00:00Z");
  t.mock.method(Date, "now", () => now.getTime());
  const recorded = [
    { price: 76500, platform: "Amazon India", timestamp: earlierSameDay, source: "live" },
    { price: 76000, platform: "Amazon India", timestamp: now, source: "live" },
  ];
  t.mock.method(PriceHistory, "find", () => ({ sort: () => ({ lean: async () => recorded }) }));

  const productId = "catalogid:12345,productid:67890";
  const request = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.origin, "https://real-time-product-search.p.rapidapi.com");
    assert.equal(url.pathname, "/product-price-history-v2");
    assert.equal(url.searchParams.get("product_id"), productId);
    assert.equal(url.searchParams.get("country"), "in");
    assert.equal(url.searchParams.get("page"), "1");
    return Response.json({ status: "OK", data: { offers: [
      {
        store_name: "Amazon.in", offer_page_url: "https://www.amazon.in/dp/B000EXAMPL", product_condition: "NEW",
        price_history: [
          { date: "2026-10-01", price: "₹50,000" },
          { date: "2026-10-32", price: "₹50,000" },
          { date: "2026-11-06", price: "₹82,000" },
          { date: "2026-11-07", price: "$500.00" },
          { date: "2026-11-08", price: 500 },
          { date: "2026-11-10", price: "₹70,000" },
          { date: "2026-11-11", price: "₹40,000" },
        ],
      },
      {
        store_name: "Flipkart", offer_page_url: "https://www.flipkart.com/model/p/item", product_condition: "NEW",
        price_history: [{ date: "2026-11-06", price: "₹79,000" }],
      },
      {
        store_name: "Flipkart", offer_page_url: "https://www.flipkart.com/model/p/used", product_condition: "REFURBISHED",
        price_history: [{ date: "2026-11-06", price: "₹35,000" }],
      },
      {
        store_name: "Amazon.in", offer_page_url: "https://www.amazon.com/dp/B000EXAMPL", product_condition: "NEW",
        price_history: [{ date: "2026-11-06", price: "₹36,000" }],
      },
    ] } });
  });

  const [first, second] = await Promise.all([getPriceHistory("product-id", productId), getPriceHistory("product-id", productId)]);
  assert.deepEqual(first, second);
  assert.deepEqual(first.entries, [
    { platform: "Flipkart", price: 79000, timestamp: "2026-11-06", source: "rapidapi" },
    { platform: "Amazon India", price: 76500, timestamp: earlierSameDay, source: "live" },
    { platform: "Amazon India", price: 76000, timestamp: now, source: "live" },
  ]);
  assert.equal(first.low, 76000);
  assert.equal(first.high, 79000);
  assert.equal(first.current, 76000);
  assert.equal(first.changePercent, -0.7);
  assert.equal(first.limited, false);
  await getPriceHistory("product-id", productId);
  recorded.unshift({ price: 80000, platform: "Flipkart", timestamp: new Date("2026-11-08T12:00:00Z"), source: "live" });
  const localOnly = await getPriceHistory("product-id", "catalogid:12345,productid:local-history");
  assert.deepEqual(localOnly.entries, recorded);
  assert.equal(request.mock.callCount(), 1);
});

test("price history remains available when RapidAPI fails", async (t) => {
  const originalKey = env.rapidApi.key;
  env.rapidApi.key = "fixture-key";
  t.after(() => { env.rapidApi.key = originalKey; });
  const now = new Date("2026-11-09T12:00:00Z");
  t.mock.method(Date, "now", () => now.getTime());
  const row = { price: 76000, platform: "Amazon India", timestamp: now, source: "live" };
  t.mock.method(PriceHistory, "find", () => ({ sort: () => ({ lean: async () => [row] }) }));
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 503 }));

  const history = await getPriceHistory("product-id", "catalogid:12345,productid:unavailable");
  assert.deepEqual(history.entries, [row]);
  assert.equal(history.limited, true);
});
