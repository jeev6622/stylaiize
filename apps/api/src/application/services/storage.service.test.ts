import { describe, expect, it } from "vitest";
import { parseSseData } from "@/infrastructure/ai/http";
import {
  createUploadToken,
  resolveUploadToken,
} from "@/application/services/storage.service";
import { BadRequestError } from "@/utils/errors";

function sseStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const payload of parseSseData(stream, 0)) out.push(payload);
  return out;
}

describe("parseSseData", () => {
  it("parses LF-separated SSE frames", async () => {
    const frames = [
      'data: {"a":1}\n\n',
      'data: {"b":2}\n\n',
      "data: [DONE]\n\n",
    ].join("");
    expect(await collect(sseStream(frames))).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("parses CRLF-separated SSE frames (e.g. OpenAI-style providers)", async () => {
    const frames = [
      'data: {"first":true}\r\n\r\n',
      'data: {"second":true}\r\n\r\n',
      "data: [DONE]\r\n\r\n",
    ].join("");
    expect(await collect(sseStream(frames))).toEqual([
      '{"first":true}',
      '{"second":true}',
    ]);
  });

  it("handles frames split across several chunks", async () => {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const full =
          'data: {"n":1}\n\ndata: {"n":2}\n\ndata: [DONE]\n\n';
        for (const part of [full.slice(0, 9), full.slice(9, 25), full.slice(25)]) {
          if (part) controller.enqueue(encoder.encode(part));
        }
        controller.close();
      },
    });
    expect(await collect(stream)).toEqual(['{"n":1}', '{"n":2}']);
  });

  it("ignores comment lines and multi-line data", async () => {
    const frames = ": keep-alive\n\ndata: line1\ndata: line2\n\n";
    expect(await collect(sseStream(frames))).toEqual(["line1\nline2"]);
  });
});

describe("upload token cryptography", () => {
  it("round-trips a token to a publicId and url", () => {
    const token = createUploadToken("wardrobe/abc.png", "https://x/uploads/wardrobe/abc.png", "user-1");
    const resolved = resolveUploadToken(token, "user-1");
    expect(resolved.publicId).toBe("wardrobe/abc.png");
    expect(resolved.url).toBe("https://x/uploads/wardrobe/abc.png");
  });

  it("rejects a token issued to a different user", () => {
    const token = createUploadToken("wardrobe/abc.png", "u", "user-1");
    expect(() => resolveUploadToken(token, "user-2")).toThrow(BadRequestError);
  });

  it("rejects a tampered payload", () => {
    const token = createUploadToken("wardrobe/abc.png", "u", "user-1");
    const [payload] = token.split(".");
    const tampered = `${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect(() => resolveUploadToken(tampered, "user-1")).toThrow(BadRequestError);
  });

  it("rejects a non-token string", () => {
    expect(() => resolveUploadToken("just-a-string", "user-1")).toThrow(BadRequestError);
  });
});