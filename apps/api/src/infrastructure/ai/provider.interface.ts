import type { AIProvider } from "@stylaiize/shared";

/** The kinds of work the AI service can perform across the platform. */
export type AITask =
  | "chat"
  | "detect_event"
  | "analyze_photo"
  | "analyze_body"
  | "recommend_outfits"
  | "extract_wardrobe"
  | "packing_list"
  | "sustainability"
  | "couple_style"
  | "group_style"
  | "price_summary"
  | "teaching"
  | "build_your_look"
  | "build_your_look_replace"
  | "build_your_look_add"
  | "analyze_style_profile";

export interface AIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIImagePart {
  mimeType: string;
  /** Base64-encoded image data (no data-uri prefix). */
  data: string;
}

export interface AIRequest {
  task: AITask;
  messages: AIChatMessage[];
  images?: AIImagePart[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Ask the provider to return strict JSON (schema-described in the prompt). */
  json?: boolean;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AIResponse {
  text: string;
  usage?: AIUsage;
  raw?: unknown;
}

/**
 * Port: every AI provider must implement this interface.
 * Swap providers via the factory (config) without touching business logic.
 */
export interface AIProviderPort {
  readonly name: AIProvider;
  readonly isConfigured: boolean;
  readonly description: string;
  chat(req: AIRequest): Promise<AIResponse>;
  /**
   * Yields text deltas as the model produces them. Powers SSE chat so the
   * browser renders tokens incrementally instead of one blob at the end.
   */
  stream(req: AIRequest): AsyncGenerator<string, void, unknown>;
}

export const AI_SYSTEM_CONTEXT =
  "You are StylAIze, an expert AI fashion stylist. You give specific, actionable, " +
  "and budget-aware style advice. Always explain the reasoning behind every " +
  "recommendation in simple language. Prefer reusing clothes the user already owns " +
  "before suggesting purchases. Be warm, concise, and practical.";
