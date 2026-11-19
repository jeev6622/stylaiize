/**
 * Feature/service availability flags.
 * External services can be absent. Demo implementations require an explicit
 * opt-in; production paths report unavailable instead of faking delivery.
 */
import { env } from "./env";

export const isMongoConfigured = env.MONGODB_URI.trim().length > 0;

export const isGeminiConfigured = env.GEMINI_API_KEY.trim().length > 0;
export const isOpenAIConfigured = env.OPENAI_API_KEY.trim().length > 0;
export const isQwenConfigured = env.QWEN_API_KEY.trim().length > 0;
export const isLlamaConfigured =
  env.LLAMA_BASE_URL.trim().length > 0 || env.LLAMA_API_KEY.trim().length > 0;
export const isGemmaConfigured =
  env.GEMMA_BASE_URL.trim().length > 0 || env.GEMMA_API_KEY.trim().length > 0;

export const isGoogleAuthConfigured =
  env.GOOGLE_CLIENT_ID.trim().length > 0 &&
  env.GOOGLE_CLIENT_SECRET.trim().length > 0;

export const isSmtpConfigured = env.SMTP_HOST.trim().length > 0;

export const isCloudinaryConfigured =
  env.CLOUDINARY_CLOUD_NAME.trim().length > 0 &&
  env.CLOUDINARY_API_KEY.trim().length > 0 &&
  env.CLOUDINARY_API_SECRET.trim().length > 0;

export const isVtonConfigured = env.VTON_API_URL.trim().length > 0;
export const isCatVtonConfigured = env.VTON_CATVTON_API_URL.trim().length > 0;

export const isFcmConfigured =
  env.FCM_SERVER_KEY.trim().length > 0;

export const isShoppingConfigured =
  env.SHOPPING_ENABLED && env.SHOPPING_API_URL.trim().length > 0;

export function isOutfitImageConfigured(): boolean {
  return (
    env.OUTFIT_IMAGE_ENABLED &&
    env.OUTFIT_IMAGE_API_URL.trim().length > 0 &&
    env.OUTFIT_IMAGE_API_KEY.trim().length > 0 &&
    env.OUTFIT_IMAGE_LICENSE.trim().length > 0
  );
}

/** When true, demo-mode fallbacks are permitted when services are missing. */
export const demoModeAllowed = env.ALLOW_DEMO_MODE;

/** Demo fallbacks require an explicit opt-in, except in automated tests. */
export function isDemoModeAllowed(): boolean {
  return env.ALLOW_DEMO_MODE || env.NODE_ENV === "test";
}
