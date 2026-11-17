import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "@/config/env";
import { IDMVtonProvider } from "./idm-vton.provider";
import { CatVtonProvider } from "./catvton.provider";

const original = {
  idmUrl: env.VTON_API_URL,
  catUrl: env.VTON_CATVTON_API_URL,
  timeout: env.VTON_TIMEOUT_MS,
};

afterEach(() => {
  env.VTON_API_URL = original.idmUrl;
  env.VTON_CATVTON_API_URL = original.catUrl;
  env.VTON_TIMEOUT_MS = original.timeout;
  vi.unstubAllGlobals();
});

const person = `data:image/png;base64,${Buffer.from("person-image").toString("base64")}`;
const garment = `data:image/png;base64,${Buffer.from("garment-image").toString("base64")}`;

function imageResponse(): Response {
  return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
    status: 200,
    headers: { "content-type": "image/png" },
  });
}

describe("IDM-VTON provider", () => {
  it("forwards base64 images using the IDM-VTON request contract", async () => {
    env.VTON_API_URL = "https://idm.example.com/infer";
    const fetchMock = vi.fn().mockResolvedValue(imageResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await new IDMVtonProvider().tryOn({
      personImage: person,
      garmentImage: garment,
      category: "shirt",
      garmentLabel: "Navy blazer",
    });

    expect(result.provider).toBe("idm_vton");
    expect(result.imageData).toBe(Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, string>;
    expect(body.human_image).toBe(Buffer.from("person-image").toString("base64"));
    expect(body.garment_image).toBe(Buffer.from("garment-image").toString("base64"));
    expect(body.category).toBe("upper_body");
    expect(body.garment_description).toBe("Navy blazer");
  });

  it("returns a clear timeout error", async () => {
    env.VTON_API_URL = "https://idm.example.com/infer";
    env.VTON_TIMEOUT_MS = 1_000;
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));

    await expect(
      new IDMVtonProvider().tryOn({ personImage: person, garmentImage: garment }),
    ).rejects.toThrow(/did not respond within 1s/i);
  });

  it("rejects garment categories the model cannot render", async () => {
    env.VTON_API_URL = "https://idm.example.com/infer";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(imageResponse()));

    await expect(
      new IDMVtonProvider().tryOn({
        personImage: person,
        garmentImage: garment,
        category: "shoes",
      }),
    ).rejects.toThrow(/does not support "shoes"/i);
  });
});

describe("CatVTON provider", () => {
  it("forwards base64 images using the CatVTON request contract", async () => {
    env.VTON_CATVTON_API_URL = "https://cat.example.com/infer";
    const fetchMock = vi.fn().mockResolvedValue(imageResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await new CatVtonProvider().tryOn({
      personImage: person,
      garmentImage: garment,
      category: "jeans",
    });

    expect(result.provider).toBe("catvton");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, string>;
    expect(body.source_image).toBe(Buffer.from("person-image").toString("base64"));
    expect(body.reference_image).toBe(Buffer.from("garment-image").toString("base64"));
    expect(body.cloth_type).toBe("lower_body");
  });
});
