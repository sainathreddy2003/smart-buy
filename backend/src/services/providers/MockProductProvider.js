import { Product } from "../../models/Product.js";
import { ProductProvider } from "./ProductProvider.js";

/**
 * The demo/offline provider — searches the seeded MongoDB catalog. This is
 * what powers the app whenever no live product-search API key is configured
 * (the default), and it goes through the exact same normalized-product shape
 * as a live provider would, so the rest of the pipeline can't tell the
 * difference.
 */
export class MockProductProvider extends ProductProvider {
  async search(query, { category, limit = 24 } = {}) {
    const filter = {};
    if (category) filter.category = category;
    if (query) filter.$text = { $search: query };

    const products = await Product.find(filter).limit(limit);
    return products.map((p) => ({
      name: p.name,
      brand: p.brand,
      category: p.category,
      sellers: p.sellers,
      image: p.images?.[0],
      rating: p.rating,
      source: "mock",
      sourceProductId: p._id.toString(),
    }));
  }
}
