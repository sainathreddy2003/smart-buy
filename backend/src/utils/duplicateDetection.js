// Different sellers/providers often describe the same physical product with
// slightly different titles ("ASUS TUF A15" vs "ASUS TUF Gaming A15 FA507").
// These helpers decide whether two incoming records are "the same product"
// and, if so, merge seller offers into one Product document instead of
// creating a duplicate.

const NOISE_WORDS = new Set([
  "the", "a", "an", "new", "gaming", "laptop", "smartphone", "phone",
  "headphones", "headphone", "smartwatch", "watch", "tablet", "monitor",
  "with", "and", "edition", "series",
]);

/**
 * Lowercases, strips punctuation and marketing noise words, and collapses
 * whitespace — so "ASUS TUF Gaming A15 FA507" and "ASUS TUF A15 FA507
 * Gaming Laptop" normalize to the same token set.
 */
export function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !NOISE_WORDS.has(word))
    .sort()
    .join(" ");
}

// A token that's a genuine model identifier ("a55", "s24", "fa507nv", "m3")
// vs. a generic spec/connectivity suffix that happens to contain a digit and
// says nothing about WHICH model this is ("5g", "12gb", "256gb", "100w",
// "5000mah", "120hz", "4k") — shared by countless unrelated products.
const GENERIC_SPEC_SUFFIX = /^\d+(g|gb|tb|mp|w|mah|hz|nm|k)$/;

function modelIdentifyingTokens(tokens) {
  return tokens.filter((t) => /\d/.test(t) && !GENERIC_SPEC_SUFFIX.test(t));
}

/**
 * Two records are treated as the same product if they share a brand, and
 * either an exact model-number field match or a high token overlap on the
 * normalized title — WITH one hard gate first: if both titles carry a real
 * model-identifying token (contains a digit, isn't a generic spec/
 * connectivity word like "5g"/"12gb"), those must actually agree. Without
 * this gate, two different phones from the same brand that both happen to
 * mention "Galaxy" and "5G" (e.g. an old seed "Samsung Galaxy A55 5G" vs. an
 * AI-suggested "Samsung Galaxy S24 Ultra 5G") can clear a plain word-overlap
 * threshold on generic marketing words alone, merging a stale/cheap catalog
 * entry into a completely different live result and showing the wrong
 * product at the wrong price.
 */
export function isSameProduct(a, b) {
  if (String(a.brand || "").toLowerCase() !== String(b.brand || "").toLowerCase()) {
    return false;
  }

  if (a.model && b.model && String(a.model).toLowerCase() === String(b.model).toLowerCase()) {
    return true;
  }

  const tokensA = normalizeTitle(a.name).split(" ").filter(Boolean);
  const tokensB = normalizeTitle(b.name).split(" ").filter(Boolean);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const modelA = modelIdentifyingTokens(tokensA);
  const modelB = modelIdentifyingTokens(tokensB);
  if (modelA.length > 0 && modelB.length > 0 && !modelA.some((t) => modelB.includes(t))) {
    return false;
  }

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const overlap = intersection / Math.min(setA.size, setB.size);
  return overlap >= 0.7;
}

/**
 * Merges an incoming seller offer into an existing product's `sellers` array
 * (replacing that platform's entry if present, appending otherwise), and
 * recomputes `bestPrice`. Mutates and returns `existingProduct.sellers`.
 */
export function mergeSellerOffers(existingProduct, incomingSeller) {
  const sellers = existingProduct.sellers || [];
  const index = sellers.findIndex((s) => s.platform === incomingSeller.platform);
  if (index >= 0) sellers[index] = incomingSeller;
  else sellers.push(incomingSeller);

  existingProduct.sellers = sellers;
  existingProduct.bestPrice = Math.min(...sellers.map((s) => s.price));
  return sellers;
}
