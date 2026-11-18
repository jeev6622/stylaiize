/**
 * Frontend API client.
 * Talks to the StylAIze Express API, attaching the access token from
 * localStorage when present and normalizing the JSON envelope
 * { success, data | error }.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Resolves API-relative asset paths (e.g. authenticated try-on images) to the
 * API origin. Absolute URLs are returned unchanged.
 */
export function resolveApiUrl(
  pathOrUrl: string | null | undefined,
): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${API_BASE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

const ACCESS_TOKEN_KEY = "stylaiize_access_token";
const REFRESH_TOKEN_KEY = "stylaiize_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    code = "API_ERROR",
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipAuth?: boolean;
  timeoutMs?: number;
}

const inFlightRequests = new Map<string, Promise<unknown>>();

function safeRequestKey(
  method: string,
  path: string,
  headers: Headers,
): string {
  return [
    method,
    path,
    headers.get("authorization") ?? "",
    headers.get("content-type") ?? "",
  ].join("|");
}

async function performRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    body,
    skipAuth = false,
    timeoutMs = 60_000,
    headers,
    ...rest
  } = options;

  const finalHeaders = new Headers(headers);
  finalHeaders.set("Accept", "application/json");
  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders.set("Content-Type", "application/json");
  }

  const token = getAccessToken();
  if (token && !skipAuth) {
    finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? ((await res.json()) as {
          success: boolean;
          data?: unknown;
          error?: { code?: string; message?: string; fieldErrors?: Record<string, string[]> };
        })
      : null;

    if (!res.ok) {
      throw new ApiError(
        payload?.error?.message ?? `Request failed with status ${res.status}`,
        res.status,
        payload?.error?.code,
        payload?.error?.fieldErrors,
      );
    }

    return (payload?.data ?? payload) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Distinguish timeouts from connection failures so the caller can show
    // the actual reason instead of a generic fallback message.
    const timedOut = controller.signal.aborted;
    const detail =
      err instanceof Error && err.name === "TimeoutError" ? "request timed out" : err instanceof Error ? err.message : "";
    const message = timedOut
      ? "The request timed out. Please check your internet connection and try again."
      : `Unable to reach the server at ${API_BASE_URL}. Is the API running?`;
    throw new ApiError(
      detail && !timedOut && detail !== "Failed to fetch" ? `Unable to reach the API (${detail}).` : message,
      0,
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Same GET/HEAD request made twice in one render (StrictMode, two effects,
 * duplicated deep-link handling) shares a single network call.
 */
export async function api<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return performRequest<T>(path, options);
  }

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAccessToken();
  if (token && !options.skipAuth) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const key = safeRequestKey(method, path, headers);
  const existing = inFlightRequests.get(key);
  if (existing) return existing as Promise<T>;

  const request = performRequest<T>(path, options);
  inFlightRequests.set(key, request);
  const cleanup = () => {
    if (inFlightRequests.get(key) === request) inFlightRequests.delete(key);
  };
  void request.then(cleanup, cleanup);
  return request;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    api<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    api<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    api<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    api<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    api<T>(path, { ...options, method: "DELETE" }),
};
