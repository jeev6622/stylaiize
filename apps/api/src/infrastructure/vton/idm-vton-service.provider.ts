import { env } from "@/config/env";
import { logError, logInfo } from "@/utils/logger";
import { BadRequestError } from "@/utils/errors";
import {
  normalizeImage,
  SUPPORTED_VTON_CATEGORIES,
  toVtonCategory,
  type VtonCategory,
} from "./utils";
import type {
  VtonJobProviderPort,
  VtonJobResult,
  VtonRemoteJob,
  VtonRequest,
  VtonResult,
} from "./vton.interface";
import type { VTONProvider } from "@stylaiize/shared";

interface RemoteJobPayload {
  id?: unknown;
  status?: unknown;
  stage?: unknown;
  progress?: unknown;
  message?: unknown;
  error?: unknown;
  processingTimeMs?: unknown;
}

const REMOTE_STATUSES = ["queued", "running", "succeeded", "failed"] as const;
type RemoteStatus = (typeof REMOTE_STATUSES)[number];

function baseUrl(): string {
  return env.VTON_SERVICE_URL.replace(/\/+$/, "");
}

function authHeaders(): Record<string, string> {
  const key = env.VTON_SERVICE_API_KEY.trim() || env.VTON_API_KEY.trim();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

function parseRemoteJob(payload: unknown): VtonRemoteJob {
  if (!payload || typeof payload !== "object") {
    throw new Error("IDM-VTON service returned an invalid job payload.");
  }
  const data = payload as RemoteJobPayload;
  if (typeof data.id !== "string" || !data.id.trim()) {
    throw new Error("IDM-VTON service did not return a job id.");
  }
  if (
    typeof data.status !== "string" ||
    !REMOTE_STATUSES.includes(data.status as RemoteStatus)
  ) {
    throw new Error("IDM-VTON service returned an unknown job status.");
  }

  const rawProgress =
    typeof data.progress === "number" && Number.isFinite(data.progress)
      ? data.progress
      : 0;
  return {
    id: data.id,
    status: data.status as RemoteStatus,
    stage: typeof data.stage === "string" ? data.stage : "running",
    progress: Math.max(0, Math.min(100, rawProgress)),
    ...(typeof data.message === "string" ? { message: data.message } : {}),
    ...(typeof data.error === "string" || data.error === null
      ? { error: data.error }
      : {}),
    ...(typeof data.processingTimeMs === "number"
      ? { processingTimeMs: data.processingTimeMs }
      : {}),
  };
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return `HTTP ${res.status}`;
  try {
    const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown };
    if (typeof parsed.detail === "string") return parsed.detail;
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // Fall through to the raw text.
  }
  return text.slice(0, 500);
}

export class IDMVtonServiceProvider implements VtonJobProviderPort {
  readonly provider: VTONProvider = "idm_vton";
  readonly demoMode = false;

  get isConfigured(): boolean {
    return env.VTON_SERVICE_URL.trim().length > 0;
  }

  async createJob(input: VtonRequest): Promise<VtonRemoteJob> {
    if (!this.isConfigured) {
      throw new Error(
        "IDM-VTON is not configured. Set VTON_SERVICE_URL on the API server.",
      );
    }

    const person = normalizeImage(input.personImage, { label: "Person photo" });
    const garment = normalizeImage(input.garmentImage, { label: "Garment photo" });
    const category = this.resolveCategory(input.category);

    try {
      const res = await fetch(`${baseUrl()}/v1/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          human_image: person.base64,
          garment_image: garment.base64,
          garment_description:
            input.garmentLabel?.trim() || input.category || "garment",
          ...(category ? { category } : {}),
        }),
        signal: AbortSignal.timeout(env.VTON_SERVICE_REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        throw new Error(
          `IDM-VTON service rejected the job (HTTP ${res.status}): ${await readError(res)}`,
        );
      }

      return parseRemoteJob(await res.json());
    } catch (err) {
      if (err instanceof BadRequestError) throw err;
      logError("Could not create IDM-VTON job", err);
      throw this.toProviderError(err);
    }
  }

  async getJob(id: string): Promise<VtonRemoteJob> {
    try {
      const res = await fetch(`${baseUrl()}/v1/jobs/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: { Accept: "application/json", ...authHeaders() },
        signal: AbortSignal.timeout(env.VTON_SERVICE_REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(
          `IDM-VTON status check failed (HTTP ${res.status}): ${await readError(res)}`,
        );
      }
      return parseRemoteJob(await res.json());
    } catch (err) {
      logError("Could not read IDM-VTON job", err);
      throw this.toProviderError(err);
    }
  }

  async getJobResult(id: string): Promise<VtonJobResult> {
    try {
      const res = await fetch(
        `${baseUrl()}/v1/jobs/${encodeURIComponent(id)}/result`,
        {
          method: "GET",
          headers: { Accept: "image/*", ...authHeaders() },
          signal: AbortSignal.timeout(env.VTON_SERVICE_REQUEST_TIMEOUT_MS),
        },
      );
      if (!res.ok) {
        throw new Error(
          `IDM-VTON result download failed (HTTP ${res.status}): ${await readError(res)}`,
        );
      }

      const mimeType = (res.headers.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!mimeType.startsWith("image/")) {
        throw new Error("IDM-VTON service result was not an image.");
      }

      const data = Buffer.from(await res.arrayBuffer());
      if (data.length === 0) {
        throw new Error("IDM-VTON service returned an empty result image.");
      }
      if (data.length > env.VTON_MAX_IMAGE_BYTES) {
        throw new Error("IDM-VTON result image exceeded the size limit.");
      }
      return { data, mimeType };
    } catch (err) {
      logError("Could not download IDM-VTON result", err);
      throw this.toProviderError(err);
    }
  }

  async tryOn(input: VtonRequest): Promise<VtonResult> {
    const started = Date.now();
    const job = await this.createJob(input);
    let current = job;

    while (current.status === "queued" || current.status === "running") {
      if (Date.now() - started > env.VTON_JOB_MAX_MS) {
        throw new Error(
          `IDM-VTON did not finish within ${Math.round(env.VTON_JOB_MAX_MS / 1000)}s.`,
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, env.VTON_JOB_POLL_MS),
      );
      current = await this.getJob(job.id);
    }

    if (current.status === "failed") {
      throw new Error(current.error ?? "IDM-VTON inference failed.");
    }

    const image = await this.getJobResult(job.id);
    const elapsed = current.processingTimeMs ?? Date.now() - started;
    logInfo(`[VTON] IDM-VTON service completed in ${elapsed}ms`);
    return {
      resultImageUrl: null,
      imageData: image.data.toString("base64"),
      mimeType: image.mimeType,
      provider: this.provider,
      processingTimeMs: elapsed,
    };
  }

  async checkHealth(): Promise<{ ready: boolean; latencyMs: number }> {
    if (!this.isConfigured) return { ready: false, latencyMs: 0 };
    const started = Date.now();
    try {
      const res = await fetch(env.VTON_HEALTH_URL || `${baseUrl()}/ready`, {
        method: "GET",
        headers: { Accept: "application/json", ...authHeaders() },
        signal: AbortSignal.timeout(env.VTON_HEALTH_TIMEOUT_MS),
      });
      if (!res.ok) return { ready: false, latencyMs: Date.now() - started };

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const payload = (await res.json()) as { ready?: unknown };
        return {
          ready: payload.ready === true,
          latencyMs: Date.now() - started,
        };
      }
      return { ready: true, latencyMs: Date.now() - started };
    } catch {
      return { ready: false, latencyMs: Date.now() - started };
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
    if (err instanceof BadRequestError) return err;
    if (
      err instanceof Error &&
      (err.name === "AbortError" || err.name === "TimeoutError")
    ) {
      return new Error(
        `The IDM-VTON service did not respond within ${Math.round(env.VTON_SERVICE_REQUEST_TIMEOUT_MS / 1000)}s.`,
      );
    }
    if (err instanceof Error && err.message.startsWith("IDM-VTON")) return err;
    return new Error(
      "Could not reach the IDM-VTON service. Check VTON_SERVICE_URL and that the GPU inference service is running.",
    );
  }
}
