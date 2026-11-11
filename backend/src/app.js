import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import recommendationRoutes from "./routes/recommendation.routes.js";
import userRoutes from "./routes/user.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import historyRoutes from "./routes/history.routes.js";
import youtubeRoutes from "./routes/youtube.routes.js";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware.js";

const frontendDist = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
const frontendIndex = join(frontendDist, "index.html");

export function createApp() {
  const app = express();
  const serveFrontend = env.nodeEnv === "production" && existsSync(frontendIndex);

  if (process.env.RENDER === "true" || process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
  }

  app.use(helmet({
    crossOriginResourcePolicy: false,
    ...(serveFrontend && {
      contentSecurityPolicy: {
        directives: { imgSrc: ["'self'", "data:", "https:"] },
      },
    }),
  }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          origin === env.clientUrl ||
          /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        ) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  if (env.nodeEnv !== "test") {
    app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
  }

  app.get("/api/health", (req, res) => {
    res.json({ success: true, service: "smartbuy-ai-api", status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/recommendations", recommendationRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/history", historyRoutes);
  app.use("/api/youtube", youtubeRoutes);

  if (serveFrontend) {
    app.use(express.static(frontendDist));
    app.get("/{*path}", (req, res, next) => {
      if (/^\/api(?:\/|$)/i.test(req.path) || extname(req.path) || !req.accepts("html")) {
        return next();
      }
      return res.sendFile(frontendIndex);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
