/**
 * The contract every product-search provider implements. Keeping this as a
 * thin, explicit interface (rather than calling a specific provider directly
 * from the search service) is what lets the app swap MockProductProvider for
 * GoogleShoppingProvider — or add a third provider later — without touching
 * anything downstream (normalization, scoring, the API layer).
 *
 * @typedef {Object} ProviderProduct
 * @property {string} name
 * @property {string} brand
 * @property {string} category
 * @property {{platform: string, price: number, currency: string, url: string, availability: boolean}[]} sellers
 * @property {string} [image]
 * @property {number} [rating]
 * @property {string} source - which provider produced this record
 * @property {string} [sourceProductId]
 * @property {string} [shoppingHistoryId] Product ID issued by Real-Time Product Search.
 *
 * @interface ProductProvider
 * @method search(query: string, opts: {category?: string, limit?: number}) => Promise<ProviderProduct[]>
 */

export class ProductProvider {
  /**
   * @param {string} query
   * @param {{category?: string, limit?: number}} [opts]
   * @returns {Promise<import("./ProductProvider.js").ProviderProduct[]>}
   */
  // eslint-disable-next-line no-unused-vars
  async search(query, opts = {}) {
    throw new Error("ProductProvider.search must be implemented by a subclass");
  }
}
