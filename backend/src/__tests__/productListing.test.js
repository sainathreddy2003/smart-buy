import { test } from "node:test";
import assert from "node:assert/strict";
import { isWholeProductListing } from "../utils/productListing.js";

const genuineProducts = [
  ["smartphone", "Apple iPhone 15 Plus (128GB) - Blue"],
  ["smartphone", "iPhone 14 Plus (128GB) Starlight with USB-C cable"],
  ["smartphone", "Redmi Note 14 Pro 5G 8GB RAM 256GB AMOLED display 5000mAh battery"],
  ["smartphone", "Apple iPhone 15 Plus 128GB Super Retina XDR Display"],
  ["smartphone", "Redmi Note 14 4GB RAM 128GB IPS LCD display 5000mAh battery"],
  ["smartphone", "Apple iPhone 15 Plus 128GB with 1 year replacement warranty"],
  ["smartphone", "Apple iPhone 15 Plus 128GB with replacement guarantee"],
  ["smartphone", "Apple iPhone 15 Plus 128GB with magnetic car mount holder"],
  ["laptop", "Apple MacBook Air 13-inch M3 16GB RAM 256GB SSD with 35W power adapter"],
  ["laptop", "HP Pavilion 14 Backlit Keyboard 16GB RAM 512GB SSD"],
  ["laptop", "Apple MacBook Air M3 16GB RAM 256GB SSD with laptop stand"],
  ["headphones", "Sony WH-1000XM5 Wireless Noise Cancelling Headphones with carrying case"],
  ["headphones", "Apple AirPods Pro 2 with MagSafe charging case"],
  ["headphones", "Apple AirPods Pro 2 includes charging case and cable"],
  ["smartwatch", "Apple Watch Series 9 GPS 45mm Midnight Aluminum Case with Midnight Sport Band"],
  ["smartwatch", "Samsung Galaxy Watch 6 44mm with silicone strap"],
  ["tablet", "Samsung Galaxy Tab S9 FE 128GB with S Pen"],
  ["tablet", "Apple iPad Air M2 11-inch 128GB includes charger"],
  ["tablet", "Apple iPad Air M2 128GB includes adjustable tablet stand"],
  ["monitor", "Dell P2422H 24-inch FHD Monitor with adjustable stand"],
  ["monitor", "LG UltraGear 27GP850 27-inch IPS Monitor Height Adjustable Stand"],
];

for (const [category, title] of genuineProducts) {
  test(`keeps the primary ${category} listing: ${title}`, () => {
    assert.equal(isWholeProductListing(title, category), true);
  });
}

const accessories = [
  ["smartphone", "Compatible for Apple iPhone 15 Plus LCD Display Touch Screen Digitizer Frame Assembly"],
  ["smartphone", "iPhone 14 Plus Cover Case Scratch Resistant Transparent"],
  ["smartphone", "Apple iPhone 15 Plus Case Clear with MagSafe"],
  ["smartphone", "Apple iPhone 15 Plus Display Replacement Without Frame"],
  ["smartphone", "Genuine Compatible with Apple iPhone 15 Plus OLED Screen Assembly"],
  ["smartphone", "Apple iPhone 15 Plus Camera Lens Protector"],
  ["smartphone", "For Apple iPhone 15 Plus Fast Charger"],
  ["smartphone", "Apple iPhone 15 Plus USB-C cable with charging adapter"],
  ["smartphone", "Apple iPhone 15 Plus Battery Only"],
  ["smartphone", "Apple iPhone 15 Plus Back Panel Housing"],
  ["smartphone", "Apple iPhone 15 Plus Magnetic Car Mount Holder"],
  ["smartphone", "iPhone 15 Plus LCD Display"],
  ["smartphone", "Apple iPhone 15 Plus OLED Screen"],
  ["smartphone", "Apple iPhone 15 Plus Display"],
  ["laptop", "Apple MacBook Air M3 Keyboard Replacement"],
  ["laptop", "Apple MacBook Air M3 Hard Shell Case"],
  ["laptop", "Dell XPS 13 Battery Replacement"],
  ["laptop", "Dell XPS 13 Charger 65W with cable"],
  ["laptop", "Apple MacBook Air M3 Adjustable Laptop Stand"],
  ["laptop", "Dell XPS 13 LCD Display"],
  ["headphones", "Sony WH-1000XM5 Replacement Ear Pads"],
  ["headphones", "Sony WH-1000XM5 Carrying Case with shoulder strap"],
  ["headphones", "Apple AirPods Pro 2 Charging Case Only"],
  ["headphones", "Apple AirPods Pro 2 Charging Case with USB-C cable"],
  ["smartwatch", "Apple Watch Series 9 Silicone Watch Strap"],
  ["smartwatch", "Samsung Galaxy Watch 6 Charging Dock"],
  ["tablet", "Samsung Galaxy Tab S9 FE Keyboard Cover"],
  ["tablet", "Apple iPad Air M2 Stylus Pen"],
  ["tablet", "Apple iPad Air M2 Adjustable Tablet Stand"],
  ["tablet", "Samsung Galaxy Tab S9 OLED Display"],
  ["monitor", "LG UltraGear 27GP850 Monitor Stand Only"],
  ["monitor", "Dell P2422H Monitor Arm with desk clamp"],
];

for (const [category, title] of accessories) {
  test(`rejects an accessory or part named after the ${category}: ${title}`, () => {
    assert.equal(isWholeProductListing(title, category), false);
  });
}

test("missing, blank or unsupported product information is not qualified", () => {
  for (const title of [undefined, null, "", " ", 123]) assert.equal(isWholeProductListing(title, "smartphone"), false);
  assert.equal(isWholeProductListing("Apple iPhone 15 Plus", "other"), false);
});
