/**
 * Domain enums shared across the StylAIze frontend and backend.
 * Keep these in sync with the API's domain layer (apps/api/src/domain/enums).
 */

export const EVENT_CATEGORIES = [
  "wedding",
  "job_interview",
  "office_meeting",
  "birthday_party",
  "college_farewell",
  "date_night",
  "festival",
  "beach_trip",
  "business_conference",
  "gym",
  "travel",
  "dinner",
  "funeral",
  "sports_match",
  "concert",
  "graduation",
  "religious_ceremony",
  "casual_outing",
  "other",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_SOURCES = [
  "manual",
  "invitation_image",
  "invitation_pdf",
  "whatsapp_screenshot",
  "instagram_invitation",
  "calendar",
  "event_poster",
  "saved_outfit",
] as const;

export type EventSource = (typeof EVENT_SOURCES)[number];

export const PHOTO_TYPES = [
  "full_body",
  "upper_body",
  "face_only",
  "group_photo",
  "side_view",
  "low_quality",
  "blurry",
  "none",
] as const;

export type PhotoType = (typeof PHOTO_TYPES)[number];

export const GENDERS = ["male", "female", "non_binary", "other"] as const;
export type Gender = (typeof GENDERS)[number];

/** Audience values returned by verified shopping product feeds. */
export const SHOP_AUDIENCES = ["men", "women", "unisex", "all"] as const;
export type ShopAudience = (typeof SHOP_AUDIENCES)[number];

/** Audience values a user may explicitly choose for a generated look. */
export const BUILD_LOOK_AUDIENCES = ["men", "women", "unisex"] as const;
export type BuildLookAudience = (typeof BUILD_LOOK_AUDIENCES)[number];

/** Style signals that a provider must explicitly return or that appear in its title/category. */
export const SHOP_STYLE_TAGS = [
  "traditional",
  "western",
  "formal",
  "casual",
  "ethnic",
  "sports",
] as const;
export type ShopStyleTag = (typeof SHOP_STYLE_TAGS)[number];

export const SHOPPING_PROVIDER_STATES = [
  "connected",
  "not_configured",
  "approval_required",
  "authentication_failed",
  "temporarily_unavailable",
  "verification_pending",
] as const;
export type ShoppingProviderState = (typeof SHOPPING_PROVIDER_STATES)[number];

export const OUTFIT_CATEGORIES = [
  "casual",
  "smart_casual",
  "formal",
  "business",
  "party",
  "ethnic",
  "beach",
  "sport",
  "travel",
] as const;
export type OutfitCategory = (typeof OUTFIT_CATEGORIES)[number];

export const OUTFIT_ITEM_TYPES = [
  "shirt",
  "dress",
  "top",
  "trousers",
  "jeans",
  "skirt",
  "shoes",
  "watch",
  "belt",
  "accessory",
  "perfume",
  "hairstyle",
  "beard_style",
  "outerwear",
  "bag",
] as const;
export type OutfitItemType = (typeof OUTFIT_ITEM_TYPES)[number];

/**
 * Build Your Look describes each garment by the slot it fills rather than by a
 * concrete garment type. These slots are deliberately coarser than
 * `OUTFIT_ITEM_TYPES`, so anything that carries a Build Your Look item into the
 * shared outfit vocabulary (saving to the library, sustainability, ...) must
 * translate through `BUILD_LOOK_CATEGORY_TO_ITEM_TYPE`.
 */
export const BUILD_LOOK_CATEGORIES = [
  "upperwear",
  "lowerwear",
  "footwear",
  "accessories",
] as const;
export type BuildLookCategory = (typeof BUILD_LOOK_CATEGORIES)[number];

export const BUILD_LOOK_CATEGORY_TO_ITEM_TYPE: Record<
  BuildLookCategory,
  OutfitItemType
> = {
  upperwear: "top",
  lowerwear: "trousers",
  footwear: "shoes",
  accessories: "accessory",
};

/** Where a saved outfit came from. */
export const SAVED_OUTFIT_SOURCES = ["ai", "manual", "build_your_look"] as const;
export type SavedOutfitSource = (typeof SAVED_OUTFIT_SOURCES)[number];

/**
 * Grooming plan categories. Each category is deliberately non-medical: these
 * are styling suggestions only, never diagnosis or treatment advice.
 */
export const GROOMING_CATEGORIES = [
  "hair",
  "facial",
  "skin",
  "accessory",
  "fragrance",
] as const;
export type GroomingCategory = (typeof GROOMING_CATEGORIES)[number];

/**
 * Allowed style-profile values. These enums are the single source of truth for
 * both AI-output validation and the editable profile chips in the web app.
 */
export const FACE_SHAPES = [
  "oval",
  "round",
  "square",
  "heart",
  "diamond",
  "oblong",
  "triangle",
] as const;
export type FaceShape = (typeof FACE_SHAPES)[number];

export const HAIR_TYPES = ["straight", "wavy", "curly", "coily"] as const;
export type HairType = (typeof HAIR_TYPES)[number];

export const HAIR_LENGTHS = ["short", "medium", "long"] as const;
export type HairLength = (typeof HAIR_LENGTHS)[number];

export const SKIN_UNDERTONES = ["warm", "cool", "neutral", "olive"] as const;
export type SkinUndertone = (typeof SKIN_UNDERTONES)[number];

export const BODY_BUILDS = [
  "slim",
  "athletic",
  "average",
  "curvy",
  "broad",
] as const;
export type BodyBuild = (typeof BODY_BUILDS)[number];

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const AI_PROVIDERS = [
  "gemini",
  "openai",
  "qwen",
  "llama",
  "gemma",
  "mock",
] as const;
export type AIProvider = (typeof AI_PROVIDERS)[number];

export const VTON_PROVIDERS = ["idm_vton", "catvton", "mock"] as const;
export type VTONProvider = (typeof VTON_PROVIDERS)[number];

export const STORAGE_PROVIDERS = ["cloudinary", "local", "mock"] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

export const PRICE_ALERT_CONDITIONS = [
  "price_drop",
  "discount_appears",
  "coupon_available",
  "back_in_stock",
  "size_available",
] as const;
export type PriceAlertCondition = (typeof PRICE_ALERT_CONDITIONS)[number];

export const ALERT_CHANNELS = ["push", "email", "whatsapp"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export const NOTIFICATION_TYPES = [
  "price_drop",
  "discount",
  "coupon",
  "back_in_stock",
  "size_available",
  "event_reminder",
  "outfit_reminder",
  "shopping_reminder",
  "packing_reminder",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const WARDROBE_CATEGORIES = [
  "tops",
  "bottoms",
  "outerwear",
  "dresses",
  "footwear",
  "accessories",
  "bags",
  "ethnic",
  "sportswear",
] as const;
export type WardrobeCategory = (typeof WARDROBE_CATEGORIES)[number];

export const PACKING_CATEGORIES = [
  "clothing",
  "shoes",
  "accessories",
  "toiletries",
  "tech",
  "documents",
  "misc",
] as const;
export type PackingCategory = (typeof PACKING_CATEGORIES)[number];

export const OCCASION_PRESETS = [
  { value: "wedding", label: "Wedding", icon: "rings" },
  { value: "job_interview", label: "Job Interview", icon: "briefcase" },
  { value: "office_meeting", label: "Office Meeting", icon: "building" },
  { value: "birthday_party", label: "Birthday Party", icon: "gift" },
  { value: "college_farewell", label: "College Farewell", icon: "graduation" },
  { value: "date_night", label: "Date Night", icon: "heart" },
  { value: "festival", label: "Festival", icon: "sparkles" },
  { value: "beach_trip", label: "Beach Trip", icon: "waves" },
  { value: "business_conference", label: "Business Conference", icon: "presentation" },
  { value: "gym", label: "Gym", icon: "dumbbell" },
  { value: "travel", label: "Travel", icon: "plane" },
] as const;

export const OTP_PURPOSES = [
  "login",
  "email_verification",
  "mobile_verification",
  "password_reset",
  "forgot_email",
] as const;
export type OTPPurpose = (typeof OTP_PURPOSES)[number];
