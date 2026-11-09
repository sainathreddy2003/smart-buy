import clsx from "clsx";

export function cn(...args) {
  return clsx(...args);
}

export function formatPrice(value) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    value
  );
}

// Some live-sourced product images (Google Shopping thumbnail tokens
// specifically) aren't permanently stable and can occasionally 404 — hide a
// broken image rather than showing the browser's broken-image icon, leaving
// the surrounding card background as a clean, empty placeholder.
export function onImageError(e) {
  e.currentTarget.onerror = null;
  e.currentTarget.style.visibility = "hidden";
}

export function categoryLabel(category) {
  const labels = {
    smartphone: "Smartphone",
    laptop: "Laptop",
    headphones: "Headphones",
    smartwatch: "Smartwatch",
    tablet: "Tablet",
    monitor: "Monitor",
  };
  return labels[category] || category;
}
