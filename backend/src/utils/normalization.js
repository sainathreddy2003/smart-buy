// Turns loosely-formatted spec strings (as they'd arrive from a live provider,
// or from a human-typed spec sheet) into normalized numeric fields the
// recommendation engine can actually compare and score.

/**
 * Parses a price string ("₹11,999", "$8.99") into a number, rejecting
 * anything below a sane floor. Live providers occasionally return a
 * malformed or misaligned price field (a rating, a stray fragment) that
 * technically parses as a positive number but is obviously not a real price
 * for any product in our catalog (e.g. "₹8" for a monitor) — better to drop
 * the listing than show a nonsensical price.
 */
export function parsePrice(str, { minimum = 300 } = {}) {
  if (str == null) return null;
  if (typeof str === "number") return str >= minimum ? str : null;
  // Keep the decimal point (some providers return "$79.99") but strip
  // currency symbols, commas, and whitespace.
  const n = Number(String(str).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= minimum ? Math.round(n * 100) / 100 : null;
}

// India-targeted shopping APIs sometimes still return foreign currency or
// decorated prices such as installments. Accept a single INR amount only.
export function parseInrPrice(value) {
  if (typeof value === "number") return Number.isFinite(value) ? parsePrice(value) : null;
  if (!/^(?:(?:₹|INR|Rs\.?)\s*)?\d[\d,]*(?:\.\d{1,2})?$/i.test(String(value).trim())) return null;
  return parsePrice(value);
}

/**
 * "16GB" | "16 GB RAM" | "RAM: 16 GB" | "16-gigabyte" -> 16
 */
export function parseRAM(input) {
  if (input == null) return null;
  if (typeof input === "number") return input;
  const match = String(input).match(/(\d+(?:\.\d+)?)\s*[-]?\s*(gb|gigabyte)/i);
  return match ? Number(match[1]) : null;
}

/**
 * "512GB SSD" | "0.5TB" | "512 GB storage" | "1TB" -> GB as a number
 */
export function parseStorage(input) {
  if (input == null) return null;
  if (typeof input === "number") return input;
  const str = String(input);

  const tbMatch = str.match(/(\d+(?:\.\d+)?)\s*[-]?\s*tb/i);
  if (tbMatch) return Number(tbMatch[1]) * 1024;

  const gbMatch = str.match(/(\d+(?:\.\d+)?)\s*[-]?\s*gb/i);
  if (gbMatch) return Number(gbMatch[1]);

  return null;
}

/**
 * "4700mAh" | "4700 mAh, 45W wired" -> approximate battery life in hours.
 * mAh alone doesn't determine hours (depends on display/chip draw), so this
 * applies a rough, clearly-approximate conversion — good enough for ranking,
 * never presented to the user as a manufacturer-quoted figure.
 */
export function parseBatteryHours(input, category, chip) {
  if (input == null) return null;
  if (typeof input === "number") return input;
  const str = String(input);

  // Match every "X hours" figure and take the largest — strings like
  // "8 hours (buds) + 45 hours (case)" should score on the real total
  // battery life a shopper gets, not whichever number appears first.
  const hourMatches = [...str.matchAll(/(\d+(?:\.\d+)?)\s*(?:hours|hrs|h\b)/gi)];
  if (hourMatches.length > 0) {
    return Math.max(...hourMatches.map((m) => Number(m[1])));
  }

  const mahMatch = str.match(/(\d+(?:\.\d+)?)\s*mah/i);
  if (mahMatch) {
    const mah = Number(mahMatch[1]);
    // Phones/watches drain faster per mAh than a laptop's larger, lower-draw cell.
    let divisor = category === "smartwatch" ? 60 : category === "smartphone" ? 550 : 900;
    // Apple silicon is well-documented as meaningfully more power-efficient
    // per mAh than contemporary Android SoCs — without this, a smaller
    // iPhone battery scores as "worse" despite comparable or better
    // real-world battery life, which is a known, uncontroversial effect,
    // not an arbitrary thumb on the scale for one brand.
    if (/apple (a1[5-9]|m\d)/i.test(String(chip || ""))) divisor *= 0.72;
    return Math.round((mah / divisor) * 10) / 10;
  }

  const whMatch = str.match(/(\d+(?:\.\d+)?)\s*wh/i);
  if (whMatch) return Math.round((Number(whMatch[1]) / 9) * 10) / 10; // ~9W average laptop draw

  return null;
}

/**
 * Maps a free-text CPU/chip description to a coarse 0-5 performance tier.
 * Deliberately simple keyword tiering, not a benchmark database — sufficient
 * to rank a small demo catalog and to demonstrate the normalization pattern.
 */
export function tierFromCPU(input) {
  if (input == null) return 2;
  const str = String(input).toLowerCase();
  const tiers = [
    {
      tier: 5,
      keywords: [
        "ultra 9", "i9", "ryzen 9", "m3 max", "m3 pro", "m4 pro", "apple a18", "apple a17",
        "snapdragon 8 gen 3", "snapdragon 8 gen 2", "snapdragon 8 elite", "dimensity 9",
      ],
    },
    {
      tier: 4,
      // "snapdragon 7 gen" (not just "snapdragon 7") so it doesn't also match
      // the cost-down "7s" variants, which belong a tier lower.
      keywords: [
        "ultra 7", "i7", "ryzen 7", "m3", "m2 pro", "m4", "snapdragon 7 gen", "apple a16",
        "google tensor g3", "google tensor g4", "exynos 2400", "dimensity 8",
      ],
    },
    {
      tier: 3,
      keywords: [
        "ultra 5", "i5", "ryzen 5", "m2", "m1 pro", "snapdragon 6", "snapdragon 7s", "apple a15",
        "google tensor g2", "exynos 1480", "dimensity 7", "snapdragon 750",
      ],
    },
    { tier: 2, keywords: ["i3", "ryzen 3", "m1", "snapdragon 4", "helio g", "dimensity 6"] },
    { tier: 1, keywords: ["celeron", "pentium", "athlon"] },
  ];
  for (const { tier, keywords } of tiers) {
    if (keywords.some((k) => str.includes(k))) return tier;
  }
  return 2;
}

/**
 * Maps a free-text GPU description to a 0-5 tier. 0 = no dedicated GPU.
 */
export function tierFromGPU(input) {
  if (input == null) return 0;
  const str = String(input).toLowerCase();
  if (/integrated|iris|uhd graphics|radeon graphics\b(?!.*rx)/.test(str) || str.trim() === "") return 0;
  const tiers = [
    { tier: 5, keywords: ["rtx 4080", "rtx 4090", "rtx 4070"] },
    { tier: 4, keywords: ["rtx 4060", "rtx 3070", "rtx 3080", "radeon rx 7"] },
    { tier: 3, keywords: ["rtx 4050", "rtx 3060", "rtx 2060", "radeon rx 6"] },
    { tier: 2, keywords: ["gtx 1650", "rtx 3050", "mx550", "mx450"] },
    { tier: 1, keywords: ["mx"] },
  ];
  for (const { tier, keywords } of tiers) {
    if (keywords.some((k) => str.includes(k))) return tier;
  }
  if (str.includes("rtx") || str.includes("gtx") || str.includes("radeon rx")) return 2;
  // A dedicated GPU is confirmed present but the specific model wasn't
  // available (e.g. truncated from a live listing) — score as a reasonable
  // mid-tier rather than silently treating it the same as no GPU at all.
  if (/dedicated gpu|discrete graphics/.test(str)) return 3;
  return 0;
}

/**
 * Approximate display quality score (0-5) from refresh rate / panel keywords.
 */
export function scoreFromDisplay({ refreshRate, panel } = {}) {
  let score = 2.5;
  const rr = Number(String(refreshRate || "").match(/\d+/)?.[0]);
  if (rr >= 144) score += 1.5;
  else if (rr >= 90) score += 1;
  const p = String(panel || "").toLowerCase();
  if (p.includes("oled") || p.includes("amoled")) score += 1;
  if (p.includes("2k") || p.includes("qhd") || p.includes("4k")) score += 0.5;
  return Math.min(5, Math.round(score * 10) / 10);
}

/**
 * Approximate portability score (0-5) from weight in grams/kg.
 * Lighter = higher score. Category-relative — a 1.2kg laptop is very portable,
 * a 1.2kg tablet would not be.
 */
export function scoreFromWeight(weightInput, category) {
  const str = String(weightInput || "");
  const kgMatch = str.match(/(\d+(?:\.\d+)?)\s*kg/i);
  const gMatch = str.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  let grams = null;
  if (kgMatch) grams = Number(kgMatch[1]) * 1000;
  else if (gMatch) grams = Number(gMatch[1]);
  if (grams == null) return 3; // unknown -> neutral

  const thresholds =
    category === "laptop"
      ? [1200, 1600, 2000, 2500]
      : category === "smartphone"
        ? [180, 200, 220, 250]
        : category === "tablet"
          ? [450, 550, 650, 800]
          : [150, 250, 350, 500];

  if (grams <= thresholds[0]) return 5;
  if (grams <= thresholds[1]) return 4;
  if (grams <= thresholds[2]) return 3;
  if (grams <= thresholds[3]) return 2;
  return 1;
}
