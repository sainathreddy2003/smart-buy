import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  getRefreshCookie,
} from "../services/token.service.js";

async function issueSession(user, res) {
  const accessToken = signAccessToken(user._id.toString());
  const refreshToken = signRefreshToken(user._id.toString(), user.tokenVersion);
  setRefreshCookie(res, refreshToken);
  return accessToken;
}

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict("An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash });

  const accessToken = await issueSession(user, res);
  res.status(201).json({ success: true, accessToken, user: user.toPublicJSON() });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) throw ApiError.unauthorized("Invalid email or password");

  const valid = await user.comparePassword(password);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  const accessToken = await issueSession(user, res);
  res.json({ success: true, accessToken, user: user.toPublicJSON() });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = getRefreshCookie(req);
  if (!token) throw ApiError.unauthorized("Missing refresh token");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.v) {
    throw ApiError.unauthorized("Refresh token no longer valid");
  }

  const accessToken = await issueSession(user, res);
  res.json({ success: true, accessToken, user: user.toPublicJSON() });
});

export const logout = asyncHandler(async (req, res) => {
  clearRefreshCookie(res);
  res.json({ success: true });
});

export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, user: user.toPublicJSON() });
});
