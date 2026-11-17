/**
 * Core domain types shared across the StylAIze monorepo.
 * These describe the entities and value objects used by every phase
 * (recommendations, shopping, wardrobe, calendar, alerts, ...).
 */
import type {
  AlertChannel,
  AIProvider,
  BodyBuild,
  EventCategory,
  EventSource,
  FaceShape,
  Gender,
  GroomingCategory,
  HairLength,
  HairType,
  OutfitCategory,
  OutfitItemType,
  OTPPurpose,
  PackingCategory,
  PhotoType,
  PriceAlertCondition,
  SavedOutfitSource,
  SkinUndertone,
  StorageProvider,
  UserRole,
  VTONProvider,
  WardrobeCategory,
} from "../enums";

// ---------------------------------------------------------------------------
// Users & Auth
// ---------------------------------------------------------------------------

export interface UserPreferences {
  budgetRange: { min: number; max: number } | null;
  favoriteColors: string[];
  favoriteBrands: string[];
  sizes: Partial<Record<"tops" | "bottoms" | "shoes" | "waist" | "chest", string>>;
  stylePreferences: string[];
  notificationChannels: AlertChannel[];
  emailNotifications: boolean;
  pushNotifications: boolean;
  /**
   * FCM registration tokens for this user's devices. Populated via
   * `POST /account/device-tokens`; price-alert and reminder notifications are
   * pushed to these when `pushNotifications` is enabled.
   */
  deviceTokens: string[];
  units: "metric" | "imperial";
}

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  countryCode: string | null;
  avatarUrl: string | null;
  role: UserRole;
  emailVerified: boolean;
  mobileVerified: boolean;
  providers: ("email" | "google")[];
  googleId?: string | null;
  passwordHash?: string | null;
  gender?: Gender | null;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface WeatherInfo {
  condition: string;
  temperatureC: number;
  feelsLikeC: number;
  humidity: number;
  windSpeedKph: number;
  chanceOfRain: number;
  isRainy: boolean;
  isHot: boolean;
  isCold: boolean;
  season: "spring" | "summer" | "autumn" | "winter";
}

export interface EventDetails {
  name: string;
  date: string | null; // ISO date
  time: string | null;
  venue: string | null;
  dressCode: string | null;
  theme: string | null;
  weather: WeatherInfo | null;
  indoorOutdoor: "indoor" | "outdoor" | "unknown";
  category: EventCategory;
  source: EventSource;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Image & body analysis
// ---------------------------------------------------------------------------

export interface PhotoAnalysisResult {
  photoType: PhotoType;
  quality: number; // 0-100
  confidence: number; // 0-100
  detectedPeople: number;
  issues: string[];
}

export interface BodyAnalysis {
  faceShape: string;
  skinTone: string;
  undertone: "warm" | "cool" | "neutral";
  bodyProportion: string;
  hair: { length: string; type: string; color: string };
  beard: { style: string; density: string };
  heightEstimateCm: number | null;
  fashionStyle: string;
  seasonalPalette: string;
}

/**
 * Styling-only profile derived from an optional photo. It deliberately does
 * not contain age, gender, ethnicity, religion, health, disability or identity
 * inference - only attributes used to suggest colours and grooming.
 */
export interface StyleProfile {
  faceShape?: FaceShape;
  hairType?: HairType;
  hairLength?: HairLength;
  undertone?: SkinUndertone;
  bodyBuild?: BodyBuild;
  paletteSuggestions: string[];
  /** Model confidence, clamped to 0-1. */
  confidence: number;
  /** True once the user has corrected the AI suggestion. */
  userEdited: boolean;
}

// ---------------------------------------------------------------------------
// Outfits & recommendations
// ---------------------------------------------------------------------------

export interface OutfitScores {
  fashion: number; // 0-100
  eventMatch: number; // 0-100
  comfort: number; // 0-100
  budget: number; // 0-100
}

export interface OutfitItem {
  type: OutfitItemType;
  name: string;
  brand?: string | null;
  color: string;
  price?: number | null;
  currency: string;
  buyUrl?: string | null;
  imageUrl?: string | null;
  reason?: string;
}

export interface Outfit {
  id: string;
  name: string;
  category: OutfitCategory;
  items: OutfitItem[];
  scores: OutfitScores;
  totalCost: number | null;
  explanation: string;
  tryOnUrl: string | null;
  createdAt: string;
}

export interface RecommendationRequest {
  event: EventDetails;
  photo: string | null; // image url or data-url
  userId: string | null;
}

export interface RecommendationResponse {
  outfits: Outfit[];
  analysis: BodyAnalysis | null;
  summary: string;
}

// ---------------------------------------------------------------------------
// Shopping engine
// ---------------------------------------------------------------------------

export interface Product {
  id: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  price: number;
  originalPrice: number | null;
  currency: string;
  discountPercent: number | null;
  rating: number | null;
  reviewCount: number | null;
  store: string;
  deliveryEstimateDays: { min: number; max: number } | null;
  buyUrl: string;
  category: string;
  colors: string[];
  sizes: string[];
  inStock: boolean;
}

export interface PriceComparisonEntry {
  product: Product;
  isLowestPrice: boolean;
  isHighestRated: boolean;
  isFastestDelivery: boolean;
  isBestValue: boolean;
}

export interface PriceComparison {
  canonicalTitle: string;
  entries: PriceComparisonEntry[];
}

// ---------------------------------------------------------------------------
// Wardrobe
// ---------------------------------------------------------------------------

export interface WardrobeItem {
  id: string;
  userId: string;
  name: string;
  category: WardrobeCategory;
  color: string;
  imageUrl: string | null;
  /**
   * Storage-provider id for `imageUrl` (e.g. the Cloudinary public id).
   * Internal: never accepted from clients. Needed to delete the asset when the
   * image is replaced or the item is removed.
   */
  imagePublicId?: string | null;
  brand: string | null;
  purchasedPrice: number | null;
  timesWorn: number;
  lastWornAt: string | null;
  costPerWear: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Wardrobe {
  items: WardrobeItem[];
  moneySaved: number;
  wardrobeUtilization: number; // 0-100
  totalItems: number;
  itemsUsed: number;
}

// ---------------------------------------------------------------------------
// Fashion memory
// ---------------------------------------------------------------------------

export interface FashionMemory {
  id: string;
  userId: string;
  previousOutfits: { outfitId: string; eventId: string; wornAt: string }[];
  attendedEvents: string[];
  favoriteBrands: string[];
  favoriteColors: string[];
  budget: { min: number; max: number } | null;
  sizes: Partial<Record<string, string>>;
  shoppingHistory: { productId: string; purchasedAt: string; price: number }[];
  wardrobeOwned: string[];
  /** Saved only after the user explicitly opts in. */
  styleProfile: StyleProfile | null;
}

// ---------------------------------------------------------------------------
// Packing assistant
// ---------------------------------------------------------------------------

export interface PackingItem {
  id: string;
  name: string;
  category: PackingCategory;
  quantity: number;
  essential: boolean;
  packed: boolean;
}

export interface PackingList {
  id: string;
  userId: string;
  title: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  items: PackingItem[];
  weatherBasedAdjustments: string[];
  activities: string[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Price alerts & notifications
// ---------------------------------------------------------------------------

export interface PriceAlert {
  id: string;
  userId: string;
  productId: string;
  targetPrice: number | null;
  conditions: PriceAlertCondition[];
  channels: AlertChannel[];
  status: "active" | "triggered" | "expired";
  triggeredAt: string | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  eventCategory: EventCategory | null;
  dressCode: string | null;
  isOutfitPlanned: boolean;
  reminderDays: number[];
}

// ---------------------------------------------------------------------------
// Grooming
// ---------------------------------------------------------------------------

/** One occasion-appropriate grooming suggestion. Styling advice only. */
export interface GroomingItem {
  category: GroomingCategory;
  title: string;
  why: string;
  tip: string;
  estimatedPriceInr?: number;
}

/** A complete set of grooming suggestions (4-6 items) for an event. */
export interface GroomingPlan {
  items: GroomingItem[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Saved outfits
// ---------------------------------------------------------------------------

export interface SavedOutfit {
  id: string;
  userId: string;
  name: string;
  category: OutfitCategory;
  occasion: string | null;
  style: string | null;
  colors: string[];
  budget: number | null;
  items: OutfitItem[];
  scores: OutfitScores | null;
  totalCost: number | null;
  imageUrl: string | null;
  explanation: string | null;
  grooming: GroomingPlan | null;
  source: SavedOutfitSource; // AI recommendation, Build Your Look, or hand-made
  createdAt: string;
  updatedAt: string;
}

export interface VirtualTryOnRequest {
  personImage: string;
  garmentImage: string;
  category?: string;
}

export interface VirtualTryOnResult {
  /** True when a real provider ran and returned an image. */
  configured: boolean;
  /** Authenticated API image URL (provider URLs are never exposed). */
  resultImageUrl: string | null;
  /** Backend id of the stored result, used for "save" actions. */
  resultId?: string | null;
  provider: VTONProvider;
  demoMode: boolean;
  processingTimeMs: number | null;
  /** 'success' when an image was produced; otherwise a technical error/needs-config message. */
  status?: "success" | "not_configured" | "error";
  /** True when no real provider was configured and no request was attempted. */
  needsConfig?: boolean;
  message?: string;
}

export type VirtualTryOnJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "not_configured";

/**
 * Stages reported by the inference service. Providers that cannot report
 * progress use `running` only; the client must not invent a percentage.
 */
export type VirtualTryOnJobStage =
  | "queued"
  | "loading_model"
  | "validating"
  | "masking"
  | "pose"
  | "encoding"
  | "diffusion"
  | "decoding"
  | "saving"
  | "running"
  | "done";

/** Live progress for an asynchronous try-on job. */
export interface VirtualTryOnJob {
  id: string;
  userId: string;
  provider: VTONProvider | null;
  status: VirtualTryOnJobStatus;
  stage: VirtualTryOnJobStage;
  /** Real progress from the inference service, 0-100. */
  progress: number;
  /** False for legacy synchronous providers that only report running/done. */
  progressSupported: boolean;
  message: string;
  error?: string | null;
  resultId?: string | null;
  /** Authenticated API image URL after the result is persisted. */
  resultImageUrl?: string | null;
  processingTimeMs?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** A persisted virtual try-on result owned by a user. */
export interface TryOnResultRecord {
  id: string;
  userId: string;
  provider: VTONProvider;
  category?: string | null;
  /** Raw base64 person image (for "use in wardrobe/outfit" flows). */
  personImage?: string | null;
  /** Raw base64 garment image. */
  garmentImage?: string | null;
  garmentLabel?: string | null;
  /** Base64 image data of the generated try-on. */
  resultImage?: string | null;
  /** MIME type of the generated image. */
  mimeType?: string | null;
  /** Provider URL when the backend returned one. */
  sourceUrl?: string | null;
  processingTimeMs?: number | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Sustainability
// ---------------------------------------------------------------------------

export interface SustainabilityReport {
  ecoScore: number; // 0-100
  carbonSavedKg: number;
  moneySaved: number;
  itemsReused: number;
  mixAndMatchOutfits: number;
  costPerWearAverage: number;
}

// ---------------------------------------------------------------------------
// Couples & groups
// ---------------------------------------------------------------------------

export interface GroupMemberProfile {
  id: string;
  name: string;
  photo: string | null;
  bodyAnalysis: BodyAnalysis | null;
  preferredColors: string[];
}

export interface CoupleStyle {
  memberA: GroupMemberProfile;
  memberB: GroupMemberProfile;
  colorPalette: { name: string; colors: string[] };
  matchingOutfits: { person: "A" | "B"; outfit: Outfit }[];
  sharedShoppingList: OutfitItem[];
}

export interface GroupStyle {
  members: GroupMemberProfile[];
  colorPalette: { name: string; colors: string[] };
  theme: string;
  outfits: { memberId: string; outfit: Outfit }[];
  shoppingList: OutfitItem[];
}

// ---------------------------------------------------------------------------
// OTP & Account Recovery
// ---------------------------------------------------------------------------

export interface OTPRecord {
  id: string;
  userId: string | null;
  email: string | null;
  mobile: string | null;
  countryCode: string | null;
  codeHash: string;
  purpose: OTPPurpose;
  attempts: number;
  maxAttempts: number;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  context: Record<string, unknown>;
  images?: Array<{ mimeType: string; data: string }>;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string | null;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Build Your Look
// ---------------------------------------------------------------------------

export const BUILD_LOOK_STYLES = [
  "classic",
  "modern",
  "luxury",
  "minimal",
  "streetwear",
  "traditional",
] as const;

export const BUILD_LOOK_BUDGETS = ["2000", "5000", "10000", "premium"] as const;

export type BuildLookStyle = (typeof BUILD_LOOK_STYLES)[number];
export type BuildLookBudget = (typeof BUILD_LOOK_BUDGETS)[number];

/** A single curated piece in a Build-Your-Look outfit. Produced by the AI stylist. */
export interface BuildYourLookItem {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  brand: string | null;
  material: string;
  color: string;
  size: string;
  price: number;
  originalPrice: number;
  rating: number;
  store: string;
  /** Matches the front-end model categories: upperwear | lowerwear | footwear | accessories */
  category: string;
  imageUrl: string | null;
}

export interface BuildYourLookData {
  eventName: string;
  styleName: string;
  styleMatch: number;
  eventMatch: number;
  originalTotal: number;
  optimizedTotal: number;
  savings: number;
  items: BuildYourLookItem[];
}

export interface BuildYourLookGenerateRequest {
  eventName: string;
  occasion?: string;
  dressCode?: string;
  style: BuildLookStyle;
  budget: BuildLookBudget;
  colors?: string[];
  fit?: string;
  brand?: string;
  season?: string;
  /** Include occasion-matched grooming suggestions. Defaults to true. */
  includeGrooming?: boolean;
  /** Optional styling-only profile from the photo analysis step. */
  styleProfile?: StyleProfile;
}

export interface BuildYourLookGenerateResponse {
  look: BuildYourLookData;
  /** Present only when grooming was requested. */
  grooming?: GroomingPlan;
}

export interface BuildYourLookItemReplaceRequest {
  /** The complete current look so the AI can recompose it with one item swapped. */
  currentItems: BuildYourLookItem[];
  itemId: string;
  style?: BuildLookStyle;
  budget?: BuildLookBudget;
  reason?: string;
}

export interface BuildYourLookAddItemRequest {
  currentItems: BuildYourLookItem[];
  style?: BuildLookStyle;
  budget?: BuildLookBudget;
  category?: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Provider configuration surface (API health/status)
// ---------------------------------------------------------------------------

export interface ProviderStatus {
  /** `active: "none"` means no AI provider has usable credentials. */
  ai: { active: AIProvider | "none"; demoMode: boolean; configured: boolean };
  database: { active: boolean; demoMode: boolean };
  storage: { active: StorageProvider; demoMode: boolean };
  vton: { active: VTONProvider; demoMode: boolean };
  email: { active: boolean; demoMode: boolean };
  /**
   * `active: "none"` means the live catalog is pinned but unconfigured.
   * `demoMode: true` means results come from the sample catalog, not live
   * listings — the UI must disclose this.
   */
  shopping: { active: "real" | "mock" | "none"; demoMode: boolean; configured: boolean };
  notification: { active: boolean; demoMode: boolean };
}
