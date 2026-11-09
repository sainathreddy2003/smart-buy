import assert from "node:assert/strict";
import { test } from "node:test";
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
