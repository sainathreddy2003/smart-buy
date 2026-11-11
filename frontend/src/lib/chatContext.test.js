import { test } from "node:test";
import assert from "node:assert/strict";
import { SEARCH_QUERY_LIMIT, buildChatHistory, buildSearchQuery } from "./chatContext.js";

test("search clarification retains the latest answer within the API limit", () => {
  const original = "Laptop for video editing under 80000 with long battery life. ".repeat(100);
  const latest = "I also need 16GB RAM and a lightweight model for college.";
  const query = buildSearchQuery([original, latest]);
  assert.equal(query.length, SEARCH_QUERY_LIMIT);
  assert.ok(query.startsWith("Laptop for video editing under 80000"));
  assert.ok(query.endsWith(latest));
  assert.equal(buildSearchQuery([original, "x".repeat(SEARCH_QUERY_LIMIT)]), "x".repeat(SEARCH_QUERY_LIMIT));
});

test("a long multi-sentence shopping request reaches the API verbatim", () => {
  const request = [
    "I need a phone under 1 lakh for recording travel videos and taking photographs in low light.",
    "I care about reliable autofocus, natural skin tones and video stabilization more than megapixel counts.",
    "I carry the phone all day, so battery life and a comfortable weight are important as well.",
    "I already have USB-C accessories and need enough storage for videos without constantly deleting files.",
    "Please consider the full balance of camera quality, software support, performance and portability.",
    "My final requirement is at least 256GB storage; do not miss this condition at the end of the message.",
  ].join(" ");
  assert.ok(request.length > 500 && request.length < SEARCH_QUERY_LIMIT);
  assert.equal(buildSearchQuery([request]), request);
  assert.ok(buildSearchQuery(["I am looking for a smartphone.", request]).endsWith(request));
});

test("an oversized latest request is rejected instead of silently clipped", () => {
  assert.throws(() => buildSearchQuery(["x".repeat(SEARCH_QUERY_LIMIT + 1)]), RangeError);
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
