/**
 * Shared VTON request/response helpers.
 * Keeps provider payload formats consistent: base64 images are forwarded as
 * raw base64 (no data-URL prefix) since most inference backends expect that,
 * and result payloads are parsed across the common response shapes.
 */
import { env } from "@/config/env";
import { BadRequestError } from "@/utils/errors";

export interface ParsedResult {
  /** Absolute URL straight from the backend (best display source). */
  imageUrl: string | null;
  /** Raw base64 image data (no data-URL prefix). */
  imageData: string | null;
  mimeType: string | null;
}

export interface NormalizedImage {
  /** Raw base64 image data (no data-URL prefix). */
  base64: string;
  mimeType: string;
  /** Decoded size in bytes. */
  byteLength: number;
}

export interface RemoteImage {
  base64: string;
  mimeType: string;
  byteLength: number;
}

/** Categories understood by IDM-VTON / CatVTON. */
export type VtonCategory = "upper_body" | "lower_body" | "dresses";

const DATA_URL_RE = /^data:([^;,]+)?(;base64)?,(.*)$/is;
const SUPPORTED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

/** Returns raw base64 when `value` is a data URL, otherwise the value unchanged. */
export function toRawBase64(value: string): string {
  const match = DATA_URL_RE.exec(value);
  if (match && match[3]) return match[3];
  return value;
}

/** Extracts a mime type from a data URL or sniffs the base64 magic bytes. */
export function sniffMimeType(value: string, fallback = "image/png"): string {
  const match = DATA_URL_RE.exec(value);
  if (match && match[1]) return match[1].toLowerCase();
  const first = toRawBase64(value).replace(/\s+/g, "").slice(0, 3);
  if (first === "/9j") return "image/jpeg";
  if (first === "iVB") return "image/png";
  if (first === "R0l") return "image/gif";
  if (first === "Ukl") return "image/webp";
  return fallback;
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isBase64(value: string): boolean {
  const raw = toRawBase64(value).replace(/\s+/g, "");
  if (raw.length < 50) return false;
  return /^[A-Za-z0-9+/]*={0,2}$/.test(raw.slice(0, 1000)) && raw.length % 4 === 0;
}

function normalizeMime(value: string | undefined): string {
  return (value ?? "").split(";")[0].trim().toLowerCase();
}

/** Recursively scans a parsed JSON body for the first image-like value. */
function findImageValue(value: unknown, seen = new Set<unknown>()): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    if (isAbsoluteUrl(value) || isBase64(value)) return value;
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findImageValue(item, seen);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof value === "object") {
    if (seen.has(value)) return null;
    seen.add(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (/image|result|output|base64|url/i.test(key)) {
        const hit = findImageValue((value as Record<string, unknown>)[key], seen);
        if (hit) return hit;
      }
    }
    // Fall back to scanning every value for nested images.
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const hit = findImageValue((value as Record<string, unknown>)[key], seen);
      if (hit) return hit;
    }
    return null;
  }
  return null;
}

/**
 * Validates an uploaded image and converts it to raw base64.
 *
 * Only inline image data (data URL or raw base64) is accepted. Remote URLs are
 * rejected so a client cannot make the API server fetch arbitrary hosts
 * (SSRF), and the decoded size is capped before anything is forwarded.
 */
export function normalizeImage(
  value: string,
  options: { label: string; maxBytes?: number },
): NormalizedImage {
  const maxBytes = options.maxBytes ?? env.VTON_MAX_IMAGE_BYTES;
  const label = options.label;

  if (isAbsoluteUrl(value)) {
    throw new BadRequestError(
      `${label} must be uploaded as image data, not a remote URL.`,
      "VTON_INVALID_IMAGE",
    );
  }

  const dataUrl = DATA_URL_RE.exec(value);
  if (dataUrl && dataUrl[1]) {
    const declaredMime = normalizeMime(dataUrl[1]);
    if (!declaredMime.startsWith("image/")) {
      throw new BadRequestError(
        `${label} must be an image (JPEG, PNG or WebP).`,
        "VTON_INVALID_IMAGE",
      );
    }
    if (!SUPPORTED_IMAGE_MIME.has(declaredMime)) {
      throw new BadRequestError(
        `${label} uses an unsupported image type. Use JPEG, PNG or WebP.`,
        "VTON_INVALID_IMAGE",
      );
    }
  }

  const base64 = toRawBase64(value).replace(/\s+/g, "");
  if (!base64) {
    throw new BadRequestError(`${label} is empty.`, "VTON_INVALID_IMAGE");
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new BadRequestError(
      `${label} is not valid base64 image data.`,
      "VTON_INVALID_IMAGE",
    );
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new BadRequestError(
      `${label} could not be decoded as an image.`,
      "VTON_INVALID_IMAGE",
    );
  }
  if (buffer.length > maxBytes) {
    const limitMb = Math.floor(maxBytes / (1024 * 1024));
    throw new BadRequestError(
      `${label} is too large (max ${limitMb} MB).`,
      "VTON_IMAGE_TOO_LARGE",
    );
  }

  const mimeType = sniffMimeType(value);
  if (!SUPPORTED_IMAGE_MIME.has(mimeType)) {
    throw new BadRequestError(
      `${label} uses an unsupported image type. Use JPEG, PNG or WebP.`,
      "VTON_INVALID_IMAGE",
    );
  }

  return { base64, mimeType, byteLength: buffer.length };
}

/** Maps a StylAIze garment type onto the categories VTON models understand. */
export function toVtonCategory(category?: string): VtonCategory | undefined {
  switch (category) {
    case "dress":
      return "dresses";
    case "trousers":
    case "jeans":
    case "skirt":
      return "lower_body";
    case "shirt":
    case "top":
    case "outerwear":
      return "upper_body";
    default:
      return undefined;
  }
}

/** Human-readable list of categories supported by the try-on models. */
export const SUPPORTED_VTON_CATEGORIES = [
  "shirt",
  "top",
  "outerwear",
  "trousers",
  "jeans",
  "skirt",
  "dress",
] as const;

/** Turns any backend response (JSON text or binary body) into a usable image. */
export function parseResultBody(
  body: Buffer | string,
  contentType: string | null,
): ParsedResult {
  const text = Buffer.isBuffer(body) ? body.toString("utf8") : body;
  const normalizedContentType = normalizeMime(contentType ?? "") || null;

  // Raw image bytes returned directly (fastest path).
  if (Buffer.isBuffer(body) && normalizedContentType?.startsWith("image/")) {
    return {
      imageUrl: null,
      imageData: body.toString("base64"),
      mimeType: normalizedContentType,
    };
  }

  // The whole body might already be a base64 string or a URL.
  if (!text.startsWith("{")) {
    if (isBase64(text)) {
      return { imageUrl: null, imageData: toRawBase64(text), mimeType: sniffMimeType(text) };
    }
    if (isAbsoluteUrl(text.trim())) {
      return { imageUrl: text.trim(), imageData: null, mimeType: null };
    }
  }

  try {
    const parsed: unknown = JSON.parse(text);
    const found = findImageValue(parsed);
    if (found) {
      if (isAbsoluteUrl(found)) {
        return { imageUrl: found, imageData: null, mimeType: null };
      }
      return { imageUrl: null, imageData: toRawBase64(found), mimeType: sniffMimeType(found) };
    }
  } catch {
    // Not JSON; treat as an unparseable error payload.
  }
  return { imageUrl: null, imageData: null, mimeType: null };
}

/** True when we could not find any usable image inside a backend response. */
export function hasImage(result: ParsedResult): boolean {
  return Boolean(result.imageUrl || result.imageData);
}

/**
 * Downloads an image URL returned by a trusted inference provider.
 * Used to keep provider URLs (which may be private/signed) server-side.
 */
export async function fetchRemoteImage(
  url: string,
  options: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<RemoteImage> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("The provider returned an invalid result image URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("The provider returned a non-HTTP result image URL.");
  }

  const timeoutMs = options.timeoutMs ?? env.VTON_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? env.VTON_MAX_IMAGE_BYTES;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(parsed, {
      method: "GET",
      headers: { Accept: "image/*" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Result image download failed (HTTP ${res.status}).`);
    }
    const contentType = normalizeMime(res.headers.get("content-type") ?? "");
    if (!contentType.startsWith("image/")) {
      throw new Error("The provider result URL did not return an image.");
    }
    const declaredLength = Number(res.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new Error("The provider result image is too large.");
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) {
      throw new Error("The provider result image is empty.");
    }
    if (buffer.length > maxBytes) {
      throw new Error("The provider result image is too large.");
    }
    return {
      base64: buffer.toString("base64"),
      mimeType: contentType,
      byteLength: buffer.length,
    };
  } finally {
    clearTimeout(timeout);
  }
}
