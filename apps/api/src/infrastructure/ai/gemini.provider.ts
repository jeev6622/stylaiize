import { env } from "@/config/env";
import { isGeminiConfigured } from "@/config/features";
import { extractJson, parseSseData, AI_REQUEST_TIMEOUT_MS } from "./http";
import { AIProviderError, AINotConfiguredError } from "./errors";
import type { AIProviderPort, AIRequest, AIResponse } from "./provider.interface";

interface GeminiContentPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiContents {
  role: "user" | "model";
  parts: GeminiContentPart[];
}

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Google Gemini provider (default primary AI).
 * Implements the REST generateContent API so no SDK is required.
 */
export class GeminiProvider implements AIProviderPort {
  readonly name = "gemini" as const;
  readonly description = "Google Gemini (multimodal)";

  get isConfigured(): boolean {
    return isGeminiConfigured;
  }

  /**
   * Shared request construction. Images are attached only to the newest user
   * turn — sending them with every history entry would resend the same pixels
   * once per message.
   */
  private buildRequest(
    req: AIRequest,
    method: "generateContent" | "streamGenerateContent",
  ): { url: string; body: Record<string, unknown>; contents: GeminiContents[] } {
    const url = `${BASE_URL}/${env.GEMINI_MODEL}:${method}`;

    const nonSystem = req.messages.filter((m) => m.role !== "system");
    const imageTargetIndex = nonSystem.reduce(
      (acc, m, i) => (m.role === "user" ? i : acc),
      nonSystem.length - 1,
    );

    const contents: GeminiContents[] = nonSystem.map((m, i) => {
      const parts: GeminiContentPart[] = [{ text: m.content }];
      if (i === imageTargetIndex) {
        for (const img of req.images ?? []) {
          parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
        }
      }
      return { role: m.role === "assistant" ? "model" : "user", parts };
    });

    const systemInstruction = req.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");

    const generationConfig: Record<string, unknown> = {
      temperature: req.temperature ?? 0.7,
      maxOutputTokens: req.maxOutputTokens ?? 2048,
    };
    if (req.json) generationConfig.responseMimeType = "application/json";

    const body: Record<string, unknown> = { contents, generationConfig };
    if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };

    return { url, body, contents };
  }

  async chat(req: AIRequest): Promise<AIResponse> {
    // Guard before building the request: without a key Gemini answers 400/403,
    // which would surface as a misleading 502 AI_PROVIDER_ERROR.
    if (!this.isConfigured) throw new AINotConfiguredError(this.name);

    const { url, body, contents } = this.buildRequest(req, "generateContent");

    // Gemini rejects a request with an empty `contents` array.
    if (contents.length === 0) {
      throw new AIProviderError("gemini", "Request contained no user or model messages.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new AIProviderError("gemini", `HTTP ${res.status}: ${detail.slice(0, 500)}`);
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      return {
        text,
        usage: {
          inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
        },
        raw: json,
      };
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIProviderError("gemini", "Request timed out.");
      }
      throw new AIProviderError(
        "gemini",
        `Network failure: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /** True streaming via `:streamGenerateContent?alt=sse`. */
  async *stream(req: AIRequest): AsyncGenerator<string, void, unknown> {
    if (!this.isConfigured) throw new AINotConfiguredError(this.name);

    const { url, body, contents } = this.buildRequest(req, "streamGenerateContent");
    if (contents.length === 0) {
      throw new AIProviderError("gemini", "Request contained no user or model messages.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
    const streamUrl = `${url}?alt=sse`;

    let res: Response;
    try {
      res = await fetch(streamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      throw err instanceof AIProviderError
        ? err
        : new AIProviderError(
            "gemini",
            `Stream connect failed: ${err instanceof Error ? err.message : String(err)}`,
          );
    }

    if (!res.ok) {
      clearTimeout(timeout);
      const detail = await res.text().catch(() => "");
      throw new AIProviderError("gemini", `HTTP ${res.status}: ${detail.slice(0, 500)}`);
    }
    if (!res.body) {
      clearTimeout(timeout);
      throw new AIProviderError("gemini", "Streaming response had no body.");
    }

    try {
      for await (const payload of parseSseData(res.body)) {
        let frame: {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          error?: { message?: string };
        };
        try {
          frame = JSON.parse(payload) as typeof frame;
        } catch {
          continue;
        }
        if (frame.error?.message) {
          throw new AIProviderError("gemini", frame.error.message);
        }
        const text = frame.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("");
        if (text) yield text;
      }
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIProviderError("gemini", "Stream timed out.");
      }
      throw new AIProviderError(
        "gemini",
        `Stream failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export { extractJson };
