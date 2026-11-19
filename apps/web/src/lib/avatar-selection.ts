import type { ShopAudience } from "@stylaiize/shared";
import type { FashionModelId } from "../components/build-look/fashion-model-catalog";

export const AVATAR_PREFERENCE_KEY = "stylaiize_build_look_avatar_v1";

export type AvatarAudience = "men" | "women" | "unisex" | "unknown";

export interface AvatarPreference {
  audience?: ShopAudience | null;
  modelId?: FashionModelId | null;
}

export interface AvatarSelectionInput {
  formAudience?: ShopAudience | null;
  generatedAudience?: ShopAudience | null;
  preferredModelId?: FashionModelId | null;
}

export interface AvatarSelection {
  audience: AvatarAudience;
  audienceLabel: string;
  modelId: FashionModelId;
  allowedModelIds: FashionModelId[];
  source: "form" | "generated" | "preference" | "fallback";
  requiresChoice: boolean;
  note: string;
}

const MALE_MODEL: FashionModelId = "male-formal";
const FEMALE_MODEL: FashionModelId = "female-formal";

function isFashionModelId(value: unknown): value is FashionModelId {
  return value === MALE_MODEL || value === FEMALE_MODEL;
}

function normalizeAudience(value: ShopAudience | null | undefined): AvatarAudience {
  if (value === "men" || value === "women" || value === "unisex") return value;
  return "unknown";
}

function audienceLabel(audience: AvatarAudience): string {
  if (audience === "men") return "Men";
  if (audience === "women") return "Women";
  if (audience === "unisex") return "Unisex";
  return "Audience not chosen";
}

function sourceNote(source: AvatarSelection["source"], audience: AvatarAudience): string {
  const label = audienceLabel(audience);
  if (source === "generated") return `Using the ${label} audience from the generated look.`;
  if (source === "form") return `Using the ${label} selection from your Build Your Look form.`;
  if (source === "preference") return `Using your saved ${label} presentation preference.`;
  return "Choose who this look is for before previewing the outfit.";
}

export function resolveAvatarSelection(input: AvatarSelectionInput): AvatarSelection {
  const generated = normalizeAudience(input.generatedAudience);
  const form = normalizeAudience(input.formAudience);
  let audience: AvatarAudience = generated;
  let source: AvatarSelection["source"] = generated !== "unknown" ? "generated" : "fallback";

  if (audience === "unknown" && form !== "unknown") {
    audience = form;
    source = "form";
  }
  if (audience === "unisex" && isFashionModelId(input.preferredModelId)) {
    source = "preference";
  }

  const allowedModelIds: FashionModelId[] =
    audience === "men"
      ? [MALE_MODEL]
      : audience === "women"
        ? [FEMALE_MODEL]
        : [MALE_MODEL, FEMALE_MODEL];

  const modelId = isFashionModelId(input.preferredModelId)
    ? input.preferredModelId
    : allowedModelIds[0];

  const resolvedModelId = allowedModelIds.includes(modelId) ? modelId : allowedModelIds[0];

  return {
    audience,
    audienceLabel: audienceLabel(audience),
    modelId: resolvedModelId,
    allowedModelIds,
    source,
    requiresChoice: audience === "unisex" || audience === "unknown",
    note: sourceNote(source, audience),
  };
}

export function normalizeAvatarPreference(value: unknown): AvatarPreference | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const audience =
    candidate.audience === "men" ||
    candidate.audience === "women" ||
    candidate.audience === "unisex"
      ? candidate.audience
      : null;
  const modelId = isFashionModelId(candidate.modelId) ? candidate.modelId : null;
  if (!audience && !modelId) return null;
  return { audience, modelId };
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readAvatarPreference(storage: Storage | null = browserStorage()): AvatarPreference | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(AVATAR_PREFERENCE_KEY);
    if (!raw) return null;
    return normalizeAvatarPreference(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeAvatarPreference(
  preference: AvatarPreference,
  storage: Storage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(AVATAR_PREFERENCE_KEY, JSON.stringify(preference));
  } catch {
    return;
  }
}
