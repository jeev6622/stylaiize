import type {
  BuildLookAudience,
  CompleteOutfitImage,
  CompleteOutfitImageRequest,
  CompleteOutfitImageResponse,
} from "@stylaiize/shared";
import { BUILD_LOOK_AUDIENCES } from "@stylaiize/shared";
import { z } from "zod";
import { resolveOutfitImageProvider } from "@/infrastructure/outfit-image/factory";
import { OutfitImageProviderError } from "@/infrastructure/outfit-image/errors";
import type { OutfitImageProviderPort } from "@/infrastructure/outfit-image/outfit-image.interface";
import { logWarn } from "@/utils/logger";
import { AppError } from "@/utils/errors";

export const COMPLETE_OUTFIT_IMAGE_NOT_CONFIGURED_MESSAGE =
  "Complete-outfit image generation is not configured on the API server, so no image was generated. " +
  "Configure the outfit image provider on the API server, then try again.";

const COMPLETE_OUTFIT_IMAGE_ERROR_MESSAGE =
  "The outfit image provider could not render this exact outfit, so no image was generated. Please try again.";

const generatedImageSchema = z
  .object({
    imageUrl: z
      .string()
      .trim()
      .url()
      .refine((v) => /^https:\/\//i.test(v), "must be an https URL"),
    provider: z.string().trim().min(1).max(120),
    license: z.string().trim().min(1).max(200),
    label: z.string().trim().min(1).max(120).optional(),
    matchBasis: z.enum(["verified_products", "ai_outfit"]).optional(),
    mimeType: z.string().trim().min(1).max(80).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict();

function resolveAudience(input: CompleteOutfitImageRequest): BuildLookAudience {
  const audience = input.audience as BuildLookAudience | undefined;
  if (!audience || !BUILD_LOOK_AUDIENCES.includes(audience)) {
    throw new AppError(422, "Select who this look is for before generating an image.", {
      code: "VALIDATION_ERROR",
    });
  }
  return audience;
}

export function buildCompleteOutfitImagePrompt(input: CompleteOutfitImageRequest): string {
  const audience = resolveAudience(input);
  const itemLines = input.items.map((item, index) => {
    const details = [
      `category: ${item.category}`,
      `colour: ${item.color}`,
      item.material ? `material: ${item.material}` : "",
      item.size ? `size/fit: ${item.size}` : "",
      item.description ? `styling note: ${item.description}` : "",
    ].filter(Boolean);
    return `${index + 1}. ${item.name} (${details.join("; ")})`;
  });

  return [
    "Render one photographic image of a single complete outfit worn by one model.",
    "Depict only the styling details below. Do not invent brands, logos, prices, retailers or stock claims.",
    `Audience: ${audience}. Use only garments appropriate for this audience.`,
    `Event: ${input.eventName}`,
    input.occasion ? `Occasion: ${input.occasion}` : "",
    input.dressCode ? `Dress code: ${input.dressCode}` : "",
    input.dressCodeReason ? `Dress code reasoning: ${input.dressCodeReason}` : "",
    `Style: ${input.style}`,
    input.budget ? `Budget band: ${input.budget}` : "",
    input.season ? `Season: ${input.season}` : "",
    input.colors?.length ? `Requested colours: ${input.colors.join(", ")}` : "",
    input.colorCombination ? `Colour combination: ${input.colorCombination}` : "",
    input.fit ? `Fit preference: ${input.fit}` : "",
    input.fitGuidance ? `Fit guidance: ${input.fitGuidance}` : "",
    input.footwear ? `Footwear direction: ${input.footwear}` : "",
    input.accessories?.length ? `Accessories: ${input.accessories.join(", ")}` : "",
    input.occasionSuitability ? `Occasion suitability: ${input.occasionSuitability}` : "",
    input.seasonSuitability ? `Season suitability: ${input.seasonSuitability}` : "",
    input.explanation ? `Styling rationale: ${input.explanation}` : "",
    "Items that must all appear together in this exact outfit:",
    ...itemLines,
    "Return a direct HTTPS URL to the generated image and the name of the provider that rendered it.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateCompleteOutfitImage(
  input: CompleteOutfitImageRequest,
  injectedProvider?: OutfitImageProviderPort | null,
): Promise<CompleteOutfitImageResponse> {
  const audience = resolveAudience(input);

  try {
    const provider =
      injectedProvider === undefined ? resolveOutfitImageProvider() : injectedProvider;

    if (!provider || !provider.isConfigured) {
      return {
        status: "not_configured",
        completeOutfitImage: null,
        image: null,
        audience,
        needsConfig: true,
        message: COMPLETE_OUTFIT_IMAGE_NOT_CONFIGURED_MESSAGE,
      };
    }

    if (provider.supportedAudiences && !provider.supportedAudiences.includes(audience)) {
      return {
        status: "error",
        completeOutfitImage: null,
        image: null,
        audience,
        needsConfig: false,
        message: `The image provider cannot serve ${audience} outfits.`,
      };
    }

    const generated = generatedImageSchema.parse(
      await provider.generate({
        prompt: buildCompleteOutfitImagePrompt(input),
        audience,
        items: input.items,
        eventName: input.eventName,
        style: input.style,
      }),
    );

    const image: CompleteOutfitImage = {
      url: generated.imageUrl,
      provider: generated.provider,
      license: generated.license,
      audience,
      generatedAt: new Date().toISOString(),
      matchBasis: generated.matchBasis ?? "ai_outfit",
      ...(generated.label ? { label: generated.label } : {}),
      ...(generated.mimeType ? { mimeType: generated.mimeType } : {}),
      ...(generated.width ? { width: generated.width } : {}),
      ...(generated.height ? { height: generated.height } : {}),
    };

    return {
      status: "success",
      completeOutfitImage: image,
      image,
      audience,
      needsConfig: false,
      message: null,
    };
  } catch (err) {
    logWarn("[CompleteOutfitImage] generation failed", err);
    const message =
      err instanceof OutfitImageProviderError
        ? `${COMPLETE_OUTFIT_IMAGE_ERROR_MESSAGE} ${err.message}`
        : COMPLETE_OUTFIT_IMAGE_ERROR_MESSAGE;
    return {
      status: "error",
      completeOutfitImage: null,
      image: null,
      audience,
      needsConfig: false,
      message,
    };
  }
}
