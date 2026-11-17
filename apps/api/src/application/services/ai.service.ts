/**
 * AI orchestration service (application layer).
 * Business logic lives here and stays completely provider-agnostic.
 * Swap providers via infrastructure/ai/factory.ts only.
 */
import {
  AI_SYSTEM_CONTEXT,
  type AIChatMessage,
  type AIImagePart,
  type AIProviderPort,
  type AIRequest,
  type AITask,
} from "@/infrastructure/ai/provider.interface";
import { resolveAIProvider, aiProviderStatus, describeProvider } from "@/infrastructure/ai/factory";
import { AIProviderError } from "@/infrastructure/ai/errors";
import { extractJson } from "@/infrastructure/ai/http";
import { logError, logWarn } from "@/utils/logger";

export interface ChatInput {
  messages: AIChatMessage[];
  images?: AIImagePart[];
}

export interface StructuredPrompt {
  task: AITask;
  instruction: string;
  /** Human-readable context the model should reason about. */
  context?: string;
  /** A JSON template/schema the model must follow. */
  outputSchema: Record<string, unknown>;
  images?: AIImagePart[];
}

/** Retry budget for transient provider failures (429/5xx/network). */
const AI_RETRY_ATTEMPTS = 2;
const AI_RETRY_BASE_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True for errors worth retrying: rate limits, upstream 5xx, and network faults. */
function isTransient(err: unknown): boolean {
  if (err instanceof AIProviderError) {
    return /\b(429|500|502|503|504)\b|timed out|Network failure|ECONNRESET|ETIMEDOUT/i.test(
      err.message,
    );
  }
  return err instanceof Error && /ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed/i.test(err.message);
}

/**
 * Runs `attempt` and retries transient provider failures with linear backoff.
 * Auth/validation failures surface immediately — retrying them never helps.
 */
async function withRetry<T>(attempt: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (err) {
      if (i >= AI_RETRY_ATTEMPTS || !isTransient(err)) throw err;
      logWarn("AI request failed, retrying", {
        attempt: i + 1,
        reason: err instanceof Error ? err.message : String(err),
      });
      await delay(AI_RETRY_BASE_DELAY_MS * (i + 1));
    }
  }
}

export class AIService {
  /**
   * The provider is resolved lazily on first use. If no AI provider has usable
   * credentials the app must still boot (auth, wardrobe, health, ...), and only
   * the AI-backed endpoints fail with a clear AI_NOT_CONFIGURED error.
   */
  private cachedProvider: AIProviderPort | null = null;

  constructor(private readonly override?: AIProviderPort) {}

  private provider(): AIProviderPort {
    if (this.override) return this.override;
    if (!this.cachedProvider) this.cachedProvider = resolveAIProvider();
    return this.cachedProvider;
  }

  get activeProvider(): AIProviderPort {
    return this.provider();
  }

  /** Free-form stylist conversation with optional image context. */
  async chat(input: ChatInput): Promise<{ text: string; imagesAnalyzed: number }> {
    const messages: AIChatMessage[] = [
      { role: "system", content: AI_SYSTEM_CONTEXT },
      ...input.messages,
    ];
    const res = await withRetry(() =>
      this.provider().chat({
        task: "chat",
        messages,
        images: input.images,
        temperature: 0.7,
      }),
    );
    return { text: res.text.trim(), imagesAnalyzed: input.images?.length ?? 0 };
  }

  /**
   * Streams a stylist reply token-by-token. Retries only happen before the
   * first token is emitted: once the client has seen output, replaying a failed
   * request would duplicate text in the UI.
   */
  async *chatStream(
    input: ChatInput,
  ): AsyncGenerator<{ delta: string; fullText: string }, void, unknown> {
    const messages: AIChatMessage[] = [
      { role: "system", content: AI_SYSTEM_CONTEXT },
      ...input.messages,
    ];
    const provider = this.provider();
    const request: AIRequest = {
      task: "chat",
      messages,
      images: input.images,
      temperature: 0.7,
    };

    let emitted = false;
    let fullText = "";

    for (let attempt = 0; ; attempt++) {
      try {
        for await (const delta of provider.stream(request)) {
          emitted = true;
          fullText += delta;
          yield { delta, fullText };
        }
        return;
      } catch (err) {
        if (emitted || attempt >= AI_RETRY_ATTEMPTS) throw err;
        logWarn("AI chat stream failed before any output, retrying", {
          attempt: attempt + 1,
          reason: err instanceof Error ? err.message : String(err),
        });
        await delay(AI_RETRY_BASE_DELAY_MS * (attempt + 1));
      }
    }
  }

  /**
   * Ask the model to produce strict JSON following `outputSchema`.
   * Used by every structured feature (event detection, outfit plans, ...).
   */
  async generateJson<T>(prompt: StructuredPrompt): Promise<T> {
    const schemaText = JSON.stringify(prompt.outputSchema, null, 2);
    const instruction = [
      prompt.instruction,
      prompt.context ? `\n\nContext:\n${prompt.context}` : "",
      `\n\nOutput ONLY a single valid JSON object matching this schema:\n${schemaText}`,
      "\nDo not include markdown fences, comments, or extra text.",
    ].join("");

    const messages: AIChatMessage[] = [
      { role: "system", content: AI_SYSTEM_CONTEXT },
      { role: "user", content: instruction },
    ];

    const request: AIRequest = {
      task: prompt.task,
      messages,
      images: prompt.images,
      temperature: 0.4,
      maxOutputTokens: 4096,
      json: true,
    };

    const res = await withRetry(() => this.provider().chat(request));
    const parsed = extractJson(res.text) as T;
    if (Object.keys(parsed ?? {}).length === 0) {
      logError("AI returned non-JSON output for structured task", { task: prompt.task });
      throw new Error(`AI provider returned invalid JSON for task "${prompt.task}".`);
    }
    return parsed;
  }

  async health(): Promise<{ name: string; isConfigured: boolean; description: string }> {
    const status = aiProviderStatus();
    return {
      name: status.active,
      isConfigured: status.configured,
      description: describeProvider(status.active),
    };
  }
}

export const aiService = new AIService();
