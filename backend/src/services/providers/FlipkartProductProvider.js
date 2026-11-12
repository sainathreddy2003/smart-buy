import { ProductProvider } from "./ProductProvider.js";
import { searchFlipkartProducts } from "./FlipkartRetailProvider.js";

/** Uses the site's configured Flipkart endpoint; it never invents an endpoint. */
export class FlipkartProductProvider extends ProductProvider {
  constructor() {
    super();
    this.host = "configured-flipkart-model-search";
  }

  search(query, options = {}) {
    return searchFlipkartProducts(query, options);
  }
}
