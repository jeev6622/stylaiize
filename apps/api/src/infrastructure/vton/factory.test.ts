import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/config/env";
import { resolveVtonProvider, vtonProviderStatus } from "./factory";

const original = {
  provider: env.VTON_PROVIDER,
  apiUrl: env.VTON_API_URL,
  catUrl: env.VTON_CATVTON_API_URL,
  fallback: env.VTON_FALLBACK_PROVIDER,
};

afterEach(() => {
  env.VTON_PROVIDER = original.provider;
  env.VTON_API_URL = original.apiUrl;
  env.VTON_CATVTON_API_URL = original.catUrl;
  env.VTON_FALLBACK_PROVIDER = original.fallback;
});

describe("VTON provider resolution", () => {
  it("reports an honest not-configured state when no URL is set", () => {
    env.VTON_PROVIDER = "auto";
    env.VTON_API_URL = "";
    env.VTON_CATVTON_API_URL = "";

    expect(resolveVtonProvider()).toBeNull();
    const status = vtonProviderStatus();
    expect(status.configured).toBe(false);
    expect(status.active).toBeNull();
    expect(status.message).toContain("VTON_API_URL");
  });

  it("auto-selects IDM-VTON when it is configured", () => {
    env.VTON_PROVIDER = "auto";
    env.VTON_API_URL = "https://idm.example.com/infer";
    env.VTON_CATVTON_API_URL = "https://cat.example.com/infer";

    expect(resolveVtonProvider()?.provider).toBe("idm_vton");
  });

  it("auto-selects CatVTON when only CatVTON is configured", () => {
    env.VTON_PROVIDER = "";
    env.VTON_API_URL = "";
    env.VTON_CATVTON_API_URL = "https://cat.example.com/infer";

    expect(resolveVtonProvider()?.provider).toBe("catvton");
  });

  it("uses the fallback provider when the pinned provider is missing", () => {
    env.VTON_PROVIDER = "catvton";
    env.VTON_FALLBACK_PROVIDER = "idm_vton";
    env.VTON_CATVTON_API_URL = "";
    env.VTON_API_URL = "https://idm.example.com/infer";

    expect(resolveVtonProvider()?.provider).toBe("idm_vton");
  });

  it("does not silently fall back when fallback is disabled", () => {
    env.VTON_PROVIDER = "catvton";
    env.VTON_FALLBACK_PROVIDER = "none";
    env.VTON_CATVTON_API_URL = "";
    env.VTON_API_URL = "https://idm.example.com/infer";

    expect(resolveVtonProvider()).toBeNull();
    expect(vtonProviderStatus().message).toContain("VTON_CATVTON_API_URL");
  });
});
