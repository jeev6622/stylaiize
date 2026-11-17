export const APP_NAME = "StylAIze";
export const APP_TAGLINE = "See it. Style it. Buy it for less.";
export const APP_DESCRIPTION =
  "StylAIze is your AI personal stylist. Tell it where you're going, upload a photo, and get a complete personalized look — styled, shoppable, and budget-aware.";

export const API_V1_PREFIX = "/api/v1";

export const API_ENDPOINTS = {
  health: `${API_V1_PREFIX}/health`,
  auth: {
    config: `${API_V1_PREFIX}/auth/config`,
    register: `${API_V1_PREFIX}/auth/register`,
    login: `${API_V1_PREFIX}/auth/login`,
    refresh: `${API_V1_PREFIX}/auth/refresh`,
    logout: `${API_V1_PREFIX}/auth/logout`,
    me: `${API_V1_PREFIX}/auth/me`,
    google: `${API_V1_PREFIX}/auth/google`,
    sendOtp: `${API_V1_PREFIX}/auth/otp/send`,
    verifyOtp: `${API_V1_PREFIX}/auth/otp/verify`,
    forgotPassword: `${API_V1_PREFIX}/auth/forgot-password`,
    resetPassword: `${API_V1_PREFIX}/auth/reset-password`,
    forgotEmail: `${API_V1_PREFIX}/auth/forgot-email`,
  },
  chat: {
    base: `${API_V1_PREFIX}/chat`,
    conversations: `${API_V1_PREFIX}/chat/conversations`,
  },
  savedOutfits: `${API_V1_PREFIX}/outfits`,
  recommend: `${API_V1_PREFIX}/recommend`,

  products: `${API_V1_PREFIX}/products`,
  compare: `${API_V1_PREFIX}/products/compare`,
  buildYourLook: {
    base: `${API_V1_PREFIX}/build-look`,
    generate: `${API_V1_PREFIX}/build-look/generate`,
    replaceItem: `${API_V1_PREFIX}/build-look/replace-item`,
    addItem: `${API_V1_PREFIX}/build-look/add-item`,
  },
  tryon: `${API_V1_PREFIX}/tryon`,
  tryonStatus: `${API_V1_PREFIX}/tryon/status`,
  tryonHealth: `${API_V1_PREFIX}/tryon/health`,
  tryonJobs: `${API_V1_PREFIX}/tryon/jobs`,
  tryonResults: `${API_V1_PREFIX}/tryon/results`,
  styleProfile: {
    analyze: `${API_V1_PREFIX}/style-profile/analyze`,
  },
  alerts: `${API_V1_PREFIX}/alerts`,
  wardrobe: `${API_V1_PREFIX}/wardrobe`,
  wardrobeUpload: `${API_V1_PREFIX}/wardrobe/upload`,
  wardrobeCategorize: `${API_V1_PREFIX}/wardrobe/categorize`,
  memory: `${API_V1_PREFIX}/memory`,
  memoryStyleProfile: `${API_V1_PREFIX}/memory/style-profile`,
  packing: `${API_V1_PREFIX}/packing`,
  sustainability: `${API_V1_PREFIX}/sustainability`,
  calendar: `${API_V1_PREFIX}/calendar`,
  couple: `${API_V1_PREFIX}/couple`,
  group: `${API_V1_PREFIX}/group`,
  dashboard: `${API_V1_PREFIX}/dashboard`,
  account: {
    base: `${API_V1_PREFIX}/account`,
    changePassword: `${API_V1_PREFIX}/account/change-password`,
    deviceTokens: `${API_V1_PREFIX}/account/device-tokens`,
    notificationStatus: `${API_V1_PREFIX}/account/notifications/status`,
  },
  admin: `${API_V1_PREFIX}/admin`,
} as const;

export const DEFAULT_CURRENCY = "INR";

export const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"] as const;

export const PRICE_FORMATS: Record<(typeof SUPPORTED_CURRENCIES)[number], string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ",
};
