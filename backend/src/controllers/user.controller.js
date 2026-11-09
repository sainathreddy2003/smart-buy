import { User } from "../models/User.js";
import { Product } from "../models/Product.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

export const getFavorites = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate("favorites");
  res.json({ success: true, favorites: user.favorites });
});

export const addFavorite = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId);
  if (!product) throw ApiError.notFound("Product not found");

  await User.updateOne({ _id: req.user._id }, { $addToSet: { favorites: product._id } });
  res.status(201).json({ success: true });
});

export const removeFavorite = asyncHandler(async (req, res) => {
  await User.updateOne(
    { _id: req.user._id },
    { $pull: { favorites: req.params.productId } }
  );
  res.json({ success: true });
});
