import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeRequirementSchema } from "../validators/ai.validators.js";
import { createRecommendationSchema } from "../validators/recommendation.validators.js";

for (const [name, schema, body] of [
  ["requirement analysis", analyzeRequirementSchema, {}],
  ["product recommendation", createRecommendationSchema, { category: "smartphone" }],
]) {
  test(`${name} accepts the full shopping prompt beyond the old 500-character boundary`, () => {
    const query = "I need a camera phone with dependable software and battery life. ".repeat(12)
      + "The maximum budget is 1 lakh, and I need 256GB storage.";
    assert.ok(query.length > 500);
    const result = schema.safeParse({ body: { ...body, query } });
    assert.equal(result.success, true);
    assert.equal(result.data.body.query, query);
  });

  test(`${name} accepts 4,000 characters and rejects 4,001 without truncation`, () => {
    const query = "x".repeat(4000);
    const accepted = schema.safeParse({ body: { ...body, query } });
    assert.equal(accepted.success, true);
    assert.equal(accepted.data.body.query, query);
    const rejected = schema.safeParse({ body: { ...body, query: `${query}x` } });
    assert.equal(rejected.success, false);
  });
}
