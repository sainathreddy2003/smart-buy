import dotenv from "dotenv";
dotenv.config();
const key = process.env.RAPIDAPI_KEY;
const host = "ecommerce-api3.p.rapidapi.com";

async function fetchAll(path) {
  const res = await fetch(`https://${host}${path}`, {
    headers: { "x-rapidapi-key": key, "x-rapidapi-host": host },
  });
  return res.json();
}

const mobiles = await fetchAll("/mobiles");
const laptops = await fetchAll("/laptops");

console.log("=== MOBILES sample (every 50th) ===");
for (let i = 0; i < mobiles.length; i += 50) {
  console.log(i, "|", mobiles[i].Brand, "|", mobiles[i].Price);
  console.log("   ", mobiles[i].Description);
}

console.log("\n=== LAPTOPS sample (every 50th) ===");
for (let i = 0; i < laptops.length; i += 50) {
  console.log(i, "|", laptops[i].Brand, "|", laptops[i].Price);
  console.log("   ", laptops[i].Description);
}

import fs from "fs";
fs.writeFileSync("/tmp/mobiles_raw.json", JSON.stringify(mobiles));
fs.writeFileSync("/tmp/laptops_raw.json", JSON.stringify(laptops));
console.log("\nSaved raw data to /tmp for reuse.");
