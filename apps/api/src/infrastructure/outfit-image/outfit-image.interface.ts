import type {
  BuildLookAudience,
  CompleteOutfitImageItemInput,
} from "@stylaiize/shared";

export interface OutfitImageGenerationRequest {
  prompt: string;
  audience: BuildLookAudience;
  items: CompleteOutfitImageItemInput[];
  eventName: string;
  style: string;
}

export interface OutfitImageGeneration {
  imageUrl: string;
  provider: string;
  license: string;
  label?: string;
  matchBasis?: "verified_products" | "ai_outfit";
  mimeType?: string;
  width?: number;
  height?: number;
}

export interface OutfitImageProviderPort {
  readonly id: string;
  readonly isConfigured: boolean;
  readonly supportedAudiences: readonly BuildLookAudience[];
  generate(request: OutfitImageGenerationRequest): Promise<OutfitImageGeneration>;
}
