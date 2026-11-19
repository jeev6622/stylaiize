import path from "node:path";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import type { Express } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "@/config/env";
import { apiRateLimiter } from "@/api/middleware/rate-limit";
import { errorHandler, notFoundHandler } from "@/api/middleware/error.middleware";
import { resolveCollageCacheDir } from "@/infrastructure/outfit-image/factory";
import { mountV1Router } from "@/api/routes/v1";

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");

  const allowedOrigins = [env.WEB_PUBLIC_URL].filter(Boolean);
  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow requests without an Origin header (curl, health checks, server-to-server).
        if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV !== "production") {
          cb(null, true);
          return;
        }
        cb(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use(helmet());
  app.use(cookieParser());
  // Must be large enough for the worst legitimate payload:
  //  - chat: several images at AI_MAX_IMAGE_CHARS base64 chars each
  //  - virtual try-on: two images at VTON_MAX_IMAGE_BYTES (base64 is ~4/3)
  // plus JSON overhead.
  const aiBodyLimitMb = Math.ceil((4 * env.AI_MAX_IMAGE_CHARS) / 1_000_000);
  const vtonBodyLimitMb = Math.ceil(
    (2 * ((env.VTON_MAX_IMAGE_BYTES * 4) / 3 + 1024)) / 1_000_000,
  );
  const JSON_BODY_LIMIT = `${Math.max(aiBodyLimitMb, vtonBodyLimitMb)}mb`;
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

  if (env.NODE_ENV !== "test") {
    app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  }

  // Serve local uploads in demo/local-storage mode.
  app.use(
    "/uploads",
    express.static(path.resolve(process.cwd(), "uploads"), { maxAge: "7d" }),
  );
  app.use(
    "/generated/outfit-images",
    express.static(resolveCollageCacheDir(), {
      maxAge: "7d",
      setHeaders: (res) => {
        res.setHeader("Content-Type", "image/webp");
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );

  app.use(apiRateLimiter);

  mountV1Router(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
