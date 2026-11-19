import type { ShopAudience, ShopStyleTag } from "@stylaiize/shared";

export interface GarmentModelAsset {
  id: string;
  bodyModelId: string;
  category: string;
  audience: ShopAudience;
  styleTags: ShopStyleTag[];
  path: string;
  license: string;
  licenseUrl: string;
  requiresSharedSkeleton: true;
  requiresSkinWeights: true;
}

export const GARMENT_MODEL_ASSETS: GarmentModelAsset[] = [];

export const GARMENT_REPLACEMENT_STATUS = {
  supported: false,
  reason:
    "Actual 3D garment replacement needs skinned garment GLBs fitted to the selected model's skeleton. No licensed fitted garment assets are provisioned.",
} as const;

export function findFittedGarmentAssets(bodyModelId: string, category: string): GarmentModelAsset[] {
  return GARMENT_MODEL_ASSETS.filter(
    (asset) => asset.bodyModelId === bodyModelId && asset.category === category,
  );
}
