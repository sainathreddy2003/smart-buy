import { ProductProvider } from "./ProductProvider.js";
import { searchAmazonProducts } from "./AmazonRetailProvider.js";

/** Exact-model discovery on Amazon India, used only after Shopping misses. */
export class AmazonProductProvider extends ProductProvider {
  constructor() {
    super();
    this.host = "real-time-amazon-data.p.rapidapi.com";
  }

  search(query, options = {}) {
    return searchAmazonProducts(query, options);
  }
}
