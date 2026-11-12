import { isWholeProductListing } from "./productListing.js";

const FAMILY = /\bmacbook\s+(air|pro)\b/;
const CHIP = /\bm([1-9])\s*(pro|max|ultra)?\b/g;
const CAPACITY = /\b(\d+(?:\.\d+)?)\s*(gb|tb)\b/g;
const MEMORY_LABEL = /^(?:ram|(?:unified\s+)?memory)\b/;
const STORAGE_LABEL = /^(?:ssd|storage|flash(?:\s+storage)?)\b/;
const SILICON_SCREEN_SIZES = new Set([13, 13.3, 13.6, 14, 14.2, 15, 15.3, 15.4, 16, 16.2]);

function labelBefore(text, pattern) {
  const label = pattern.exec(text);
  if (!label) return false;
  // In "16GB RAM 512GB SSD", RAM labels the preceding capacity, not 512GB.
  return !/\b\d+(?:\.\d+)?\s*(?:gb|tb)\s*$/.test(text.slice(0, label.index));
}

function normalized(text) {
  return text.replace(/[“”″]/g, '"').normalize("NFKC").toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/′′/g, '"')
    .replace(/\bmac\s*book\s*(air|pro)(?=\s|\d|$)/g, "macbook $1 ")
    .replace(/\bapple(?=m\d)/g, "apple ")
    .replace(/\bm([1-9])(?=chip\b)/g, "m$1 ")
    .replace(/\bm([1-9])(pro|max|ultra)(?=chip\b)/g, "m$1 $2 ")
    .replace(/(\d)(gb|tb)(?=ram|unified|memory|ssd|storage)/g, "$1$2 ")
    .replace(/\s+/g, " ").trim();
}

function primaryMacbook(text) {
  const family = FAMILY.exec(text);
  if (!family) return null;
  const prefix = text.slice(0, family.index)
    .replace(/\bbrand\s+new\b/g, "new")
    .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (prefix.some((word) => !["apple", "new", "latest", "original", "genuine"].includes(word) && !/^20\d{2}$/.test(word))) return null;
  return family;
}

function chipIdentity(text) {
  const chips = new Set([...text.matchAll(CHIP)].map(([, generation, modifier]) => `m${generation}${modifier ? ` ${modifier}` : ""}`));
  return chips.size === 1 ? [...chips][0] : null;
}

function years(text) {
  return new Set(text.match(/\b20\d{2}\b/g) || []);
}

function screenSizes(text, family) {
  const sizes = [...text.matchAll(/\b(\d{2}(?:\.\d+)?)\s*-?\s*(?:inch(?:es)?\b|in\b|")/g)]
    .map(([, size]) => Number(size));
  if (sizes.length) return new Set(sizes);
  const afterFamily = text.slice(family.index + family[0].length);
  const bare = afterFamily.match(/^\s+(\d{2}(?:\.\d+)?)(?=\s*(?:m[1-9]\b|apple\b|laptop\b|notebook\b|$|[(/,]))/);
  return new Set(bare ? [Number(bare[1])] : []);
}

function capacityConstraints(text) {
  const ram = new Set();
  const storage = new Set();
  const unknown = [];
  const matches = [...text.matchAll(CAPACITY)];
  for (const match of matches) {
    const amount = Number(match[1]) * (match[2] === "tb" ? 1024 : 1);
    const after = text.slice(match.index + match[0].length).replace(/^[\s:=(/-]+/, "");
    const before = text.slice(0, match.index);
    const memory = MEMORY_LABEL.test(after) || labelBefore(before, /\b(?:ram|(?:unified\s+)?memory)\s*[:=-]?\s*$/);
    const disk = STORAGE_LABEL.test(after) || labelBefore(before, /\b(?:ssd|storage|flash(?:\s+storage)?)\s*[:=-]?\s*$/);
    if (memory && disk) return null;
    if (memory) ram.add(amount);
    else if (disk || match[2] === "tb") storage.add(amount);
    else unknown.push(amount);
  }

  // Common compact configurations omit labels: "16GB/512GB". Assign only
  // unambiguous notebook-size memory and disk values, never a bag of numbers.
  for (const amount of unknown) {
    if (amount <= 96) ram.add(amount);
    else if (amount >= 256) storage.add(amount);
    else if (storage.size && !ram.size) ram.add(amount);
    else if (ram.size && !storage.size && amount >= 128) storage.add(amount);
    else return null;
  }
  if (ram.size > 1 || storage.size > 1) return null;
  return { ram, storage };
}

function suppliedSetMatches(requested, actual) {
  if (!requested.size) return true;
  return requested.size === 1 && actual.size === 1 && [...requested][0] === [...actual][0];
}

// Apple's 13-inch and 15-inch Air names describe 13.6/15.3-inch panels on
// M2 and newer models. Retailers use either naming convention for that item.
function canonicalAirSizes(sizes, family, chip) {
  if (family !== "air" || !/^m[2-9](?:\s|$)/.test(chip || "")) return sizes;
  return new Set([...sizes].map((size) => size === 13 ? 13.6 : size === 15 ? 15.3 : size));
}

function modelCodes(text) {
  const hardware = new Set(text.match(/\ba\d{4}\b/g) || []);
  const parts = new Set(text.match(/\b[msz][a-z0-9]{4}[a-z]{2}\/a\b/g) || []);
  const labelled = new Set([...text.matchAll(/\b(?:sku|model(?:\s*(?:no\.?|number))?)\s*[:#=-]\s*([a-z0-9][a-z0-9/.-]*)/g)]
    .map(([, code]) => code));
  return { hardware, parts, labelled };
}

function hasCode(text, code) {
  let index = text.indexOf(code);
  while (index >= 0) {
    const before = text[index - 1] || " ";
    const after = text[index + code.length] || " ";
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
    index = text.indexOf(code, index + 1);
  }
  return false;
}

/**
 * Match MacBook identity independently of retailer presentation words.
 * null delegates non-MacBook names to the caller's normal model matcher.
 * Every supplied chip, year, screen size and capacity remains a constraint.
 */
export function matchMacbookModel(title, modelName, modelBrand) {
  if (typeof modelName !== "string") return null;
  const requested = normalized(modelName);
  if (!FAMILY.test(requested)) return null;
  if (typeof title !== "string" || (modelBrand && modelBrand.trim().toLowerCase() !== "apple")) return false;
  if (!isWholeProductListing(title, "laptop")) return false;

  const actual = normalized(title);
  const requestedFamily = primaryMacbook(requested);
  const actualFamily = primaryMacbook(actual);
  if (!requestedFamily || !actualFamily || requestedFamily[1] !== actualFamily[1]) return false;

  const requestedChip = chipIdentity(requested);
  if (/\b(?:m\d+[a-z0-9]*|intel|core\s+i[3579]|i[3579])\b/.test(requested) && !requestedChip) return false;
  if (requestedChip && chipIdentity(actual) !== requestedChip) return false;
  if (!suppliedSetMatches(years(requested), years(actual))) return false;
  const actualScreens = screenSizes(actual, actualFamily);
  if (chipIdentity(actual) && [...actualScreens].some((size) => !SILICON_SCREEN_SIZES.has(size))) return false;
  // The older 13.3-inch Air panel is not an M2-or-newer Air configuration.
  if (actualFamily[1] === "air" && /^m[2-9](?:\s|$)/.test(chipIdentity(actual) || "") && actualScreens.has(13.3)) return false;
  if (!suppliedSetMatches(
    canonicalAirSizes(screenSizes(requested, requestedFamily), requestedFamily[1], requestedChip),
    canonicalAirSizes(actualScreens, actualFamily[1], chipIdentity(actual)),
  )) return false;

  const requestedCodes = modelCodes(requested);
  const actualCodes = modelCodes(actual);
  if (!suppliedSetMatches(requestedCodes.hardware, actualCodes.hardware)
    || !suppliedSetMatches(requestedCodes.parts, actualCodes.parts)
    || [...requestedCodes.labelled].some((code) => !hasCode(actual, code))) return false;

  const requestedCapacities = capacityConstraints(requested);
  if (!requestedCapacities) return false;
  if (requestedCapacities.ram.size || requestedCapacities.storage.size) {
    const actualCapacities = capacityConstraints(actual);
    if (!actualCapacities
      || !suppliedSetMatches(requestedCapacities.ram, actualCapacities.ram)
      || !suppliedSetMatches(requestedCapacities.storage, actualCapacities.storage)) return false;
  }
  return true;
}
