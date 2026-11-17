import { randomUUID } from "node:crypto";
import type {
  VirtualTryOnJob,
  VirtualTryOnJobStage,
  VirtualTryOnJobStatus,
} from "@stylaiize/shared";
import { env } from "@/config/env";
import { tryOnResultRepository } from "@/infrastructure/repos/try-on-result.repo";
import { resolveVtonProvider } from "@/infrastructure/vton/factory";
import {
  isVtonJobProvider,
  type VtonJobProviderPort,
  type VtonProviderPort,
  type VtonRemoteJob,
  type VtonRequest,
} from "@/infrastructure/vton/vton.interface";
import { NotFoundError } from "@/utils/errors";
import { logError } from "@/utils/logger";
import { vtonConfigGuidance } from "./tryon.service";

export interface TryOnJobInput {
  personImage: string;
  garmentImage: string;
  category?: string;
  garmentLabel?: string;
  userId: string;
}

interface InternalJob {
  state: VirtualTryOnJob;
  input: VtonRequest | null;
  provider: VtonProviderPort | null;
  remoteJobId: string | null;
  /** The provider is finished; the result is still being persisted. */
  remoteSucceeded: boolean;
  startedAt: number;
}

const jobs = new Map<string, InternalJob>();
const JOB_TTL_MS = 60 * 60 * 1000;
const MAX_JOBS = 200;
const MAX_CONSECUTIVE_POLL_ERRORS = 5;

const STAGES = new Set<VirtualTryOnJobStage>([
  "queued",
  "loading_model",
  "validating",
  "masking",
  "pose",
  "encoding",
  "diffusion",
  "decoding",
  "saving",
  "running",
  "done",
]);

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeStage(stage: string): VirtualTryOnJobStage {
  return STAGES.has(stage as VirtualTryOnJobStage)
    ? (stage as VirtualTryOnJobStage)
    : "running";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pruneJobs(): void {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    const finished =
      job.state.status === "succeeded" ||
      job.state.status === "failed" ||
      job.state.status === "not_configured";
    if (finished && new Date(job.state.updatedAt).getTime() < cutoff) {
      jobs.delete(id);
    }
  }

  if (jobs.size <= MAX_JOBS) return;
  const removable = [...jobs.entries()]
    .filter(
      ([, job]) =>
        job.state.status === "succeeded" ||
        job.state.status === "failed" ||
        job.state.status === "not_configured",
    )
    .sort(
      ([, a], [, b]) =>
        new Date(a.state.updatedAt).getTime() -
        new Date(b.state.updatedAt).getTime(),
    );
  for (const [id] of removable) {
    if (jobs.size <= MAX_JOBS) break;
    jobs.delete(id);
  }
}

function updateJob(
  job: InternalJob,
  patch: Partial<VirtualTryOnJob>,
): void {
  job.state = { ...job.state, ...patch, updatedAt: nowIso() };
}

function applyRemote(job: InternalJob, remote: VtonRemoteJob): void {
  if (remote.status === "succeeded") {
    // Do not expose "succeeded" until the image is stored: polling clients would
    // otherwise receive a succeeded job with resultImageUrl still null.
    job.remoteSucceeded = true;
    updateJob(job, {
      status: "running",
      stage: "saving",
      progress: remote.progress,
      ...(remote.message ? { message: remote.message } : {}),
      ...(typeof remote.processingTimeMs === "number"
        ? { processingTimeMs: remote.processingTimeMs }
        : {}),
    });
    return;
  }

  const status: VirtualTryOnJobStatus =
    remote.status === "failed"
      ? "failed"
      : remote.status === "queued"
        ? "queued"
        : "running";
  updateJob(job, {
    status,
    stage: normalizeStage(remote.stage),
    progress: remote.progress,
    ...(remote.message ? { message: remote.message } : {}),
    ...(remote.error ? { error: remote.error } : {}),
    ...(typeof remote.processingTimeMs === "number"
      ? { processingTimeMs: remote.processingTimeMs }
      : {}),
  });
}

async function persistResult(
  job: InternalJob,
  input: VtonRequest,
  provider: VtonProviderPort,
  image: { data: Buffer; mimeType: string },
  processingTimeMs: number,
) {
  const stored = await tryOnResultRepository().create({
    userId: job.state.userId,
    provider: provider.provider,
    category: input.category ?? null,
    personImage: input.personImage,
    garmentImage: input.garmentImage,
    garmentLabel: input.garmentLabel ?? null,
    resultImage: image.data.toString("base64"),
    mimeType: image.mimeType,
    sourceUrl: null,
    processingTimeMs,
  });

  updateJob(job, {
    status: "succeeded",
    stage: "done",
    progress: 100,
    message: "Try-on completed.",
    error: null,
    resultId: stored.id,
    resultImageUrl: `/api/v1/tryon/results/${stored.id}/image`,
    processingTimeMs,
  });
}

async function runAsyncJob(
  job: InternalJob,
  provider: VtonJobProviderPort,
  input: VtonRequest,
): Promise<void> {
  const deadline = job.startedAt + env.VTON_JOB_MAX_MS;
  let consecutiveErrors = 0;

  try {
    const created = await provider.createJob(input);
    job.remoteJobId = created.id;
    applyRemote(job, created);

    while (Date.now() < deadline) {
      if (job.remoteSucceeded) {
        const image = await provider.getJobResult(created.id);
        const processingTimeMs =
          job.state.processingTimeMs ?? Date.now() - job.startedAt;
        await persistResult(job, input, provider, image, processingTimeMs);
        return;
      }
      if (job.state.status === "failed") {
        throw new Error(job.state.error ?? "IDM-VTON inference failed.");
      }

      await sleep(env.VTON_JOB_POLL_MS);
      if (Date.now() >= deadline) break;

      try {
        const remote = await provider.getJob(created.id);
        consecutiveErrors = 0;
        applyRemote(job, remote);
      } catch (err) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) throw err;
      }
    }

    throw new Error(
      `IDM-VTON did not finish within ${Math.round(env.VTON_JOB_MAX_MS / 1000)}s.`,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Virtual try-on inference failed.";
    logError("Async try-on job failed", err);
    updateJob(job, {
      status: "failed",
      stage: "running",
      message: "Try-on inference failed.",
      error: message,
    });
  } finally {
    job.input = null;
  }
}

async function runLegacyJob(
  job: InternalJob,
  provider: VtonProviderPort,
  input: VtonRequest,
): Promise<void> {
  try {
    const started = Date.now();
    const result = await provider.tryOn(input);
    if (!result.imageData) {
      throw new Error(
        "The provider returned no image bytes; detailed progress is unavailable for legacy endpoints.",
      );
    }
    await persistResult(
      job,
      input,
      provider,
      {
        data: Buffer.from(result.imageData, "base64"),
        mimeType: result.mimeType ?? "image/png",
      },
      result.processingTimeMs ?? Date.now() - started,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Virtual try-on inference failed.";
    logError("Legacy try-on job failed", err);
    updateJob(job, {
      status: "failed",
      stage: "running",
      message: "Try-on inference failed.",
      error: message,
    });
  } finally {
    job.input = null;
  }
}

function startJob(
  job: InternalJob,
  provider: VtonProviderPort,
  input: VtonRequest,
): void {
  if (isVtonJobProvider(provider)) {
    void runAsyncJob(job, provider, input);
  } else {
    void runLegacyJob(job, provider, input);
  }
}

export function createTryOnJob(input: TryOnJobInput): VirtualTryOnJob {
  pruneJobs();

  const provider = resolveVtonProvider();
  const now = nowIso();
  const id = randomUUID();

  if (!provider) {
    const job: InternalJob = {
      state: {
        id,
        userId: input.userId,
        provider: null,
        status: "not_configured",
        stage: "queued",
        progress: 0,
        progressSupported: false,
        message: vtonConfigGuidance(),
        error: null,
        resultId: null,
        resultImageUrl: null,
        processingTimeMs: null,
        createdAt: now,
        updatedAt: now,
      },
      input: null,
      provider: null,
      remoteJobId: null,
      remoteSucceeded: false,
      startedAt: Date.now(),
    };
    jobs.set(id, job);
    return job.state;
  }

  const progressSupported = isVtonJobProvider(provider);
  const job: InternalJob = {
    state: {
      id,
      userId: input.userId,
      provider: provider.provider,
      status: "queued",
      stage: "queued",
      progress: 0,
      progressSupported,
      message: progressSupported
        ? "Queued for IDM-VTON inference."
        : "Queued for inference. This provider does not expose detailed progress.",
      error: null,
      resultId: null,
      resultImageUrl: null,
      processingTimeMs: null,
      createdAt: now,
      updatedAt: now,
    },
    input: {
      personImage: input.personImage,
      garmentImage: input.garmentImage,
      category: input.category,
      garmentLabel: input.garmentLabel,
    },
    provider,
    remoteJobId: null,
    remoteSucceeded: false,
    startedAt: Date.now(),
  };

  jobs.set(id, job);
  startJob(job, provider, job.input!);
  return job.state;
}

export function getTryOnJob(userId: string, jobId: string): VirtualTryOnJob {
  const job = jobs.get(jobId);
  if (!job || job.state.userId !== userId) {
    throw new NotFoundError("Try-on job not found.");
  }
  return job.state;
}
