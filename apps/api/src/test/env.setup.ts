/**
 * Test environment isolation.
 *
 * `apps/api/.env` may contain real provider keys for local development. Tests
 * must be deterministic and must never depend on (or spend) a developer's live
 * credentials, so provider keys are cleared from `process.env` before any
 * module imports the parsed `env` object. dotenv does not override variables
 * that are already set, so these empty values win over the .env file.
 */
process.env.AI_PROVIDER = "";
process.env.GEMINI_API_KEY = "";
process.env.OPENAI_API_KEY = "";
process.env.QWEN_API_KEY = "";
process.env.LLAMA_BASE_URL = "";
process.env.LLAMA_API_KEY = "";
process.env.GEMMA_BASE_URL = "";
process.env.GEMMA_API_KEY = "";
process.env.VTON_PROVIDER = "auto";
process.env.VTON_API_URL = "";
process.env.VTON_API_KEY = "";
process.env.VTON_FALLBACK_PROVIDER = "catvton";
process.env.VTON_CATVTON_API_URL = "";
process.env.VTON_CATVTON_API_KEY = "";
process.env.VTON_HEALTH_URL = "";
process.env.VTON_CATVTON_HEALTH_URL = "";
process.env.OUTFIT_IMAGE_ENABLED = "false";
process.env.OUTFIT_IMAGE_API_URL = "";
process.env.OUTFIT_IMAGE_API_KEY = "";
process.env.OUTFIT_IMAGE_LICENSE = "";
process.env.SMTP_HOST = "";
process.env.SMTP_PORT = "587";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";
process.env.SMTP_FROM = "StylAIze Tests <no-reply@example.com>";
process.env.SMS_API_URL = "";
process.env.SMS_API_KEY = "";
process.env.SMS_API_PAYLOAD_TEMPLATE = "";
process.env.SMS_API_HEADERS_JSON = "";
process.env.ALLOW_DEMO_MODE = "false";
process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";
