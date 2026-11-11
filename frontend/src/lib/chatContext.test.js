import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChatHistory, buildSearchQuery } from "./chatContext.js";

test("search clarification retains the latest answer within the API limit", () => {
  const original = "Laptop for video editing under 80000 with long battery life. ".repeat(12);
  const latest = "I also need 16GB RAM and a lightweight model for college.";
  const query = buildSearchQuery([original, latest]);
  assert.equal(query.length, 500);
  assert.ok(query.startsWith("Laptop for video editing under 80000"));
  assert.ok(query.endsWith(latest));
  assert.equal(buildSearchQuery([original, "x".repeat(500)]), "x".repeat(500));
});

test("long advisor conversations send eight bounded messages and omit failed replies", () => {
  const messages = Array.from({ length: 24 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    text: `Turn ${index}: ${"spec ".repeat(500)}`,
  }));
  messages.push({ role: "assistant", text: "Network error", error: true });
  const history = buildChatHistory(messages);
  assert.equal(history.length, 8);
  assert.ok(history[0].content.startsWith("Turn 16:"));
  assert.ok(history.at(-1).content.startsWith("Turn 23:"));
  assert.ok(history.every(({ content }) => content.length === 2000));
  assert.deepEqual(buildChatHistory([{ role: "assistant", kind: "products", intro: "Your shortlist" }]), [
    { role: "assistant", content: "Your shortlist" },
  ]);
});
