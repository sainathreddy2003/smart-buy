import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { scoreProduct, normalizeToRequirement } from "../services/recommendation.service.js";

function fakeProduct(overrides) {
  return {
    _id: { equals: () => false },
    bestPrice: 60000,
    rating: 4.3,
    useCases: [],
    normalizedSpecs: { ramGB: 8, storageGB: 256, cpuTier: 2, gpuTier: 0, displayScore: 2.5, batteryHours: 6, portabilityScore: 3 },
    ...overrides,
  };
}

const gamingRequirement = {
  category: "laptop",
  budget: { min: 0, max: 100000, currency: "INR" },
  useCases: ["gaming"],
  requirements: { ram: { minimum: 16 }, storage: { minimum: null }, gpu: { required: true }, battery: { minimum: null }, anc: { required: false }, portability: { important: false } },
  priorities: { cpu: 0.25, gpu: 0.3, ram: 0.15, storage: 0.05, display: 0.15, battery: 0.02, portability: 0.08 },
};

const candidateMaxes = { ramGB: 32, storageGB: 1024, batteryHours: 12, bestPrice: 120000, valueRatio: 1 };

describe("scoreProduct", () => {
  test("a product matching the stated requirements scores higher than one that doesn't", () => {
    const goodMatch = fakeProduct({
      normalizedSpecs: { ramGB: 16, storageGB: 512, cpuTier: 4, gpuTier: 3, displayScore: 4, batteryHours: 6, portabilityScore: 2 },
    });
    const poorMatch = fakeProduct({
      normalizedSpecs: { ramGB: 8, storageGB: 256, cpuTier: 2, gpuTier: 0, displayScore: 2.5, batteryHours: 6, portabilityScore: 3 },
    });

    const goodScore = scoreProduct(goodMatch, gamingRequirement, candidateMaxes).final;
    const poorScore = scoreProduct(poorMatch, gamingRequirement, candidateMaxes).final;

    assert.ok(goodScore > poorScore, `expected ${goodScore} > ${poorScore}`);
  });

  test("a product priced above budget never scores via priceScore=0 contribution advantage", () => {
    const overBudget = fakeProduct({ bestPrice: 150000 });
    const inBudget = fakeProduct({ bestPrice: 90000 });

    const overScore = scoreProduct(overBudget, gamingRequirement, candidateMaxes);
    const inScore = scoreProduct(inBudget, gamingRequirement, candidateMaxes);

    assert.equal(overScore.breakdown.priceScore, 0);
    assert.ok(inScore.breakdown.priceScore > 0);
  });
});

describe("normalizeToRequirement", () => {
  test("normalizes the legacy guided-wizard shape into the canonical shape", () => {
    const result = normalizeToRequirement({
      category: "laptop",
      budgetMin: 0,
      budgetMax: 60000,
      useCase: "coding",
      mustHaveFeatures: [],
      notes: "",
    });

    assert.equal(result.category, "laptop");
    assert.equal(result.budget.max, 60000);
    assert.ok(result.priorities);
    assert.ok(result.requirements);
  });

  test("passes through an already-structured requirement unchanged", () => {
    const structured = { ...gamingRequirement };
    const result = normalizeToRequirement(structured);
    assert.equal(result, structured);
  });
});
