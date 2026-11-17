import {
  BODY_BUILDS,
  FACE_SHAPES,
  HAIR_LENGTHS,
  HAIR_TYPES,
  SKIN_UNDERTONES,
  type StyleProfile,
} from "@stylaiize/shared";
import { aiService } from "@/application/services/ai.service";
import { AIProviderError } from "@/infrastructure/ai/errors";
import { styleProfileSchema } from "@/application/validators/style-profile.schema";

export interface AnalyzeStyleProfileInput {
  /** Raw image bytes. Held in memory only; never written or logged. */
  buffer: Buffer;
  mimeType: string;
}

const OUTPUT_SCHEMA = {
  faceShape: `one of ${FACE_SHAPES.join(" | ")} | null`,
  hairType: `one of ${HAIR_TYPES.join(" | ")} | null`,
  hairLength: `one of ${HAIR_LENGTHS.join(" | ")} | null`,
  undertone: `one of ${SKIN_UNDERTONES.join(" | ")} | null`,
  bodyBuild: `one of ${BODY_BUILDS.join(" | ")} | null`,
  paletteSuggestions: [
    "string (a specific colour that suits the person, e.g. 'olive', 'camel', 'navy')",
  ],
  confidence: "number between 0 and 1",
};

const INSTRUCTION = [
  "Analyse this photo for styling attributes only.",
  "Return exactly these fields: face shape, hair type, hair length, skin undertone (only to suggest a colour palette), and general body build/proportions.",
  "Palette suggestions must be concrete colours or colour families, not brand names.",
  "Do NOT infer, mention or return age, gender, ethnicity, religion, health, disability, pregnancy, or any other sensitive identity attribute.",
  "If a cue is unclear, return null for that field instead of guessing.",
  "Be respectful and neutral. This profile is used once to personalise outfit colours and grooming ideas.",
].join("\n");

function activeProviderName(): string {
  try {
    return aiService.activeProvider.name;
  } catch {
    return "ai";
  }
}

/**
 * Runs the vision model over an in-memory image and validates the response
 * against the shared style-profile vocabulary. There is intentionally no
 * storage/provider call here: the photo exists only for this request.
 */
export async function analyzeStyleProfile(
  input: AnalyzeStyleProfileInput,
): Promise<StyleProfile> {
  const raw = await aiService.generateJson<Record<string, unknown>>({
    task: "analyze_style_profile",
    instruction: INSTRUCTION,
    outputSchema: OUTPUT_SCHEMA,
    images: [{ mimeType: input.mimeType, data: input.buffer.toString("base64") }],
  });

  const parsed = styleProfileSchema.safeParse(raw);
  if (!parsed.success) {
    // Do not include the photo or the invalid values in the message.
    throw new AIProviderError(
      activeProviderName(),
      "returned a style profile with values outside the allowed set.",
    );
  }

  return { ...parsed.data, userEdited: false };
}
