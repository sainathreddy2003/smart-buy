import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, req, res, next) {
  let statusCode = err.isApiError ? err.statusCode : 500;
  let message = err.message || "Internal server error";
  let details = err.details;

  if (err.name === "ValidationError") {
    statusCode = 400;
  }
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `${field} already in use` : "Duplicate value";
  }
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Invalid or expired token";
  }

  if (statusCode >= 500) {
    console.error("[error]", err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    details,
    stack: env.nodeEnv === "development" ? err.stack : undefined,
  });
}
