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
 * IDM-VTON provider (primary).
 * Talks to a self-hosted / hosted IDM-VTON inference endpoint. The endpoint
 * receives base64 images (data-URL prefixes stripped) plus an optional garment
 * category hint. Credentials never leave the server.
 *
 * Expected request body (the contract documented in the README):
 *   {
 *     human_image: string,          // raw base64 person image
 *     garment_image: string,        // raw base64 garment image
 *     garment_description: string,  // label / description (optional)
 *     category: "upper_body" | "lower_body" | "dresses"
 *   }
 *
 * Accepted responses: raw image bytes, a JSON object containing a base64
 * image or image URL, or a plain base64/URL string.
 */
export class IDMVtonProvider implements VtonProviderPort {
  readonly provider: VTONProvider = "idm_vton";
  readonly demoMode = false;

  get isConfigured(): boolean {
    return env.VTON_API_URL.trim().length > 0;
  }

  async tryOn(input: VtonRequest): Promise<VtonResult> {
    if (!this.isConfigured) {
      throw new Error(
        "IDM-VTON is not configured. Set VTON_API_URL on the API server.",
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
        human_image: person.base64,
        garment_image: garment.base64,
        garment_description:
          input.garmentLabel?.trim() || input.category || "garment",
        ...(category ? { category } : {}),
      };

      const res = await fetch(env.VTON_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, image/*",
          ...(env.VTON_API_KEY
            ? { Authorization: `Bearer ${env.VTON_API_KEY}` }
            : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(
          `IDM-VTON rejected the request (HTTP ${res.status})${detail ? `: ${detail.slice(0, 500)}` : "."}`,
        );
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      const parsed = parseResultBody(buffer, res.headers.get("content-type"));
      if (!hasImage(parsed)) {
        throw new Error(
          "IDM-VTON returned a response without a usable image. Check that VTON_API_URL points to an IDM-VTON inference server.",
        );
      }

      const elapsed = Date.now() - start;
      logInfo(`[VTON] IDM-VTON completed in ${elapsed}ms`);
      return {
        resultImageUrl: parsed.imageUrl,
        imageData: parsed.imageData,
        mimeType: parsed.mimeType,
        provider: this.provider,
        processingTimeMs: elapsed,
      };
    } catch (err) {
      logError("IDM-VTON try-on failed", err);
      throw this.toProviderError(err);
    } finally {
      clearTimeout(timeout);
    }
  }

  async checkHealth(): Promise<{ ready: boolean; latencyMs: number }> {
    if (!this.isConfigured) return { ready: false, latencyMs: 0 };
    const start = Date.now();
    try {
      const res = await fetch(env.VTON_HEALTH_URL || env.VTON_API_URL, {
        method: "GET",
        headers: {
          Accept: "*/*",
          ...(env.VTON_API_KEY
            ? { Authorization: `Bearer ${env.VTON_API_KEY}` }
            : {}),
        },
        signal: AbortSignal.timeout(env.VTON_HEALTH_TIMEOUT_MS),
      });
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
        `IDM-VTON does not support "${category}" garments. Supported categories: ${SUPPORTED_VTON_CATEGORIES.join(", ")}.`,
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
        `IDM-VTON did not respond within ${Math.round(env.VTON_TIMEOUT_MS / 1000)}s. The GPU endpoint may be cold-starting or unavailable.`,
      );
    }
    if (err instanceof BadRequestError) return err;
    if (err instanceof Error && err.message.startsWith("IDM-VTON")) return err;
    return new Error(
      "Could not reach the IDM-VTON endpoint. Check that the GPU server is running and VTON_API_URL is publicly reachable from the API server.",
    );
  }
}
