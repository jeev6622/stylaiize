import type { TryOnResultRecord, VirtualTryOnResult, VTONProvider } from "@stylaiize/shared";
import { resolveVtonProvider, vtonProviderStatus } from "@/infrastructure/vton/factory";
import { NotFoundError } from "@/utils/errors";
import { logWarn } from "@/utils/logger";
import { tryOnResultRepository } from "@/infrastructure/repos/try-on-result.repo";
import { createSavedOutfit } from "./saved-outfit.service";
import { createItem } from "./wardrobe.service";
import type { VtonRequest } from "@/infrastructure/vton/vton.interface";
import { fetchRemoteImage } from "@/infrastructure/vton/utils";
import { env } from "@/config/env";

export interface TryOnInput {
  personImage: string;
  garmentImage: string;
  category?: string;
  garmentLabel?: string;
  /** Owner id (set by the controller from the authenticated user). */
  personUserId: string;
}

/** Human-readable directives describing exactly what to configure on the server. */
export function vtonConfigGuidance(): string {
  const status = vtonProviderStatus();
  return (
    `${status.message ?? "No virtual try-on provider is configured."}\n\n` +
    "Configure one of these on the API server (apps/api/.env):\n" +
    "  - IDM-VTON (recommended): VTON_PROVIDER=idm_vton, VTON_SERVICE_URL=<FastAPI base URL>\n" +
    "  - IDM-VTON (legacy sync): VTON_PROVIDER=idm_vton, VTON_API_URL=<POST inference endpoint>\n" +
    "  - CatVTON: VTON_PROVIDER=catvton, VTON_CATVTON_API_URL=<POST inference endpoint>\n" +
    "  - Auto: VTON_PROVIDER=auto (uses the first configured provider)\n" +
    "Optional: VTON_SERVICE_API_KEY, VTON_FALLBACK_PROVIDER,\n" +
    "VTON_API_KEY / VTON_CATVTON_API_KEY, VTON_HEALTH_URL /\n" +
    "VTON_CATVTON_HEALTH_URL, VTON_TIMEOUT_MS, VTON_JOB_MAX_MS.\n" +
    "Keys and provider URLs are server-side only and never exposed to the browser."
  );
}

function needsConfigResult(
  provider: VTONProvider | null,
): VirtualTryOnResult {
  return {
    configured: false,
    resultImageUrl: null,
    resultId: null,
    provider: provider ?? "mock",
    demoMode: false,
    processingTimeMs: null,
    status: "not_configured",
    needsConfig: true,
    message: vtonConfigGuidance(),
  };
}

/** Fetches a result that must exist and belong to the given user. */
async function requireOwnedResult(userId: string, resultId: string): Promise<TryOnResultRecord> {
  const record = await tryOnResultRepository().findById(resultId);
  if (!record || record.userId !== userId) {
    throw new NotFoundError("Try-on result not found.");
  }
  return record;
}

/**
 * Backend-gateway virtual try-on.
 * All provider/API keys stay on the server. When no real backend is
 * configured we return a structured `not_configured` state with precise
 * config guidance — we never fabricate a styled image.
 */
export async function tryOnGarment(input: TryOnInput): Promise<VirtualTryOnResult> {
  const provider = resolveVtonProvider();

  // No real backend configured -> honest "not configured" state.
  if (!provider) {
    return needsConfigResult(vtonProviderStatus().active);
  }

  const userId = input.personUserId;

  try {
    const req: VtonRequest = {
      personImage: input.personImage,
      garmentImage: input.garmentImage,
      category: input.category,
      garmentLabel: input.garmentLabel,
    };
    const started = Date.now();
    const result = await provider.tryOn(req);
    const processingTimeMs = result.processingTimeMs ?? Date.now() - started;

    // Prefer storing the image bytes. If the provider only returned a URL,
    // download it server-side so the provider URL (which may be private or
    // signed) is never sent to the browser.
    let resultImage = result.imageData ?? null;
    let mimeType = result.mimeType ?? null;
    let sourceUrl: string | null = null;

    if (!resultImage && result.resultImageUrl) {
      try {
        const remote = await fetchRemoteImage(result.resultImageUrl, {
          timeoutMs: Math.min(env.VTON_TIMEOUT_MS, 30_000),
        });
        resultImage = remote.base64;
        mimeType = remote.mimeType;
      } catch (err) {
        logWarn(
          "[VTON] Could not download the provider result image; it will be proxied on demand.",
          err,
        );
        sourceUrl = result.resultImageUrl;
      }
    }

    // Persist a stored result record; the client can then reference it and
    // pull the image back from the API (keeps images behind auth).
    const stored = await tryOnResultRepository().create({
      userId,
      provider: result.provider,
      category: input.category ?? null,
      personImage: input.personImage,
      garmentImage: input.garmentImage,
      garmentLabel: input.garmentLabel ?? null,
      resultImage,
      mimeType,
      sourceUrl,
      processingTimeMs,
    });

    return {
      configured: true,
      resultImageUrl: `/api/v1/tryon/results/${stored.id}/image`,
      resultId: stored.id,
      provider: result.provider,
      demoMode: false,
      processingTimeMs,
      status: "success",
    };
  } catch (err) {
    return {
      configured: false,
      resultImageUrl: null,
      resultId: null,
      provider: provider.provider,
      demoMode: false,
      processingTimeMs: null,
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Virtual try-on failed. Check the configured backend and its logs.",
    };
  }
}

/** Save a generated try-on as a saved outfit (reuses the outfit record). */
export async function saveTryOnAsOutfit(input: {
  userId: string;
  resultId: string;
  name: string;
  category?: string;
  occasion?: string | null;
  style?: string | null;
  colors?: string[];
  budget?: number | null;
}): Promise<{ id: string }> {
  const record = await requireOwnedResult(input.userId, input.resultId);
  const saved = await createSavedOutfit({
    userId: input.userId,
    name: input.name.trim() || "Virtual Try-On",
    category: (input.category as "casual" | "smart_casual" | "formal" | "party" | "ethnic") ?? "casual",
    occasion: input.occasion ?? null,
    style: input.style ?? null,
    colors: input.colors ?? [],
    budget: input.budget ?? null,
      items: [
        {
          type: "shirt",
          name: record.garmentLabel?.trim() || "Garment",
          brand: null,
          color: "#888888",
          price: null,
          currency: "INR",
          buyUrl: null,
          imageUrl: null,
          reason: "Added from Virtual Try-On.",
        },
      ],
      imageUrl: null,
      source: "manual",
  });
  return { id: saved.id };
}

/** Add the wardrobable garment from a try-on result into the wardrobe. */
export async function saveTryOnToWardrobe(input: {
  userId: string;
  resultId: string;
  name: string;
  category?: string;
  color?: string;
  brand?: string | null;
  tags?: string[];
}): Promise<{ id: string }> {
  await requireOwnedResult(input.userId, input.resultId);
  const created = await createItem(input.userId, {
    name: input.name.trim() || "Garment",
    category: (input.category as "tops" | "bottoms" | "outerwear" | "dresses" | "footwear" | "accessories" | "bags" | "ethnic" | "sportswear") ?? "tops",
    color: input.color?.trim() || "#888888",
    imageUrl: null,
    brand: input.brand ?? null,
    purchasedPrice: null,
    tags: input.tags ?? [],
  });
  return { id: created.id };
}

export function getTryOnStatus(): {
  configured: boolean;
  activeProvider: VTONProvider | null;
  demoMode: boolean;
  primaryConfigured: boolean;
  fallbackConfigured: boolean;
  jobProgressSupported: boolean;
  requestedProvider: string;
  message?: string;
} {
  const status = vtonProviderStatus();
  return {
    configured: status.configured,
    activeProvider: status.active,
    demoMode: status.demoMode,
    primaryConfigured: status.primaryConfigured,
    fallbackConfigured: status.fallbackConfigured,
    jobProgressSupported: status.jobProgressSupported,
    requestedProvider: status.requestedProvider,
    ...(status.message ? { message: status.message } : {}),
  };
}

export async function getTryOnHealth(): Promise<{
  configured: boolean;
  provider: VTONProvider | null;
  ready: boolean;
  latencyMs: number;
  message?: string;
}> {
  const status = vtonProviderStatus();
  if (!status.configured) {
    return {
      configured: false,
      provider: null,
      ready: false,
      latencyMs: 0,
      message: vtonConfigGuidance(),
    };
  }
  const provider = resolveVtonProvider()!;
  const health = await provider.checkHealth();
  return {
    configured: true,
    provider: provider.provider,
    ready: health.ready,
    latencyMs: health.latencyMs,
    message: health.ready
      ? `${provider.provider} is reachable.`
      : `${provider.provider} is configured but did not respond to a health probe (latency ${health.latencyMs}ms).`,
  };
}

/** Lists a user's try-on history (metadata only, no image payloads). */
export async function listTryOnResults(userId: string) {
  const rows = await tryOnResultRepository().findByUserId(userId);
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    category: r.category,
    garmentLabel: r.garmentLabel,
    processingTimeMs: r.processingTimeMs,
    createdAt: r.createdAt,
    imageUrl: `/api/v1/tryon/results/${r.id}/image`,
  }));
}

/** Fetches a single stored result record by id + owner. */
export async function getTryOnResult(userId: string, resultId: string) {
  const record = await tryOnResultRepository().findById(resultId);
  if (!record || record.userId !== userId) return null;
  return record;
}

/**
 * Loads the generated image for a stored result.
 * Provider URLs are fetched server-side so the browser only ever sees the
 * authenticated API image endpoint.
 */
export async function getTryOnResultImage(
  userId: string,
  resultId: string,
): Promise<{ data: Buffer; mimeType: string } | null> {
  const record = await getTryOnResult(userId, resultId);
  if (!record) return null;

  if (record.resultImage) {
    return {
      data: Buffer.from(record.resultImage, "base64"),
      mimeType: record.mimeType ?? "image/png",
    };
  }

  if (record.sourceUrl) {
    const remote = await fetchRemoteImage(record.sourceUrl, {
      timeoutMs: Math.min(env.VTON_TIMEOUT_MS, 30_000),
    });
    return {
      data: Buffer.from(remote.base64, "base64"),
      mimeType: remote.mimeType,
    };
  }

  throw new NotFoundError("Try-on result has no image.");
}

export async function deleteTryOnResult(userId: string, resultId: string): Promise<void> {
  await requireOwnedResult(userId, resultId);
  await tryOnResultRepository().delete(resultId);
}
