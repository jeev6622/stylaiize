import type {
  BuildLookShopResult,
  BuildYourLookData,
  CompleteOutfitImageStatus,
  GroomingPlan,
} from "@stylaiize/shared";
import type { BuildLookFormState } from "@/components/build-look/BuildLookForm";

const BUILD_LOOK_SESSION_KEY = "stylaiize_build_look_session_v1";

export interface BuildLookSession {
  form: BuildLookFormState;
  look: BuildYourLookData;
  grooming: GroomingPlan | null;
  shopResult: BuildLookShopResult | null;
  shopFingerprint: string | null;
  imageStatus: CompleteOutfitImageStatus | null;
  imageMessage: string | null;
  savedAt: string;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readBuildLookSession(): BuildLookSession | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(BUILD_LOOK_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Partial<BuildLookSession>;
    if (!value.look || !Array.isArray(value.look.items)) return null;
    if (!value.form || typeof value.form !== "object") return null;
    return {
      form: value.form,
      look: value.look,
      grooming: value.grooming ?? null,
      shopResult: value.shopResult ?? null,
      shopFingerprint: value.shopFingerprint ?? null,
      imageStatus: value.imageStatus ?? null,
      imageMessage: value.imageMessage ?? null,
      savedAt: typeof value.savedAt === "string" ? value.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeBuildLookSession(
  session: Omit<BuildLookSession, "savedAt">,
): void {
  const store = storage();
  if (!store) return;
  try {
    const payload: BuildLookSession = {
      ...session,
      savedAt: new Date().toISOString(),
    };
    store.setItem(BUILD_LOOK_SESSION_KEY, JSON.stringify(payload));
  } catch {
    return;
  }
}

export function clearBuildLookSession(): void {
  storage()?.removeItem(BUILD_LOOK_SESSION_KEY);
}
