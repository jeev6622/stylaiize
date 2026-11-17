import type { VTONProvider } from "@stylaiize/shared";
import { IDMVtonProvider } from "./idm-vton.provider";
import { IDMVtonServiceProvider } from "./idm-vton-service.provider";
import { CatVtonProvider } from "./catvton.provider";
import { isVtonJobProvider, type VtonProviderPort } from "./vton.interface";
import { env } from "@/config/env";

export type VtonRequestedProvider = "idm_vton" | "catvton" | "auto";

export interface VtonProviderStatus {
  active: VTONProvider | null;
  demoMode: false;
  configured: boolean;
  primaryConfigured: boolean;
  fallbackConfigured: boolean;
  jobProgressSupported: boolean;
  requestedProvider: VtonRequestedProvider;
  message?: string;
}

function idmProvider(): VtonProviderPort {
  const service = new IDMVtonServiceProvider();
  return service.isConfigured ? service : new IDMVtonProvider();
}

function requestedProvider(): VtonRequestedProvider {
  const pinned = env.VTON_PROVIDER.trim().toLowerCase();
  if (pinned === "idm_vton") return "idm_vton";
  if (pinned === "catvton") return "catvton";
  return "auto";
}

function fallbackProvider(): "idm_vton" | "catvton" | "none" {
  const fallback = env.VTON_FALLBACK_PROVIDER.trim().toLowerCase();
  if (fallback === "idm_vton") return "idm_vton";
  if (fallback === "catvton") return "catvton";
  return "none";
}

/**
 * Resolves the active VTON provider.
 *
 * Priority:
 *   1. VTON_PROVIDER (pinned) when its URL is configured.
 *   2. VTON_FALLBACK_PROVIDER when the pinned provider is missing.
 *   3. Auto mode: first configured provider (IDM-VTON, then CatVTON).
 *
 * We return `null` instead of a fake provider: a null result is an honest
 * "not configured" state, and never produces a fabricated image.
 */
export function resolveVtonProvider(): VtonProviderPort | null {
  const idm = idmProvider();
  const cat = new CatVtonProvider();
  const requested = requestedProvider();

  if (requested === "idm_vton") {
    if (idm.isConfigured) return idm;
    if (fallbackProvider() === "catvton" && cat.isConfigured) return cat;
    return null;
  }

  if (requested === "catvton") {
    if (cat.isConfigured) return cat;
    if (fallbackProvider() === "idm_vton" && idm.isConfigured) return idm;
    return null;
  }

  // Auto: first configured real provider.
  if (idm.isConfigured) return idm;
  if (cat.isConfigured) return cat;
  return null;
}

function missingConfigMessage(requested: VtonRequestedProvider): string {
  if (requested === "idm_vton") {
    return env.VTON_SERVICE_URL.trim() || env.VTON_API_URL.trim()
      ? "IDM-VTON is selected but was not reachable. Check VTON_SERVICE_URL or VTON_API_URL and the GPU server."
      : "IDM-VTON is selected but no endpoint is configured. Set VTON_SERVICE_URL (preferred) or VTON_API_URL on the API server.";
  }
  if (requested === "catvton") {
    return env.VTON_CATVTON_API_URL.trim()
      ? "CatVTON is selected but was not reachable. Check VTON_CATVTON_API_URL and the GPU server."
      : "CatVTON is selected but VTON_CATVTON_API_URL is empty. Set VTON_CATVTON_API_URL on the API server or select IDM-VTON.";
  }
  return "No virtual try-on provider is configured. Set VTON_SERVICE_URL (IDM-VTON, preferred), VTON_API_URL (IDM-VTON legacy), or VTON_CATVTON_API_URL (CatVTON) on the API server.";
}

export function vtonProviderStatus(): VtonProviderStatus {
  const provider = resolveVtonProvider();
  const requested = requestedProvider();
  const idm = idmProvider();
  return {
    active: provider?.provider ?? null,
    demoMode: false,
    configured: provider !== null,
    primaryConfigured: idm.isConfigured,
    fallbackConfigured: new CatVtonProvider().isConfigured,
    jobProgressSupported: provider ? isVtonJobProvider(provider) : false,
    requestedProvider: requested,
    ...(provider ? {} : { message: missingConfigMessage(requested) }),
  };
}
