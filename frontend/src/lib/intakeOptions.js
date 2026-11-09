import { Smartphone, Laptop, Headphones, Watch, Tablet, Monitor } from "lucide-react";

export const CATEGORY_OPTIONS = [
  { value: "smartphone", label: "Smartphone", icon: Smartphone, blurb: "Camera, performance, everyday carry" },
  { value: "laptop", label: "Laptop", icon: Laptop, blurb: "Work, school, creative projects" },
  { value: "headphones", label: "Headphones", icon: Headphones, blurb: "Music, calls, noise cancellation" },
  { value: "smartwatch", label: "Smartwatch", icon: Watch, blurb: "Fitness, health, notifications" },
  { value: "tablet", label: "Tablet", icon: Tablet, blurb: "Note-taking, reading, light creative work" },
  { value: "monitor", label: "Monitor", icon: Monitor, blurb: "Gaming, productivity, color-accurate work" },
];

export const USE_CASE_OPTIONS = {
  smartphone: ["everyday", "photography", "gaming", "productivity", "budget"],
  laptop: ["everyday", "coding", "video editing", "gaming", "budget"],
  headphones: ["everyday", "travel", "gym", "anc travel", "gaming"],
  smartwatch: ["fitness", "gym", "everyday", "productivity"],
  tablet: ["everyday", "coding", "photography", "budget"],
  monitor: ["gaming", "video editing", "everyday"],
};

export const FEATURE_OPTIONS = {
  smartphone: ["Great camera", "Long battery life", "5G", "Compact size", "Fast charging", "Expandable storage"],
  laptop: ["Long battery life", "Lightweight", "High-res display", "Dedicated GPU", "Backlit keyboard", "Large storage"],
  headphones: ["Active noise cancellation", "Long battery life", "Wireless", "Comfortable fit", "High-fidelity sound", "Water resistant"],
  smartwatch: ["Built-in GPS", "Long battery life", "Cellular option", "Water resistant", "Health sensors", "Always-on display"],
  tablet: ["Stylus support", "Long battery life", "Large storage", "Lightweight", "High-res display"],
  monitor: ["High refresh rate", "Color accurate", "USB-C hub", "Curved", "Adjustable stand"],
};

// Rupee budget presets — matches the seeded catalog's real price bands.
export const BUDGET_PRESETS = {
  smartphone: { min: 0, max: 150000, step: 1000 },
  laptop: { min: 0, max: 250000, step: 5000 },
  headphones: { min: 0, max: 40000, step: 500 },
  smartwatch: { min: 0, max: 60000, step: 500 },
  tablet: { min: 0, max: 100000, step: 1000 },
  monitor: { min: 0, max: 100000, step: 1000 },
};
