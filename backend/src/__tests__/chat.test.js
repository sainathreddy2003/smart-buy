import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import Groq from "groq-sdk";

// Every provider and database operation below is mocked; never use real credentials.
process.env.GROQ_API_KEY = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/smartbuy-test";
process.env.JWT_ACCESS_SECRET = "test-access";
process.env.JWT_REFRESH_SECRET = "test-refresh";

const { chatWithAssistant } = await import("../controllers/chat.controller.js");
const { completeChat } = await import("../services/ai.service.js");
const { Product } = await import("../models/Product.js");
const { Recommendation } = await import("../models/Recommendation.js");
const { chatMessageSchema } = await import("../validators/recommendation.validators.js");

const productId = "6af2c4d3f4d7a2d354812b3a";
const recommendationId = "6af2c4d3f4d7a2d354812b3b";
const product = {
  name: "Example Phone",
  category: "smartphone",
  specs: { RAM: "8 GB", Storage: "128 GB" },
  normalizedSpecs: { ramGB: 8, storageGB: 128 },
  sellers: [{ platform: "Amazon India", price: 45000, currency: "INR", url: "https://www.amazon.in/dp/B000000001" }],
  bestPrice: 45000,
};

function invoke(body) {
  return new Promise((resolve, reject) => {
    chatWithAssistant({ body }, { json: resolve }, reject);
  });
}

test("chat requires exactly one valid product or recommendation context", () => {
  for (const context of [{ productId }, { recommendationId }]) {
    const result = chatMessageSchema.safeParse({ body: { ...context, message: " Which one? " } });
    assert.equal(result.success, true);
    assert.equal(result.data.body.message, "Which one?");
  }
  for (const context of [{}, { productId, recommendationId }, { productId: "invalid" }, { recommendationId: "invalid" }]) {
    assert.equal(chatMessageSchema.safeParse({ body: { ...context, message: "Which one?" } }).success, false);
  }
});

test("product questions use stored product specs without performing a recommendation search", async (t) => {
  t.mock.method(Product, "findById", async (id) => {
    assert.equal(id, productId);
    return { toJSON: () => product };
  });
  t.mock.method(Recommendation, "findById", () => assert.fail("Must not create or load a shortlist for a product question"));
  t.mock.method(Groq.Chat.Completions.prototype, "create", async (request, options) => {
    assert.match(request.messages[0].content, /Example Phone/);
    assert.match(request.messages[0].content, /128 GB/);
    assert.match(request.messages[0].content, /not verified/);
    assert.equal(request.messages.at(-1).content, "What storage does it have?");
    assert.equal(options.timeout, 15000);
    assert.equal(options.maxRetries, 0);
    return { choices: [{ message: { content: "It lists 128 GB storage." } }] };
  });
  assert.deepEqual(await invoke({ productId, message: "What storage does it have?" }), {
    success: true, reply: "It lists 128 GB storage.",
  });
});

test("recommendation follow-ups include specs, tradeoffs and only the latest eight history messages", async (t) => {
  t.mock.method(Recommendation, "findById", (id) => {
    assert.equal(id, recommendationId);
    return { populate: async () => ({ toObject: () => ({
      preferences: { budget: { max: 50000 } },
      picks: [{ rank: 1, product, reasoning: "Fits budget", tradeoffs: "Camera is not verified" }],
    }) }) };
  });
  const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `turn ${i}` }));
  t.mock.method(Groq.Chat.Completions.prototype, "create", async ({ messages }) => {
    assert.equal(messages.length, 10);
    assert.deepEqual(messages.slice(1, -1), history.slice(-8));
    assert.match(messages[0].content, /Camera is not verified/);
    assert.match(messages[0].content, /128 GB/);
    return { choices: [{ message: { content: "Here is the comparison." } }] };
  });
  const result = await invoke({ recommendationId, message: "Compare these", history });
  assert.equal(result.reply, "Here is the comparison.");
});

test("missing products and empty saved shortlists return 404 before calling AI", async (t) => {
  t.mock.method(Product, "findById", async () => null);
  t.mock.method(Recommendation, "findById", () => ({ populate: async () => ({
    toObject: () => ({ preferences: {}, picks: [{ product: null }] }),
  }) }));
  t.mock.method(Groq.Chat.Completions.prototype, "create", () => assert.fail("No usable product context"));
  await assert.rejects(invoke({ productId, message: "Hi" }), { statusCode: 404 });
  await assert.rejects(invoke({ recommendationId, message: "Hi" }), { statusCode: 404 });
});

test("stored Mongoose spec maps remain visible in recommendation chat prompts", async (t) => {
  const storedProduct = new Product({ ...product, _id: productId, brand: "Example" });
  const recommendation = new Recommendation({
    _id: recommendationId,
    preferences: { budget: { max: 50000 } },
    picks: [{ rank: 1, product: storedProduct, reasoning: "Fits budget" }],
  });
  t.mock.method(Recommendation, "findById", () => ({ populate: async () => recommendation }));
  t.mock.method(Groq.Chat.Completions.prototype, "create", async ({ messages }) => {
    assert.match(messages[0].content, /"Storage":"128 GB"/);
    assert.match(messages[0].content, /"RAM":"8 GB"/);
    return { choices: [{ message: { content: "The listing confirms 8 GB RAM and 128 GB storage." } }] };
  });
  assert.equal((await invoke({ recommendationId, message: "What memory does it have?" })).success, true);
});

test("provider errors distinguish quota, credentials, timeout and temporary failures", async (t) => {
  for (const [error, statusCode, message] of [
    [{ status: 429 }, 503, /usage limit/],
    [{ status: 401 }, 503, /credentials/],
    [{ status: 403 }, 503, /credentials/],
    [new Groq.APIConnectionTimeoutError(), 504, /too long/],
    [{ status: 500 }, 503, /temporarily unavailable/],
  ]) {
    const mock = t.mock.method(Groq.Chat.Completions.prototype, "create", async () => { throw error; });
    await assert.rejects(completeChat({ system: "Test", history: [] }), (err) => {
      assert.equal(err.statusCode, statusCode);
      assert.match(err.message, message);
      assert.doesNotMatch(err.message, /running without one|GROQ_API_KEY/);
      return true;
    });
    mock.mock.restore();
  }
});

test("empty provider responses fail clearly instead of displaying a blank answer", async (t) => {
  t.mock.method(Groq.Chat.Completions.prototype, "create", async () => ({ choices: [{ message: { content: "  " } }] }));
  await assert.rejects(completeChat({ system: "Test", history: [] }), (err) => {
    assert.equal(err.statusCode, 503);
    assert.match(err.message, /no answer/);
    return true;
  });
});

test("an unset provider key returns an actionable service-unavailable error", () => {
  const source = `
    import assert from 'node:assert/strict';
    const { completeChat } = await import(${JSON.stringify(new URL("../services/ai.service.js", import.meta.url).href)});
    await assert.rejects(completeChat({ system: 'Test', history: [] }), err => {
      assert.equal(err.statusCode, 503);
      assert.match(err.message, /not configured/);
      return true;
    });
  `;
  execFileSync(process.execPath, ["--input-type=module", "-e", source], {
    env: { ...process.env, GROQ_API_KEY: "" },
    stdio: "pipe",
  });
});
