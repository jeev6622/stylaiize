import { describe, expect, it } from "vitest";
import {
  AVATAR_PREFERENCE_KEY,
  normalizeAvatarPreference,
  readAvatarPreference,
  resolveAvatarSelection,
  writeAvatarPreference,
} from "./avatar-selection";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  } as Storage;
}

describe("avatar selection", () => {
  it("loads the male avatar first for a men's look even when a woman was saved before", () => {
    const selection = resolveAvatarSelection({
      formAudience: "men",
      generatedAudience: "men",
      preferredModelId: "female-formal",
    });
    expect(selection.modelId).toBe("male-formal");
    expect(selection.allowedModelIds).toEqual(["male-formal"]);
    expect(selection.source).toBe("generated");
    expect(selection.requiresChoice).toBe(false);
  });

  it("loads the female avatar first for a women's look", () => {
    const selection = resolveAvatarSelection({
      formAudience: "women",
      generatedAudience: "women",
    });
    expect(selection.modelId).toBe("female-formal");
    expect(selection.allowedModelIds).toEqual(["female-formal"]);
    expect(selection.source).toBe("generated");
  });

  it("uses the form audience when the generated look has no explicit audience", () => {
    const selection = resolveAvatarSelection({
      formAudience: "men",
      generatedAudience: null,
      preferredModelId: "female-formal",
    });
    expect(selection.modelId).toBe("male-formal");
    expect(selection.source).toBe("form");
  });

  it("allows both presentations for unisex and keeps a saved choice", () => {
    const withoutChoice = resolveAvatarSelection({ formAudience: "unisex" });
    expect(withoutChoice.allowedModelIds).toEqual(["male-formal", "female-formal"]);
    expect(withoutChoice.modelId).toBe("male-formal");
    expect(withoutChoice.requiresChoice).toBe(true);

    const withChoice = resolveAvatarSelection({
      formAudience: "unisex",
      preferredModelId: "female-formal",
    });
    expect(withChoice.modelId).toBe("female-formal");
    expect(withChoice.source).toBe("preference");
  });

  it("uses an explicit fallback when audience information is missing", () => {
    const selection = resolveAvatarSelection({});
    expect(selection.audience).toBe("unknown");
    expect(selection.modelId).toBe("male-formal");
    expect(selection.requiresChoice).toBe(true);
    expect(selection.note).toContain("Choose who this look is for");
  });
});

describe("avatar preference persistence", () => {
  it("round-trips a valid preference", () => {
    const storage = memoryStorage();
    writeAvatarPreference({ audience: "women", modelId: "female-formal" }, storage);
    expect(storage.getItem(AVATAR_PREFERENCE_KEY)).not.toBeNull();
    expect(readAvatarPreference(storage)).toEqual({
      audience: "women",
      modelId: "female-formal",
    });
  });

  it("rejects invalid stored values", () => {
    expect(normalizeAvatarPreference({ audience: "children", modelId: "robot" })).toBeNull();
    expect(normalizeAvatarPreference({ audience: "all", modelId: "male-formal" })).toEqual({
      audience: null,
      modelId: "male-formal",
    });
    expect(normalizeAvatarPreference({ audience: "men", modelId: "male-formal" })).toEqual({
      audience: "men",
      modelId: "male-formal",
    });
  });
});
