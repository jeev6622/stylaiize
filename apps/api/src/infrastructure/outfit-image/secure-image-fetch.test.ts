import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn(),
  },
}));

vi.mock("node:https", () => {
  const get = vi.fn();
  class Agent {
    constructor(_options?: unknown) {
      void _options;
    }
  }
  return { default: { get, Agent }, get, Agent };
});

import dns from "node:dns/promises";
import https from "node:https";
import {
  downloadSecureImage,
  isBlockedIpAddress,
  resolveSecureImageTarget,
} from "./secure-image-fetch";

const mockedLookup = vi.mocked(dns.lookup);
const mockedGet = vi.mocked(https.get);

describe("secure image fetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
  });

  it("blocks private and reserved IP ranges", () => {
    expect(isBlockedIpAddress("127.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("10.0.0.5")).toBe(true);
    expect(isBlockedIpAddress("172.16.0.1")).toBe(true);
    expect(isBlockedIpAddress("192.168.1.10")).toBe(true);
    expect(isBlockedIpAddress("169.254.169.254")).toBe(true);
    expect(isBlockedIpAddress("::1")).toBe(true);
    expect(isBlockedIpAddress("fc00::1")).toBe(true);
    expect(isBlockedIpAddress("93.184.216.34")).toBe(false);
  });

  it("rejects insecure, localhost and private image URLs", async () => {
    await expect(resolveSecureImageTarget("http://images.example/a.png")).rejects.toMatchObject({
      code: "INSECURE_URL",
    });
    await expect(resolveSecureImageTarget("https://localhost/a.png")).rejects.toMatchObject({
      code: "BLOCKED_HOST",
    });
    await expect(resolveSecureImageTarget("https://127.0.0.1/a.png")).rejects.toMatchObject({
      code: "BLOCKED_IP",
    });
  });

  it("accepts a public HTTPS URL and pins the resolved address", async () => {
    const target = await resolveSecureImageTarget("https://images.example/a.png");

    expect(target.url.hostname).toBe("images.example");
    expect(target.agent).toBeDefined();
    expect(mockedLookup).toHaveBeenCalledWith("images.example", { all: true, verbatim: true });
  });

  it("rejects images whose declared size exceeds the limit", async () => {
    mockedGet.mockImplementation(((_url: unknown, _options: unknown, callback: unknown) => {
      const response = new EventEmitter() as EventEmitter & {
        statusCode: number;
        headers: Record<string, string>;
        resume: () => void;
      };
      response.statusCode = 200;
      response.headers = { "content-type": "image/png", "content-length": "100" };
      response.resume = vi.fn();
      const request = new EventEmitter() as EventEmitter & { destroy: () => void };
      request.destroy = vi.fn();
      queueMicrotask(() => (callback as (value: unknown) => void)(response));
      return request;
    }) as never);

    await expect(
      downloadSecureImage("https://images.example/a.png", {
        maxBytes: 10,
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("rejects downloads that time out", async () => {
    let request: EventEmitter | undefined;
    mockedGet.mockImplementation((() => {
      request = new EventEmitter() as EventEmitter & { destroy: (error?: Error) => void };
      (request as EventEmitter & { destroy: (error?: Error) => void }).destroy = vi.fn(
        (error?: Error) => {
          request?.emit("error", error);
        },
      );
      return request;
    }) as never);

    const pending = downloadSecureImage("https://images.example/a.png", {
      maxBytes: 10,
      timeoutMs: 1000,
    });
    await vi.waitFor(() => expect(request).toBeDefined());
    request?.emit("timeout");

    await expect(pending).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
