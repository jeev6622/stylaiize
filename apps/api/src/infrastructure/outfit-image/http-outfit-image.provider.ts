import { z } from "zod";
import { BUILD_LOOK_AUDIENCES } from "@stylaiize/shared";
import { OutfitImageProviderError } from "./errors";
import type {
  OutfitImageGeneration,
  OutfitImageGenerationRequest,
  OutfitImageProviderPort,
} from "./outfit-image.interface";

export interface HttpOutfitImageProviderConfig {
  id: string;
  endpoint: string;
  apiKey: string;
  license: string;
  timeoutMs: number;
}

const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((v) => /^https:\/\//i.test(v), "must be an https URL");

const configSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    endpoint: httpsUrl,
    apiKey: z.string().trim().min(1).max(500),
    license: z.string().trim().min(1).max(200),
    timeoutMs: z.number().int().positive().max(600_000),
  })
  .strict();

const responseSchema = z
  .object({
    imageUrl: httpsUrl,
    provider: z.string().trim().min(1).max(120),
  })
  .strict();

export class HttpOutfitImageProvider implements OutfitImageProviderPort {
  readonly id: string;
  readonly isConfigured = true;
  readonly supportedAudiences = BUILD_LOOK_AUDIENCES;
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly license: string;
  private readonly timeoutMs: number;

  constructor(config: HttpOutfitImageProviderConfig) {
    const parsed = configSchema.safeParse(config);
    if (!parsed.success) {
      throw new OutfitImageProviderError(config.id, "invalid provider configuration");
    }
    this.id = parsed.data.id;
    this.endpoint = parsed.data.endpoint;
    this.apiKey = parsed.data.apiKey;
    this.license = parsed.data.license;
    this.timeoutMs = parsed.data.timeoutMs;
  }

  async generate(request: OutfitImageGenerationRequest): Promise<OutfitImageGeneration> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ prompt: request.prompt, audience: request.audience }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new OutfitImageProviderError(this.id, `HTTP ${response.status}`);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new OutfitImageProviderError(this.id, "response was not valid JSON");
      }

      const parsed = responseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new OutfitImageProviderError(
          this.id,
          "response must contain a provider name and an HTTPS imageUrl",
        );
      }

      return {
        imageUrl: parsed.data.imageUrl,
        provider: parsed.data.provider,
        license: this.license,
      };
    } catch (err) {
      if (err instanceof OutfitImageProviderError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new OutfitImageProviderError(this.id, `request timed out after ${this.timeoutMs}ms`);
      }
      throw new OutfitImageProviderError(
        this.id,
        `network failure: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
