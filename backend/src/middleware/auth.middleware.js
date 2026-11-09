import { ApiError } from "../utils/ApiError.js";
import { verifyAccessToken } from "../services/token.service.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing access token");
  }

  const token = header.slice("Bearer ".length);
  const payload = verifyAccessToken(token);

  const user = await User.findById(payload.sub).select("_id name email");
  if (!user) {
    throw ApiError.unauthorized("User no longer exists");
  }

  req.user = user;
  next();
});

// Attaches req.user if a valid token is present, but never rejects the request.
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    const user = await User.findById(payload.sub).select("_id name email");
    if (user) req.user = user;
  } catch {
    // ignore invalid/expired tokens on optional routes
  }
  next();
});
