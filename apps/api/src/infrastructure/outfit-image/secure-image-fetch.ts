import dns from "node:dns/promises";
import https from "node:https";
import net from "node:net";
import type { LookupAddress } from "node:dns";

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
]);

export class ImageFetchError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ImageFetchError";
    this.code = code;
  }
}

export interface SecureImageTarget {
  url: URL;
  agent: https.Agent;
}

export interface DownloadedAsset {
  buffer: Buffer;
  contentType: string;
  url: string;
}

export type DownloadedImage = DownloadedAsset;

function blockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    BLOCKED_HOSTNAMES.has(host) || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  );
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) | Number(part), 0) >>> 0;
}

function inIpv4Range(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

export function isBlockedIpAddress(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized.startsWith("::ffff:")) {
    return isBlockedIpAddress(normalized.slice(7));
  }
  if (net.isIPv4(normalized)) {
    return (
      inIpv4Range(normalized, "0.0.0.0", 8) ||
      inIpv4Range(normalized, "10.0.0.0", 8) ||
      inIpv4Range(normalized, "100.64.0.0", 10) ||
      inIpv4Range(normalized, "127.0.0.0", 8) ||
      inIpv4Range(normalized, "169.254.0.0", 16) ||
      inIpv4Range(normalized, "172.16.0.0", 12) ||
      inIpv4Range(normalized, "192.0.0.0", 24) ||
      inIpv4Range(normalized, "192.0.2.0", 24) ||
      inIpv4Range(normalized, "192.168.0.0", 16) ||
      inIpv4Range(normalized, "198.18.0.0", 15) ||
      inIpv4Range(normalized, "198.51.100.0", 24) ||
      inIpv4Range(normalized, "203.0.113.0", 24) ||
      inIpv4Range(normalized, "224.0.0.0", 4) ||
      inIpv4Range(normalized, "240.0.0.0", 4) ||
      normalized === "255.255.255.255"
    );
  }
  if (net.isIPv6(normalized)) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      /^f[cd][0-9a-f]{2}:/.test(normalized) ||
      /^fe[89ab][0-9a-f]:/.test(normalized) ||
      /^2001:db8:/.test(normalized) ||
      /^2001:(10|20|30):/.test(normalized) ||
      /^ff[0-9a-f]{2}:/.test(normalized)
    );
  }
  return true;
}

export async function resolveSecureImageTarget(urlString: string): Promise<SecureImageTarget> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new ImageFetchError("INVALID_URL", "Invalid image URL.");
  }

  if (url.protocol !== "https:") {
    throw new ImageFetchError("INSECURE_URL", "Remote images must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new ImageFetchError("INVALID_URL", "Credentialed image URLs are not allowed.");
  }
  if (blockedHostname(url.hostname)) {
    throw new ImageFetchError("BLOCKED_HOST", "Internal image hosts are not allowed.");
  }

  const literalIp = net.isIP(url.hostname.replace(/^\[|\]$/g, ""));
  let addresses: LookupAddress[];
  if (literalIp) {
    const ip = url.hostname.replace(/^\[|\]$/g, "");
    if (isBlockedIpAddress(ip)) {
      throw new ImageFetchError("BLOCKED_IP", "Internal image addresses are not allowed.");
    }
    addresses = [{ address: ip, family: literalIp as 4 | 6 }];
  } else {
    addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
    if (addresses.length === 0) {
      throw new ImageFetchError("DNS_FAILURE", "Image host could not be resolved.");
    }
    if (addresses.some((entry) => isBlockedIpAddress(entry.address))) {
      throw new ImageFetchError("BLOCKED_IP", "Internal image addresses are not allowed.");
    }
  }

  const pinned = addresses[0];
  const agent = new https.Agent({
    lookup: (_hostname, _options, callback) => {
      callback(null, pinned.address, pinned.family);
    },
  });

  return { url, agent };
}

export interface DownloadSecureAssetOptions {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects?: number;
  allowedContentTypes?: ReadonlySet<string>;
  accept?: string;
  label?: string;
}

export async function downloadSecureAsset(
  urlString: string,
  options: DownloadSecureAssetOptions,
): Promise<DownloadedAsset> {
  const maxRedirects = options.maxRedirects ?? 3;
  const allowedContentTypes = options.allowedContentTypes ?? ALLOWED_IMAGE_TYPES;
  const accept = options.accept ?? "image/avif,image/webp,image/png,image/jpeg,image/gif";
  const label = options.label ?? "Image";
  const target = await resolveSecureImageTarget(urlString);

  return new Promise<DownloadedAsset>((resolve, reject) => {
    const request = https.get(
      target.url,
      {
        agent: target.agent,
        timeout: options.timeoutMs,
        headers: { accept },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;

        if (status >= 300 && status < 400 && location && maxRedirects > 0) {
          response.resume();
          const redirected = new URL(location, target.url).toString();
          downloadSecureAsset(redirected, { ...options, maxRedirects: maxRedirects - 1 }).then(
            resolve,
            reject,
          );
          return;
        }

        if (status < 200 || status >= 300) {
          response.resume();
          reject(new ImageFetchError("HTTP_ERROR", `${label} request failed with status ${status}.`));
          return;
        }

        const contentType = String(response.headers["content-type"] ?? "")
          .split(";")[0]
          .trim()
          .toLowerCase();
        if (!allowedContentTypes.has(contentType)) {
          response.resume();
          reject(new ImageFetchError("INVALID_CONTENT_TYPE", `Unsupported ${label.toLowerCase()} content type.`));
          return;
        }
        if (response.headers["content-encoding"]) {
          response.resume();
          reject(
            new ImageFetchError("INVALID_ENCODING", `Encoded ${label.toLowerCase()} responses are not allowed.`),
          );
          return;
        }

        const declaredLength = Number(response.headers["content-length"] ?? 0);
        if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
          response.resume();
          reject(new ImageFetchError("TOO_LARGE", "Image exceeds the download size limit."));
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        response.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > options.maxBytes) {
            response.destroy(
              new ImageFetchError("TOO_LARGE", "Image exceeds the download size limit."),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          if (total === 0) {
            reject(new ImageFetchError("EMPTY_IMAGE", "Image response was empty."));
            return;
          }
          resolve({
            buffer: Buffer.concat(chunks),
            contentType,
            url: target.url.toString(),
          });
        });
        response.on("error", reject);
      },
    );

    request.on("timeout", () => {
      request.destroy(new ImageFetchError("TIMEOUT", "Image download timed out."));
    });
    request.on("error", reject);
  });
}

export function downloadSecureImage(
  urlString: string,
  options: DownloadSecureAssetOptions,
): Promise<DownloadedImage> {
  return downloadSecureAsset(urlString, {
    ...options,
    allowedContentTypes: ALLOWED_IMAGE_TYPES,
    accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
    label: "Image",
  });
}
