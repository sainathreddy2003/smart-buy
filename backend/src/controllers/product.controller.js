import { Product, CATEGORIES } from "../models/Product.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { comparePrices, getPriceHistory } from "../services/price.service.js";
import { buildComparison, pickBestChoice } from "../utils/comparison.js";

const SORT_MAP = {
  "price-asc": { bestPrice: 1 },
  "price-desc": { bestPrice: -1 },
  "rating-desc": { rating: -1 },
  newest: { releaseYear: -1, createdAt: -1 },
};

export const listProducts = asyncHandler(async (req, res) => {
  const { category, brand, minPrice, maxPrice, search, sort, page = 1, limit = 12 } = req.query;

  const filter = {};
  if (category) filter.category = category;
  if (brand) filter.brand = brand;
  if (minPrice || maxPrice) {
    filter.bestPrice = {};
    if (minPrice) filter.bestPrice.$gte = Number(minPrice);
    if (maxPrice) filter.bestPrice.$lte = Number(maxPrice);
  }
  if (search) filter.$text = { $search: search };

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(48, Math.max(1, Number(limit)));

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(SORT_MAP[sort] || { createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    products,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound("Product not found");
  res.json({ success: true, product });
});

export const getCategories = asyncHandler(async (req, res) => {
  const counts = await Product.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]);
  const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  res.json({
    success: true,
    categories: CATEGORIES.map((category) => ({ category, count: countMap[category] || 0 })),
  });
});

export const getProductPrices = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound("Product not found");

  const sellers = comparePrices(product);
  res.json({
    success: true,
    productId: product._id,
    bestPrice: sellers[0]?.price ?? null,
    sellers,
  });
});

export const getProductPriceHistory = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound("Product not found");

  const history = await getPriceHistory(product._id);
  res.json({ success: true, productId: product._id, ...history });
});

export const compareProducts = asyncHandler(async (req, res) => {
  const { productIds } = req.body;
  const products = await Product.find({ _id: { $in: productIds } });

  if (products.length < 2) {
    throw ApiError.badRequest("Need at least 2 valid products to compare");
  }

  // Preserve the order the client asked for.
  const ordered = productIds.map((id) => products.find((p) => p._id.toString() === id)?.toJSON()).filter(Boolean);

  const comparison = buildComparison(ordered);
  const bestChoice = pickBestChoice(ordered, comparison);

  res.json({
    success: true,
    products: ordered,
    comparison,
    bestChoice,
  });
});

export const getRelatedProducts = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound("Product not found");

  const related = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
  })
    .limit(4)
    .sort({ rating: -1 });

  res.json({ success: true, products: related });
});
