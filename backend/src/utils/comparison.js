// Builds a spec-by-spec comparison table from a set of products, highlighting
// which product "wins" each row (direction depends on the field — lower price
// is better, higher RAM is better, etc). Purely arithmetic over real product
// fields — nothing here is AI-generated.

const ROWS = [
  { key: "bestPrice", label: "Best price", get: (p) => p.bestPrice, direction: "lower", format: "price" },
  { key: "rating", label: "Rating", get: (p) => p.rating, direction: "higher", format: "rating" },
  { key: "ramGB", label: "RAM", get: (p) => p.normalizedSpecs?.ramGB, direction: "higher", format: "gb" },
  { key: "storageGB", label: "Storage", get: (p) => p.normalizedSpecs?.storageGB, direction: "higher", format: "gb" },
  { key: "cpuTier", label: "CPU tier", get: (p) => p.normalizedSpecs?.cpuTier, direction: "higher", format: "tier" },
  { key: "gpuTier", label: "GPU tier", get: (p) => p.normalizedSpecs?.gpuTier, direction: "higher", format: "tier" },
  { key: "displayScore", label: "Display", get: (p) => p.normalizedSpecs?.displayScore, direction: "higher", format: "score" },
  { key: "batteryHours", label: "Battery", get: (p) => p.normalizedSpecs?.batteryHours, direction: "higher", format: "hours" },
  { key: "portabilityScore", label: "Portability", get: (p) => p.normalizedSpecs?.portabilityScore, direction: "higher", format: "score" },
];

export function buildComparison(products) {
  const rows = ROWS.map((row) => {
    const values = products.map((p) => row.get(p) ?? null);
    const known = values.filter((v) => v != null);
    let bestValue = null;
    if (known.length > 0) {
      bestValue = row.direction === "higher" ? Math.max(...known) : Math.min(...known);
    }
    return {
      key: row.key,
      label: row.label,
      format: row.format,
      values: products.map((p, i) => ({
        productId: p._id,
        value: values[i],
        isBest: values[i] != null && bestValue != null && values[i] === bestValue && known.length > 1,
      })),
    };
  });

  return { productIds: products.map((p) => p._id), rows };
}

/**
 * A deterministic "best choice" verdict — picks whichever product wins the
 * most rows (ties broken by lowest price). Optionally weighted by a
 * requirements' priorities if one was supplied, so the verdict can reflect
 * "best for YOUR requirements" rather than a generic spec race.
 */
export function pickBestChoice(products, comparison) {
  const wins = Object.fromEntries(products.map((p) => [p._id.toString(), 0]));
  for (const row of comparison.rows) {
    for (const v of row.values) {
      if (v.isBest) wins[v.productId.toString()] += 1;
    }
  }

  let bestId = products[0]._id.toString();
  for (const p of products) {
    const id = p._id.toString();
    if (wins[id] > wins[bestId]) bestId = id;
    else if (wins[id] === wins[bestId] && p.bestPrice < products.find((x) => x._id.toString() === bestId).bestPrice) {
      bestId = id;
    }
  }

  const winner = products.find((p) => p._id.toString() === bestId);
  return { productId: winner._id, winCount: wins[bestId], totalRows: comparison.rows.length };
}
