const CATEGORIES = new Set(["smartphone", "laptop", "headphones", "smartwatch", "tablet", "monitor"]);

// A model name in a title does not make the listing the model itself. These
// phrases identify compatibility accessories or replacement components.
const COMPATIBILITY_SUBJECT = /^(?:(?:original|genuine|new|universal|premium)\s+)*(?:compatible\s+(?:for|with)|for\b|replacement\b|spare\b)/i;
const REPAIR_COMPONENT = /\breplacement\b(?!\s+(?:warranty|guarantee)\b)|\b(?:spare\s+parts?|repair\s+kit|digitizer|digitiser|motherboard|logic\s+board)\b|\b(?:screen|display|touch\s+panel)\s+(?:assembly|combo|module)\b/i;
const COMPONENT_ONLY = /\b(?:case|cover|charger|adapter|cable|battery|keyboard|screen|display|stand|strap|band|ear\s*pad)s?\s+only\b/i;
const PROTECTIVE_ACCESSORY = /\b(?:case|cover|protector|sleeve|skin|pouch|bumper|holster)s?\b|\btempered[ -]+glass\b/i;
const POWER_ACCESSORY = /\b(?:charger|adapter|cable|dock)s?\b|\bcharging[ -]+(?:pad|stand|box)\b/i;
const BARE_DISPLAY_PART = /\b(?:lcd|oled)\s+(?:display|screen)\b|\b(?:display|screen)\s*(?:for\b|$)/i;
const DEVICE_SPECIFICATION = /\b\d+(?:\.\d+)?\s*(?:gb|tb|mah)\b/i;

const CATEGORY_PARTS = {
  smartphone: /\b(?:lens\s+protector|sim\s+tray|back\s+panel|housing|charging\s+port|battery\s+door|mount|holder|stand)s?\b/i,
  tablet: /\b(?:keyboard\s+attachment|stylus\s+pen|pen\s+tip|charging\s+port|mount|holder|stand)s?\b/i,
  laptop: /\b(?:keyboard\s+(?:layout|for)|trackpad\s+assembly|touchpad\s+assembly|bottom\s+(?:panel|shell)|hinge\s+kit|stand)s?\b/i,
  headphones: /\b(?:ear[ -]*pad|ear[ -]*cushion|ear[ -]*tip|replacement\s+headband)s?\b|\bcharging\s+case\b/i,
  smartwatch: /\b(?:strap|band|bracelet)s?\b/i,
  monitor: /\b(?:monitor\s+(?:arm|stand)|mounting\s+bracket|wall\s+mount|desk\s+mount)s?\b/i,
};

// Bundled accessories describe a complete product only when the device is
// the primary subject: "AirPods ... with charging case". An accessory named
// before the connector ("AirPods charging case with cable") stays rejected.
const BUNDLE_CONNECTOR = /\b(?:with|includes?|including|comes\s+with|bundled\s+with)\b/i;

function primarySubject(title) {
  const connector = BUNDLE_CONNECTOR.exec(title);
  return connector ? title.slice(0, connector.index).trim() : title;
}

export function isWholeProductListing(title, category) {
  if (typeof title !== "string" || !title.trim() || !CATEGORIES.has(category)) return false;
  const text = title.normalize("NFKC").replace(/[_–—]+/g, " ").replace(/\s+/g, " ").trim();
  if (COMPATIBILITY_SUBJECT.test(text) || REPAIR_COMPONENT.test(text) || COMPONENT_ONLY.test(text)) return false;

  let subject = primarySubject(text);
  if (!subject) return false;
  // Bare model + LCD/OLED display titles commonly sell a replacement panel.
  // Do not treat that ambiguous title as a complete device without a device
  // configuration or battery specification. Monitors are themselves displays.
  if (["smartphone", "tablet", "laptop"].includes(category)
    && BARE_DISPLAY_PART.test(subject) && !DEVICE_SPECIFICATION.test(subject)) return false;
  // A watch's material case is its body, not a protective accessory.
  if (category === "smartwatch") {
    subject = subject.replace(/\b(?:alumini?um|titanium|stainless[ -]+steel|ceramic)\s+case\b/gi, " ");
  }
  return !PROTECTIVE_ACCESSORY.test(subject)
    && !POWER_ACCESSORY.test(subject)
    && !CATEGORY_PARTS[category].test(subject);
}
