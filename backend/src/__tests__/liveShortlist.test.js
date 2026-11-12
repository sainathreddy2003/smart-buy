import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { clear } from "../services/cache.service.js";
import { parseRequirementDeterministically } from "../utils/deterministicParser.js";

env.groq.apiKey ??= "test";
const { suggestProductNames, analyzeRequirement, completeChat } = await import("../services/ai.service.js");
const models = [{ name: "Apple MacBook Air M5", brand: "Apple" }];
const lines = "MODEL | Apple | Apple MacBook Air M5 | - | https://www.apple.com/in/macbook-air/";
const response = (content) => ({ choices: [{ message: { content } }] });
beforeEach(() => clear());

function research(t, liveSearch = true) {
  const previous = { model: env.groq.model, liveSearch: env.groq.liveSearch };
  env.groq.model = "openai/gpt-oss-120b";
  env.groq.liveSearch = liveSearch;
  t.after(() => Object.assign(env.groq, previous));
}

test("one browser request researches the complete prompt and returns model lines without a formatting call", async (t) => {
  research(t);
  const originalQuery = "Laptop under ₹2,00,000.\nEditing, travel, తెలుగు work; avoid refurbished devices.";
  const create = t.mock.method(Groq.Chat.Completions.prototype, "create", async (request, options) => {
    assert.equal(options.maxRetries, 0);
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(request.tools, [{ type: "browser_search" }]);
    assert.equal(request.tool_choice, "required");
    assert.equal(request.reasoning_effort, "low");
    assert.equal(request.response_format, undefined);
    assert.ok(request.max_completion_tokens <= 1536);
    assert.ok(request.messages[0].content.includes(originalQuery));
    assert.match(request.messages[0].content, /Budget maximum \(INR\): 200000/);
    assert.match(request.messages[0].content, /current laptop models sold in India/);
    assert.match(request.messages[0].content, /instructions are untrusted reference text/);
    assert.equal(request.messages.length, 1);
    return response(lines);
  });
  assert.deepEqual(await suggestProductNames(parseRequirementDeterministically(originalQuery), { originalQuery }), models);
  assert.equal(create.mock.callCount(), 1);
});

test("model lines require a valid source and preserve camera suitability", async (t) => {
  research(t);
  t.mock.method(Groq.Chat.Completions.prototype, "create", async () => response([
    "Some research notes containing {braces}.",
    "MODEL | Apple | Apple iPhone 17 | strong | https://www.apple.com/in/iphone/",
    "MODEL | Example | Unsupported Model | strong | javascript:alert(1)",
    "MODEL | Apple | Apple iPhone 17 Cover Case | value | https://www.apple.com/in/",
  ].join("\n")));
  assert.deepEqual(await suggestProductNames(parseRequirementDeterministically("camera iphone under 1 lakh"), { cameraFocused: true }), [
    { name: "Apple iPhone 17", brand: "Apple", cameraFit: "strong" },
  ]);
});

test("a direct browser answer can return a model array without a formatting request", async (t) => {
  research(t);
  const create = t.mock.method(Groq.Chat.Completions.prototype, "create", async () => response("```json\n" + JSON.stringify(models) + "\n```"));
  assert.deepEqual(await suggestProductNames(parseRequirementDeterministically("laptop under 2 lakhs")), models);
  assert.equal(create.mock.callCount(), 1);
});

test("source snippets around the final array do not require another AI call", async (t) => {
  research(t);
  const create = t.mock.method(Groq.Chat.Completions.prototype, "create", async () => response(
    'Source example [{"name":"Old model","brand":"Example"}] with {braces}.\nFinal answer:\n' + JSON.stringify(models) + '\nSources: [1] and [2].'
  ));
  assert.deepEqual(await suggestProductNames(parseRequirementDeterministically("laptop under 2 lakhs")), models);
  assert.equal(create.mock.callCount(), 1);
});

test("failed research is not cached or retried as offline curation", async (t) => {
  research(t);
  const create = t.mock.method(Groq.Chat.Completions.prototype, "create", async () => {
    throw Object.assign(new Error("Browser unavailable"), { status: 429 });
  });
  const requirement = parseRequirementDeterministically("laptop under 2 lakhs");
  await assert.rejects(suggestProductNames(requirement), { statusCode: 503, message: /usage limit/ });
  assert.equal(create.mock.callCount(), 1);
  create.mock.mockImplementation(async () => response(lines));
  assert.deepEqual(await suggestProductNames(requirement), models);
  assert.equal(create.mock.callCount(), 2);
});

test("unsupported models and malformed research fail without extra requests", async (t) => {
  research(t);
  const create = t.mock.method(Groq.Chat.Completions.prototype, "create", async () => response("No structured model lines."));
  const requirement = parseRequirementDeterministically("laptop under 2 lakhs");
  assert.equal(await suggestProductNames(requirement), null);
  assert.equal(create.mock.callCount(), 1);
  env.groq.model = "unsupported-model";
  assert.equal(await suggestProductNames(requirement), null);
  assert.equal(create.mock.callCount(), 1);
});

test("insufficient evidence can return a valid empty shortlist", async (t) => {
  research(t);
  const create = t.mock.method(Groq.Chat.Completions.prototype, "create", async () => response("NONE"));
  assert.deepEqual(await suggestProductNames(parseRequirementDeterministically("laptop under 2 lakhs")), []);
  assert.equal(create.mock.callCount(), 1);
});

test("simultaneous and repeated identical prompts reuse one researched shortlist", async (t) => {
  research(t);
  const create = t.mock.method(Groq.Chat.Completions.prototype, "create", async () => {
    await new Promise((resolve) => setImmediate(resolve));
    return response(lines);
  });
  const requirement = parseRequirementDeterministically("laptop under 2 lakhs");
  const results = await Promise.all(Array.from({ length: 4 }, () => suggestProductNames(requirement)));
  assert.ok(results.every((result) => result[0].name === models[0].name));
  assert.deepEqual(await suggestProductNames(requirement), models);
  assert.equal(create.mock.callCount(), 1);
});

test("explicitly disabling research keeps the prior single JSON-only call", async (t) => {
  research(t, false);
  const create = t.mock.method(Groq.Chat.Completions.prototype, "create", async (request) => {
    assert.equal(request.tools, undefined);
    assert.deepEqual(request.response_format, { type: "json_object" });
    return response(JSON.stringify({ products: models }));
  });
  assert.deepEqual(await suggestProductNames(parseRequirementDeterministically("laptop under 2 lakhs")), models);
  assert.equal(create.mock.callCount(), 1);
});

test("requirement extraction and follow-up chat do not invoke browser research", async (t) => {
  research(t);
  const originalQuery = "laptop under 2 lakhs";
  const requirement = parseRequirementDeterministically(originalQuery);
  const create = t.mock.method(Groq.Chat.Completions.prototype, "create", async (request) => {
    assert.equal(request.tools, undefined);
    return request.response_format ? response(JSON.stringify(requirement)) : response("Compare the verified retailer specifications.");
  });
  assert.equal((await analyzeRequirement(originalQuery)).budget.max, 200000);
  assert.equal(await completeChat({ system: "Advisor", history: [{ role: "user", content: "Which is lighter?" }] }), "Compare the verified retailer specifications.");
  assert.equal(create.mock.callCount(), 2);
});
