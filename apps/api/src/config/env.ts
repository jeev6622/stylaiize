import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import dotenv from "dotenv";

/**
 * Load `apps/api/.env` explicitly instead of relying on `process.cwd()`.
 *
 * `dotenv/config` resolves `.env` from the current working directory, which is
 * fragile under the npm workspace runner. These candidates always resolve to
 * the API package root — both from `src/config` (tsx dev) and `dist/config`
 * (compiled build) — with a cwd fallback for unusual launch setups.
 * dotenv never overrides an already-set variable, so the first file wins.
 */
for (const candidate of [
  resolve(__dirname, "../../.env"),
  resolve(process.cwd(), ".env"),
]) {
  if (existsSync(candidate)) dotenv.config({ path: candidate });
}

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const intFromString = (defaultValue: number) =>
  z
    .string()
    .default(String(defaultValue))
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int());

/** Optional URL that must be empty or an absolute http(s) endpoint. */
const optionalHttpUrl = z
  .string()
  .optional()
  .default("")
  .transform((v) => v.trim())
  .refine(
    (v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v),
    { message: "must be an absolute http(s) URL" },
  );

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: intFromString(4000),
  API_PUBLIC_URL: z.string().default("http://localhost:4000"),
  WEB_PUBLIC_URL: z.string().default("http://localhost:3000"),

  // MongoDB (empty => in-memory demo mode)
  MONGODB_URI: z.string().optional().default(""),
  MONGODB_DB_NAME: z.string().default("stylaiize"),

  // JWT
  JWT_ACCESS_SECRET: z.string().default("stylaiize-dev-access-secret"),
  JWT_REFRESH_SECRET: z.string().default("stylaiize-dev-refresh-secret"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  JWT_ISSUER: z.string().default("stylaiize"),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_CALLBACK_URL: z.string().default("http://localhost:4000/api/v1/auth/google/callback"),

  // SMTP
  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: intFromString(587),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().default("StylAIze <no-reply@stylaiize.app>"),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),

  // AI providers
  /**
   * Pin the AI provider. Empty = auto-select the first configured real provider.
   * Validated as an enum so a typo fails at boot instead of being ignored.
   */
  AI_PROVIDER: z
    .enum(["gemini", "openai", "qwen", "llama", "gemma", "mock"])
    .or(z.literal(""))
    .default(""),
  /**
   * Max base64 chars for one uploaded image. Base64 is ~4/3 of the raw bytes,
   * so the default is a ~2 MB image. Four images per chat message must still
   * fit inside the JSON body limit (see JSON_BODY_LIMIT in app.ts).
   */
  AI_MAX_IMAGE_CHARS: intFromString(2_700_000),

  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-3-flash-preview"),

  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("gpt-4o"),

  QWEN_API_KEY: z.string().optional().default(""),
  QWEN_MODEL: z.string().default("qwen2.5-vl-72b-instruct"),
  QWEN_BASE_URL: z
    .string()
    .default("https://dashscope.aliyuncs.com/compatible-mode/v1"),

  LLAMA_BASE_URL: z.string().optional().default(""),
  LLAMA_API_KEY: z.string().optional().default(""),
  LLAMA_MODEL: z.string().default("llama-3.2-90b-vision"),

  GEMMA_BASE_URL: z.string().optional().default(""),
  GEMMA_API_KEY: z.string().optional().default(""),
  GEMMA_MODEL: z.string().default("gemma-3-27b-it"),

  // Virtual try-on
  /**
   * Provider pin. "auto" (or empty) selects the first configured provider
   * (IDM-VTON, then CatVTON). An explicit pin is honoured first; if that
   * provider is not configured the fallback provider is used when available.
   */
  VTON_PROVIDER: z
    .enum(["idm_vton", "catvton", "auto"])
    .or(z.literal(""))
    .default("auto"),
  /**
   * Base URL of the StylAIze IDM-VTON FastAPI service, e.g.
   * http://gpu-host:8000. Preferred over the legacy synchronous VTON_API_URL
   * because it exposes real job progress.
   */
  VTON_SERVICE_URL: optionalHttpUrl,
  VTON_SERVICE_API_KEY: z.string().optional().default(""),
  /** Legacy synchronous IDM-VTON POST endpoint. */
  VTON_API_URL: optionalHttpUrl,
  VTON_API_KEY: z.string().optional().default(""),
  VTON_FALLBACK_PROVIDER: z
    .enum(["idm_vton", "catvton", "none"])
    .or(z.literal(""))
    .default("catvton"),
  VTON_CATVTON_API_URL: optionalHttpUrl,
  VTON_CATVTON_API_KEY: z.string().optional().default(""),
  /** Optional separate readiness endpoints (e.g. GET /health on the GPU box). */
  VTON_HEALTH_URL: optionalHttpUrl,
  VTON_CATVTON_HEALTH_URL: optionalHttpUrl,
  /** Inference request timeout (must be longer than a cold GPU start). */
  VTON_TIMEOUT_MS: intFromString(120_000),
  VTON_HEALTH_TIMEOUT_MS: intFromString(8_000),
  /** Control-plane requests to the async inference service. */
  VTON_SERVICE_REQUEST_TIMEOUT_MS: intFromString(30_000),
  /** How often the API polls the inference service for real job progress. */
  VTON_JOB_POLL_MS: intFromString(1_000),
  /** Maximum wall-clock time for one async try-on job, including cold start. */
  VTON_JOB_MAX_MS: intFromString(600_000),
  /** Maximum decoded bytes accepted for each uploaded image. */
  VTON_MAX_IMAGE_BYTES: intFromString(8 * 1024 * 1024),

  // Push notifications (Firebase Cloud Messaging)
  FCM_PROJECT_ID: z.string().optional().default(""),
  FCM_PRIVATE_KEY: z.string().optional().default(""),
  FCM_CLIENT_EMAIL: z.string().optional().default(""),
  FCM_SERVER_KEY: z.string().optional().default(""),

  // Shopping engine
  SHOPPING_ENABLED: booleanFromString,
  SHOPPING_API_URL: z.string().optional().default(""),
  SHOPPING_API_KEY: z.string().optional().default(""),
  /**
   * Pin the shopping provider. Empty = use the live catalog when it is
   * configured, otherwise fall back to the demo catalog (clearly disclosed in
   * the UI). "real" refuses to fall back, so a missing key surfaces as a
   * SHOPPING_NOT_CONFIGURED error instead of fake products.
   */
  SHOPPING_PROVIDER: z.enum(["real", "mock"]).or(z.literal("")).default(""),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: intFromString(60000),
  RATE_LIMIT_MAX: intFromString(120),
  TRUST_PROXY: intFromString(1),

  // Features
  ALLOW_DEMO_MODE: booleanFromString,
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

/** Fail fast in production if well-known non-production values are in use. */
function assertProductionSafety(value: Env): void {
  const devAccessSecret = "stylaiize-dev-access-secret";
  const devRefreshSecret = "stylaiize-dev-refresh-secret";
  if (
    value.NODE_ENV === "production" &&
    (value.JWT_ACCESS_SECRET === devAccessSecret ||
      value.JWT_REFRESH_SECRET === devRefreshSecret)
  ) {
    throw new Error(
      "Invalid environment configuration: default development JWT secrets are not allowed in production. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET.",
    );
  }
}

export const env: Env = (() => {
  const value = loadEnv();
  assertProductionSafety(value);
  return value;
})();

/** True when the app was booted in a non-production context with a demo data-set. */
export const isDevelopment = env.NODE_ENV !== "production";
