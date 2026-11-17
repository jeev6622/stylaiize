import { logInfo } from "@/utils/logger";
import type { VtonProviderPort, VtonRequest, VtonResult } from "./vton.interface";
import type { VTONProvider } from "@stylaiize/shared";

/**
 * Fallback provider used only when no real backend is configured.
 * It does NOT fabricate a styled result — instead it reports a clear
 * "not configured" state so the client can prompt the user to configure
 * a virtual-try-on backend (IDM-VTON / CatVTON) via server env vars.
 */
export class MockVtonProvider implements VtonProviderPort {
  readonly provider: VTONProvider = "mock";
  readonly isConfigured = false;
  readonly demoMode = true;

  async tryOn(_input: VtonRequest): Promise<VtonResult> {
    logInfo("[VTON-MOCK] No real try-on backend configured.");
    throw new Error(
      "Virtual try-on is not configured. Set VTON_API_URL (IDM-VTON) or VTON_CATVTON_API_URL (CatVTON) on the server.",
    );
  }

  async checkHealth(): Promise<{ ready: boolean; latencyMs: number }> {
    return { ready: false, latencyMs: 0 };
  }
}
