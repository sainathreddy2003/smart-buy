import assert from "node:assert/strict";
import { test } from "node:test";
import { env } from "../config/env.js";
import { PriceHistory } from "../models/PriceHistory.js";
import { getPriceHistory } from "../services/price.service.js";

const amazon = { platform: "Amazon India", price: 76000, currency: "INR", url: "https://www.amazon.in/dp/B000EXAMPL" };
const flipkart = { platform: "Flipkart", price: 79000, currency: "INR", url: "https://www.flipkart.com/model/p/item?pid=LAPEXAMPLE01" };

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

  const history = await getPriceHistory({ _id: "product-id" });
  assert.deepEqual(history.entries.map((entry) => entry.price), [80000, 75000]);
  assert.equal(history.low, 75000);
  assert.equal(history.high, 80000);
  assert.equal(history.current, 75000);
  assert.equal(history.changePercent, -6.2);
  assert.equal(history.limited, false);

  rows.splice(1, 1);
  const single = await getPriceHistory({ _id: "product-id" });
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
  const product = { _id: "product-id", source: "rapidapi", shoppingHistoryId: productId, sellers: [amazon, flipkart] };
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
        store_name: "Flipkart", offer_page_url: flipkart.url, product_condition: "NEW",
        price_history: [{ date: "2026-11-06", price: "₹79,000" }],
      },
      {
        store_name: "Flipkart", offer_page_url: flipkart.url, product_condition: "REFURBISHED",
        price_history: [{ date: "2026-11-06", price: "₹35,000" }],
      },
      {
        store_name: "Amazon.in", offer_page_url: "https://www.amazon.com/dp/B000EXAMPL", product_condition: "NEW",
        price_history: [{ date: "2026-11-06", price: "₹36,000" }],
      },
    ] } });
  });

  const [first, second] = await Promise.all([getPriceHistory(product), getPriceHistory(product)]);
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
  recorded.unshift({ price: 80000, platform: "Flipkart", timestamp: new Date("2026-11-08T12:00:00Z"), source: "live" });
  const refreshed = await getPriceHistory(product);
  assert.deepEqual(refreshed.entries, [first.entries[0], ...recorded]);
  assert.equal(request.mock.callCount(), 1);
});

for (const { name, seller, matchingUrl, otherVariantUrl } of [
  {
    name: "Motorola G57 Power 5G",
    seller: amazon,
    matchingUrl: "https://www.amazon.in/Motorola/gp/product/B000EXAMPL?tag=test",
    otherVariantUrl: "https://www.amazon.in/dp/B000OTHER1",
  },
  {
    name: "Lenovo LOQ 13th Gen",
    seller: flipkart,
    matchingUrl: "https://www.flipkart.com/lenovo-loq/p/item?pid=LAPEXAMPLE01&otracker=search",
    otherVariantUrl: "https://www.flipkart.com/lenovo-loq/p/item?pid=LAPEXAMPLE02",
  },
]) {
  test(`SerpApi product gets exact retailer price history for ${name}`, async (t) => {
    const originalKey = env.rapidApi.key;
    env.rapidApi.key = "fixture-key";
    t.after(() => { env.rapidApi.key = originalKey; });
    const now = new Date("2026-11-09T12:00:00Z");
    t.mock.method(Date, "now", () => now.getTime());
    const row = { price: seller.price, platform: seller.platform, timestamp: now, source: "live" };
    t.mock.method(PriceHistory, "find", () => ({ sort: () => ({ lean: async () => [row] }) }));
    const product = { _id: "product-id", name, source: "serpapi", sellers: [seller] };
    const id = `catalogid:12345,productid:${seller.platform}`;
    const request = t.mock.method(globalThis, "fetch", async (url) => {
      assert.equal(url.searchParams.get("country"), "in");
      if (url.pathname === "/search") {
        assert.equal(url.searchParams.get("q"), name);
        return Response.json({ status: "OK", data: { products: [
          { product_title: name + " other configuration", product_id: "different-id", price: "₹70,000", product_page_url: otherVariantUrl },
          { product_title: name, product_id: id, price: "₹79,000", product_page_url: "https://www.google.com/shopping/product/12345" },
        ] } });
      }
      assert.equal(url.pathname, "/product-price-history-v2");
      assert.equal(url.searchParams.get("product_id"), id);
      return Response.json({ status: "OK", data: { offers: [
        { offer_page_url: otherVariantUrl, product_condition: "NEW", price_history: [{ date: "2026-11-06", price: "₹55,000" }] },
        { offer_page_url: matchingUrl, product_condition: "NEW", price_history: [{ date: "2026-11-07", price: "₹80,000" }] },
      ] } });
    });

    const [history, concurrent] = await Promise.all([getPriceHistory(product), getPriceHistory(product)]);
    assert.deepEqual(history, concurrent);
    assert.deepEqual(history.entries, [{ price: 80000, platform: seller.platform, timestamp: "2026-11-07", source: "rapidapi" }, row]);
    assert.equal(history.limited, false);
    assert.equal(request.mock.callCount(), 2);
  });
}

for (const { name, sourceProductId, sellerUrl, historyId } of [
  {
    name: "Motorola G57 Power 5G",
    sourceProductId: "8519674370174597651",
    sellerUrl: amazon.url,
    historyId: "catalogid:8519674370174597651",
  },
  {
    name: "Alienware 16 Aurora Gaming Laptop",
    sourceProductId: "9751760064127452755",
    sellerUrl: "https://www.google.com/search?ibp=oshop&prds=productid:9751760064127452755,headlineOfferDocid:9751760064127452755",
    historyId: "productid:9751760064127452755,headlineOfferDocid:9751760064127452755",
  },
]) {
  test(`SerpApi identifier retrieves price history for ${name} without a second search`, async (t) => {
    const originalKey = env.rapidApi.key;
    env.rapidApi.key = "fixture-key";
    t.after(() => { env.rapidApi.key = originalKey; });
    t.mock.method(Date, "now", () => Date.parse("2026-11-09T12:00:00Z"));
    t.mock.method(PriceHistory, "find", () => ({ sort: () => ({ lean: async () => [] }) }));
    const request = t.mock.method(globalThis, "fetch", async (url) => {
      assert.equal(url.pathname, "/product-price-history-v2");
      assert.equal(url.searchParams.get("product_id"), historyId);
      assert.equal(url.searchParams.get("country"), "in");
      return Response.json({ status: "OK", data: { offers: [
        { offer_id: "unmatched", offer_page_url: "https://www.amazon.in/dp/B000OTHER1", product_condition: "NEW", price_history: [{ date: "2026-11-08", price: "₹55,000" }] },
        { offer_id: sourceProductId, offer_page_url: amazon.url, product_condition: "NEW", price_history: [{ date: "2026-11-08", price: "₹80,000" }] },
      ] } });
    });

    const history = await getPriceHistory({ _id: "product-id", name, source: "serpapi", sourceProductId, sellers: [{ ...amazon, url: sellerUrl }] });
    assert.deepEqual(history.entries.map(({ price }) => price), [80000]);
    assert.equal(request.mock.callCount(), 1);
  });
}

test("price history remains available when RapidAPI fails", async (t) => {
  const originalKey = env.rapidApi.key;
  env.rapidApi.key = "fixture-key";
  t.after(() => { env.rapidApi.key = originalKey; });
  const now = new Date("2026-11-09T12:00:00Z");
  t.mock.method(Date, "now", () => now.getTime());
  const row = { price: 76000, platform: "Amazon India", timestamp: now, source: "live" };
  t.mock.method(PriceHistory, "find", () => ({ sort: () => ({ lean: async () => [row] }) }));
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 503 }));

  const history = await getPriceHistory({
    _id: "product-id", source: "rapidapi", shoppingHistoryId: "catalogid:12345,productid:unavailable", sellers: [amazon],
  });
  assert.deepEqual(history.entries, [row]);
  assert.equal(history.limited, true);
});
