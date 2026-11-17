import { AppError } from "@/utils/errors";

export class AIProviderError extends AppError {
  constructor(provider: string, detail: string) {
    super(
      502,
      `AI provider "${provider}" failed: ${detail}`,
      { code: "AI_PROVIDER_ERROR" },
    );
  }
}

export class AINotConfiguredError extends AppError {
  constructor(provider: string) {
    super(
      503,
      `AI provider "${provider}" is not configured. Add its API key to the API .env file, or set AI_PROVIDER=mock to deliberately run on demo data.`,
      { code: "AI_NOT_CONFIGURED" },
    );
  }
}
