import { env } from "@/config/env";
import { logError, logInfo } from "@/utils/logger";
import {
  hasImage,
  normalizeImage,
  parseResultBody,
  SUPPORTED_VTON_CATEGORIES,
  toVtonCategory,
  type VtonCategory,
} from "./utils";
import type { VtonProviderPort, VtonRequest, VtonResult } from "./vton.interface";
import type { VTONProvider } from "@stylaiize/shared";
import { BadRequestError } from "@/utils/errors";

/**
 * CatVTON provider (fallback / alternative).
 * Used when IDM-VTON is not configured or as the pinned provider. The
 * endpoint receives base64 source + reference images. Credentials never
 * leave the server.
 *
 * Expected request body (the contract documented in the README):
 *   {
 *     source_image: string,     // raw base64 person image
 *     reference_image: string,  // raw base64 garment image
 *     cloth_type: "upper_body" | "lower_body" | "dresses"
 *   }
 */
export class CatVtonProvider implements VtonProviderPort {
  readonly provider: VTONProvider = "catvton";
  readonly demoMode = false;

  get isConfigured(): boolean {
    return env.VTON_CATVTON_API_URL.trim().length > 0;
  }

  get apiKey(): string {
    return env.VTON_CATVTON_API_KEY.trim() || env.VTON_API_KEY.trim();
  }

  async tryOn(input: VtonRequest): Promise<VtonResult> {
    if (!this.isConfigured) {
      throw new Error(
        "CatVTON is not configured. Set VTON_CATVTON_API_URL on the API server.",
      );
    }

    const person = normalizeImage(input.personImage, { label: "Person photo" });
    const garment = normalizeImage(input.garmentImage, { label: "Garment photo" });
    const category = this.resolveCategory(input.category);

    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.VTON_TIMEOUT_MS);

    try {
      const body = {
        source_image: person.base64,
        reference_image: garment.base64,
        ...(category ? { cloth_type: category } : {}),
      };

      const res = await fetch(env.VTON_CATVTON_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, image/*",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(
          `CatVTON rejected the request (HTTP ${res.status})${detail ? `: ${detail.slice(0, 500)}` : "."}`,
        );
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      const parsed = parseResultBody(buffer, res.headers.get("content-type"));
      if (!hasImage(parsed)) {
        throw new Error(
          "CatVTON returned a response without a usable image. Check that VTON_CATVTON_API_URL points to a CatVTON inference server.",
        );
      }

      const elapsed = Date.now() - start;
      logInfo(`[VTON] CatVTON completed in ${elapsed}ms`);
      return {
        resultImageUrl: parsed.imageUrl,
        imageData: parsed.imageData,
        mimeType: parsed.mimeType,
        provider: this.provider,
        processingTimeMs: elapsed,
      };
    } catch (err) {
      logError("CatVTON try-on failed", err);
      throw this.toProviderError(err);
    } finally {
      clearTimeout(timeout);
    }
  }

  async checkHealth(): Promise<{ ready: boolean; latencyMs: number }> {
    if (!this.isConfigured) return { ready: false, latencyMs: 0 };
    const start = Date.now();
    try {
      const res = await fetch(
        env.VTON_CATVTON_HEALTH_URL || env.VTON_CATVTON_API_URL,
        {
          method: "GET",
          headers: {
            Accept: "*/*",
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          signal: AbortSignal.timeout(env.VTON_HEALTH_TIMEOUT_MS),
        },
      );
      // Any non-5xx response proves the server is reachable (401/403/405 is
      // still a live service; the inference call will report auth errors).
      return { ready: res.status < 500, latencyMs: Date.now() - start };
    } catch {
      return { ready: false, latencyMs: Date.now() - start };
    }
  }

  private resolveCategory(category?: string): VtonCategory | undefined {
    if (!category) return undefined;
    const mapped = toVtonCategory(category);
    if (!mapped) {
      throw new BadRequestError(
        `CatVTON does not support "${category}" garments. Supported categories: ${SUPPORTED_VTON_CATEGORIES.join(", ")}.`,
        "VTON_UNSUPPORTED_CATEGORY",
      );
    }
    return mapped;
  }

  private toProviderError(err: unknown): Error {
    if (
      err instanceof Error &&
      (err.name === "AbortError" || err.name === "TimeoutError")
    ) {
      return new Error(
        `CatVTON did not respond within ${Math.round(env.VTON_TIMEOUT_MS / 1000)}s. The GPU endpoint may be cold-starting or unavailable.`,
      );
    }
    if (err instanceof BadRequestError) return err;
    if (err instanceof Error && err.message.startsWith("CatVTON")) return err;
    return new Error(
      "Could not reach the CatVTON endpoint. Check that the GPU server is running and VTON_CATVTON_API_URL is publicly reachable from the API server.",
    );
  }
}
