import { z } from "zod";
import {
  BODY_BUILDS,
  FACE_SHAPES,
  HAIR_LENGTHS,
  HAIR_TYPES,
  SKIN_UNDERTONES,
  type StyleProfile,
} from "@stylaiize/shared";

/** Enum value or missing; AI may answer `null` when a cue is unclear. */
function optionalEnum<T extends readonly string[]>(values: T) {
  return z
    .enum(values as unknown as [T[number], ...T[number][]])
    .nullish()
    .transform((value) => value ?? undefined);
}

/**
 * Shape shared by the AI-output parser, the saved-memory validator and the
 * build-look request. Enum checks ensure an edited or model-generated profile
 * can never carry an unexpected value.
 */
export const styleProfileSchema = z.object({
  faceShape: optionalEnum(FACE_SHAPES),
  hairType: optionalEnum(HAIR_TYPES),
  hairLength: optionalEnum(HAIR_LENGTHS),
  undertone: optionalEnum(SKIN_UNDERTONES),
  bodyBuild: optionalEnum(BODY_BUILDS),
  paletteSuggestions: z
    .array(z.string().trim().min(1).max(60))
    .max(8)
    .default([]),
  confidence: z.coerce
    .number()
    .finite()
    .transform((value) => Math.min(1, Math.max(0, value)))
    .default(0),
  userEdited: z.boolean().default(false),
}) satisfies z.ZodType<StyleProfile, z.ZodTypeDef, unknown>;

export type StyleProfileInput = z.infer<typeof styleProfileSchema>;
