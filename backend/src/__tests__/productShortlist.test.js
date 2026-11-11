import { test } from "node:test";
import assert from "node:assert/strict";
import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { parseRequirementDeterministically } from "../utils/deterministicParser.js";

env.groq.apiKey ??= "test";
const { suggestProductNames } = await import("../services/ai.service.js");

function groqReply(products) {
  return { choices: [{ message: { content: JSON.stringify({ products }) } }] };
}

for (const category of ["smartphone", "laptop", "headphones", "smartwatch", "tablet", "monitor"]) {
  test(`shortlists ${category} models from the shopper's requirements before search`, async (t) => {
    const originalQuery = `${category} under 1 lakh`;
    const requirement = { ...parseRequirementDeterministically(originalQuery), category };
    const create = t.mock.method(Groq.Chat.Completions.prototype, "create", async ({ messages }) => {
      assert.match(messages[0].content, /BEFORE live shopping search/);
      const input = JSON.parse(messages[1].content);
      assert.equal(input.category, category);
      assert.equal(input.originalQuery, originalQuery);
      assert.equal(input.budget.max, 100000);
      assert.equal(input.preferredMinPrice, 65000);
      assert.deepEqual(input.requirements, requirement.requirements);
      assert.equal("availableProducts" in input, false);
      return groqReply([{ name: "Example Model 5", brand: "Example", cameraFit: "strong" }]);
    });

    assert.deepEqual(await suggestProductNames(requirement, {
      originalQuery, preferredMinPrice: 65000, cameraFocused: false,
    }), [{ name: "Example Model 5", brand: "Example" }]);
    assert.equal(create.mock.callCount(), 1);
  });
}

test("model shortlist preserves camera suitability, removes duplicate names, and caps searches at three models", async (t) => {
  t.mock.method(Groq.Chat.Completions.prototype, "create", async () => groqReply([
    { name: "Example Model 5", brand: "Example", cameraFit: "strong", price: 79999 },
    { name: "EXAMPLE Model-5", brand: "Example", cameraFit: "strong" },
    { name: "Example Model 6", brand: "Example", cameraFit: "value" },
    { name: "Example Model 7", brand: "Example", cameraFit: "uncertain" },
    { name: "Example Model 8", brand: "Example", cameraFit: "strong" },
  ]));
  const result = await suggestProductNames(parseRequirementDeterministically("camera phone under 1 lakh"), { cameraFocused: true });

  assert.deepEqual(result, [
    { name: "Example Model 5", brand: "Example", cameraFit: "strong" },
    { name: "Example Model 6", brand: "Example", cameraFit: "value" },
    { name: "Example Model 7", brand: "Example", cameraFit: "uncertain" },
  ]);
  assert.ok(result.every((product) => !("price" in product)));
});

test("branded and unbranded aliases consume only one shortlist slot", async (t) => {
  t.mock.method(Groq.Chat.Completions.prototype, "create", async () => groqReply([
    { name: "Samsung Galaxy A56 5G", brand: "Samsung", cameraFit: "strong" },
    { name: "Galaxy A56 5G", brand: "SAMSUNG", cameraFit: "strong" },
    { name: "Samsung Galaxy S25", brand: "Samsung", cameraFit: "strong" },
    { name: "Google Pixel 9", brand: "Google", cameraFit: "strong" },
  ]));

  const result = await suggestProductNames(parseRequirementDeterministically("camera phone under 1 lakh"), { cameraFocused: true });
  assert.deepEqual(result.map(({ name }) => name), ["Samsung Galaxy A56 5G", "Samsung Galaxy S25", "Google Pixel 9"]);
});

test("Plus model aliases are deduplicated without dropping the base model", async (t) => {
  t.mock.method(Groq.Chat.Completions.prototype, "create", async () => groqReply([
    { name: "Samsung Galaxy S25", brand: "Samsung" },
    { name: "Samsung Galaxy S25+", brand: "Samsung" },
    { name: "Samsung Galaxy S25 Plus", brand: "Samsung" },
    { name: "Samsung Galaxy S25Plus", brand: "Samsung" },
  ]));

  const result = await suggestProductNames(parseRequirementDeterministically("phone under 1 lakh"));
  assert.deepEqual(result.map(({ name }) => name), ["Samsung Galaxy S25", "Samsung Galaxy S25+"]);
});

for (const product of [
  { name: "camera phone", brand: "Example" },
  { name: "best phone under 100000", brand: "Example" },
  { name: "https://example.com/product", brand: "Example" },
  { name: "Example Model 5", brand: " " },
  { name: "Example Model 5" },
  { name: "Samsung", brand: "SAMSUNG" },
  { name: "Samsung!!", brand: "Samsung" },
]) {
  test(`rejects unusable model suggestion ${JSON.stringify(product)}`, async (t) => {
    t.mock.method(Groq.Chat.Completions.prototype, "create", async () => groqReply([product]));
    assert.equal(await suggestProductNames(parseRequirementDeterministically("phone under 1 lakh")), null);
  });
}

test("a valid empty shortlist stays distinct from a failed Groq request", async (t) => {
  const create = t.mock.method(Groq.Chat.Completions.prototype, "create", async () => groqReply([]));
  const requirement = parseRequirementDeterministically("phone under 1 lakh");
  assert.deepEqual(await suggestProductNames(requirement), []);

  create.mock.mockImplementation(async () => { throw new Error("Unavailable"); });
  assert.equal(await suggestProductNames(requirement), null);
});
