import dotenv from "dotenv";

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  clientUrl: process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173",
  mongoUri: required("MONGO_URI"),
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  },
  groq: {
    // Optional — the app must run (with deterministic fallbacks) when unset.
    apiKey: process.env.GROQ_API_KEY || null,
    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  },
  // RapidAPI powers retailer quotes, discovery fallbacks, and optional YouTube138.
  rapidApi: {
    key: process.env.RAPIDAPI_KEY || null,
    flipkartSearchConfig: process.env.FLIPKART_SEARCH_CONFIG || null,
  },
  // Primary discovery through SerpApi's Google Shopping engine.
  serpApi: {
    key: process.env.SERPAPI_KEY || null,
  },
  useMockData: process.env.USE_MOCK_DATA !== "false",
  // Only used if someone swaps in an official Google YouTube Data API v3 key
  // instead of RapidAPI's YouTube138. Neither is required.
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || null,
  },
};
