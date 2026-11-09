import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseRequirementDeterministically } from "../utils/deterministicParser.js";

describe("parseRequirementDeterministically", () => {
  test("extracts category and budget from 'laptop under 80000'", () => {
    const result = parseRequirementDeterministically("laptop under 80000");
    assert.equal(result.category, "laptop");
    assert.equal(result.budget.max, 80000);
  });

  test("parses 'k' shorthand budgets", () => {
    const result = parseRequirementDeterministically("laptop for coding, budget 70k");
    assert.equal(result.budget.max, 70000);
  });

  test("parses lakh budgets", () => {
    const result = parseRequirementDeterministically("laptop under 1.2 lakh");
    assert.equal(result.budget.max, 120000);
  });

  test("uses the latest explicit budget across turns and units", () => {
    const result = parseRequirementDeterministically("Laptop under 1 lakh. Actually under ₹60,000.");
    assert.equal(result.budget.max, 60000);
  });

  test("keeps both endpoints of a stated price range", () => {
    const result = parseRequirementDeterministically("Laptop between ₹40,000 and ₹60,000");
    assert.deepEqual(result.budget, { min: 40000, max: 60000, currency: "INR" });
  });

  test("weights GPU heavily for a gaming request", () => {
    const result = parseRequirementDeterministically("gaming laptop under 90000");
    assert.ok(result.priorities.gpu >= result.priorities.battery);
    assert.equal(result.requirements.gpu.required, true);
  });

  test("does not require a GPU for a coding/student request", () => {
    const result = parseRequirementDeterministically("laptop for coding and college work");
    assert.equal(result.requirements.gpu.required, false);
    assert.ok(result.priorities.ram > result.priorities.gpu);
  });

  test("flags clarification needed when category is undetectable", () => {
    const result = parseRequirementDeterministically("suggest something good");
    assert.equal(result.clarificationNeeded, true);
    assert.ok(result.clarifyingQuestion);
  });

  test("does not ask for clarification just because budget is missing", () => {
    const result = parseRequirementDeterministically("headphones with good ANC for gym");
    assert.equal(result.clarificationNeeded, false);
  });
});
