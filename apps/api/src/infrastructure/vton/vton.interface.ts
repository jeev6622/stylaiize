import type { VTONProvider } from "@stylaiize/shared";

export interface VtonRequest {
  /** Base64-encoded person image or URL */
  personImage: string;
  /** Base64-encoded garment image or URL */
  garmentImage: string;
  /** Optional: garment category hint (StylAIze item type). */
  category?: string;
  /** Optional: human-readable garment label/description. */
  garmentLabel?: string;
}

export interface VtonResult {
  /** Direct URL from the backend (when the backend returns one). */
  resultImageUrl: string | null;
  /** Raw base64 image data returned by the backend (when available). */
  imageData?: string | null;
  mimeType?: string | null;
  /** Provider used */
  provider: VTONProvider;
  /** Processing time in ms */
  processingTimeMs: number;
}

export interface VtonProviderPort {
  readonly provider: VTONProvider;
  readonly isConfigured: boolean;
  readonly demoMode: boolean;
  tryOn(input: VtonRequest): Promise<VtonResult>;
  checkHealth(): Promise<{ ready: boolean; latencyMs: number }>;
}

/** Remote job state returned by the IDM-VTON inference service. */
export interface VtonRemoteJob {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  stage: string;
  progress: number;
  message?: string;
  error?: string | null;
  processingTimeMs?: number | null;
}

export interface VtonJobResult {
  data: Buffer;
  mimeType: string;
}

/** Optional capability for providers that expose real job progress. */
export interface VtonJobProviderPort extends VtonProviderPort {
  createJob(input: VtonRequest): Promise<VtonRemoteJob>;
  getJob(id: string): Promise<VtonRemoteJob>;
  getJobResult(id: string): Promise<VtonJobResult>;
}

export function isVtonJobProvider(
  provider: VtonProviderPort,
): provider is VtonJobProviderPort {
  const candidate = provider as Partial<VtonJobProviderPort>;
  return (
    typeof candidate.createJob === "function" &&
    typeof candidate.getJob === "function" &&
    typeof candidate.getJobResult === "function"
  );
}
