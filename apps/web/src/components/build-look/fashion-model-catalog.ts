export type FashionModelId = "female-formal" | "male-formal";

export type FashionView = "front" | "side" | "back";
export type FashionModelGroup = "Women" | "Men";

export interface FashionModelAsset {
  id: FashionModelId;
  label: string;
  group: FashionModelGroup;
  description: string;
  skinTone: string;
  bodyType: string;
  outfitStyle: string;
  path: string;
  fileName: string;
  facingYaw: number;
}

export interface FashionLicenseRecord {
  fileName: string;
  identifier: string;
  name: string;
  holder: string;
  source: string;
}

export const FASHION_MODEL_LICENSE_FILE = "/models/LICENSES.txt";
export const FASHION_MODEL_ACCEPTED_LICENSES = ["CC0-1.0", "CC-BY-4.0"] as const;
export const FASHION_MODEL_LICENSE_FORMAT =
  "filename | license identifier | model name | copyright holder | source URL";

export const FASHION_MODEL_REQUIREMENTS = [
  "Single adult human, full body, natural proportions, realistic face, eyes, nose, lips, ears, hands, fingers, hair and skin.",
  "Clothed in a real outfit with PBR fabric materials; no mannequins, primitives, robots, cartoons or abstract stand-ins.",
  "glTF 2.0 binary GLB with embedded or same-folder PBR textures; no broken or externally hotlinked texture paths.",
  "Feet at y = 0, facing +Z, approximately 1.7-1.85 m tall, relaxed standing pose.",
  "Named meshes for body, hair, upperwear, lowerwear, footwear and accessories so hotspots and highlights align.",
] as const;

export const FASHION_MODEL_ASSETS: readonly FashionModelAsset[] = [
  {
    id: "female-formal",
    label: "Woman · Tailored",
    group: "Women",
    description: "Harper, an adult woman in a tailored business suit.",
    skinTone: "unspecified",
    bodyType: "standard",
    outfitStyle: "tailored businesswear",
    path: "/models/female-fashion-model.glb",
    fileName: "female-fashion-model.glb",
    facingYaw: 0,
  },
  {
    id: "male-formal",
    label: "Man · Casual",
    group: "Men",
    description: "Daniel, an adult man in a field jacket, striped shirt, jeans and shoes.",
    skinTone: "unspecified",
    bodyType: "standard",
    outfitStyle: "smart casual separates",
    path: "/models/male-fashion-model.glb",
    fileName: "male-fashion-model.glb",
    facingYaw: 0,
  },
];

export const VIEW_YAW: Record<FashionView, number> = {
  front: 0,
  side: Math.PI / 2,
  back: Math.PI,
};

export function getFashionModelAsset(id: FashionModelId): FashionModelAsset {
  const asset = FASHION_MODEL_ASSETS.find((item) => item.id === id);
  if (!asset) throw new Error(`Unknown fashion model: ${id}`);
  return asset;
}

export function fileNameFromPath(path: string): string {
  return path.split("/").pop() ?? path;
}

export function categorizeFashionMesh(
  name: string | undefined,
  hint?: unknown,
): "body" | "upperwear" | "lowerwear" | "footwear" | "accessories" {
  const value = `${name ?? ""} ${typeof hint === "string" ? hint : ""}`.toLowerCase();
  if (/jacket|blazer|coat|suit|shirt|t-shirt|tshirt|top|blouse|hoodie|knit|sweater|dress|gown|vest/.test(value)) {
    return "upperwear";
  }
  if (/trouser|pant|jeans|bottom|skirt|short|denim|legging|chino/.test(value)) return "lowerwear";
  if (/shoe|loafer|boot|sneaker|trainer|sandal|heel|slipper/.test(value)) return "footwear";
  if (/belt|watch|accessory|accessories|bag|jewel|necklace|earring|scarf|glasses|sunglass/.test(value)) {
    return "accessories";
  }
  return "body";
}
