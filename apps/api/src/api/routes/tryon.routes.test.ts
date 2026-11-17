import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { env } from "@/config/env";
import { signAccessToken } from "@/utils/jwt";
import { registerDemoUserRepository } from "@/infrastructure/repos/user.repo";
import { InMemoryUserRepository } from "@/infrastructure/repos/memory/user.memory.repo";
import { registerDemoTryOnResultRepository } from "@/infrastructure/repos/try-on-result.repo";
import { InMemoryTryOnResultRepository } from "@/infrastructure/repos/memory/try-on-result.memory.repo";

/**
 * End-to-end contract test for the try-on gateway: API -> provider HTTP call
 * -> stored image -> authenticated image endpoint. The provider is a local
 * deterministic stub (not an AI model); this proves forwarding and display
 * wiring, not model quality.
 */
const app = createApp();

let server: Server;
let token: string;
let receivedBody: Record<string, unknown> | null = null;
let asyncJobPolls = 0;

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const original = {
  provider: env.VTON_PROVIDER,
  fallback: env.VTON_FALLBACK_PROVIDER,
  idmUrl: env.VTON_API_URL,
  catUrl: env.VTON_CATVTON_API_URL,
  serviceUrl: env.VTON_SERVICE_URL,
  pollMs: env.VTON_JOB_POLL_MS,
  maxMs: env.VTON_JOB_MAX_MS,
};

beforeAll(async () => {
  const userRepository = new InMemoryUserRepository();
  registerDemoUserRepository(userRepository);
  registerDemoTryOnResultRepository(new InMemoryTryOnResultRepository());

  const user = await userRepository.create({
    name: "Try On Tester",
    email: "tryon@example.com",
    emailVerified: true,
  });
  token = signAccessToken({ sub: user.id, role: "user" });

  server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;

      if (req.method === "POST" && pathname === "/v1/jobs") {
        receivedBody = JSON.parse(
          Buffer.concat(chunks).toString("utf8"),
        ) as Record<string, unknown>;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: "remote-1",
            status: "queued",
            stage: "queued",
            progress: 0,
            message: "Queued",
          }),
        );
        return;
      }

      if (req.method === "GET" && pathname === "/v1/jobs/remote-1/result") {
        res.writeHead(200, { "Content-Type": "image/png" });
        res.end(PNG_BYTES);
        return;
      }

      if (req.method === "GET" && pathname === "/v1/jobs/remote-1") {
        asyncJobPolls += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify(
            asyncJobPolls === 1
              ? {
                  id: "remote-1",
                  status: "running",
                  stage: "diffusion",
                  progress: 62,
                  message: "Running diffusion",
                }
              : {
                  id: "remote-1",
                  status: "succeeded",
                  stage: "done",
                  progress: 100,
                  message: "Completed",
                  processingTimeMs: 1234,
                },
          ),
        );
        return;
      }

      try {
        receivedBody = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
          string,
          unknown
        >;
      } catch {
        receivedBody = null;
      }
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(PNG_BYTES);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const address = server.address() as AddressInfo;
  env.VTON_PROVIDER = "idm_vton";
  env.VTON_FALLBACK_PROVIDER = "none";
  env.VTON_API_URL = `http://127.0.0.1:${address.port}/infer`;
  env.VTON_CATVTON_API_URL = "";
  env.VTON_SERVICE_URL = "";
  env.VTON_JOB_POLL_MS = 10;
  env.VTON_JOB_MAX_MS = 5_000;
});

afterAll(async () => {
  env.VTON_PROVIDER = original.provider;
  env.VTON_FALLBACK_PROVIDER = original.fallback;
  env.VTON_API_URL = original.idmUrl;
  env.VTON_CATVTON_API_URL = original.catUrl;
  env.VTON_SERVICE_URL = original.serviceUrl;
  env.VTON_JOB_POLL_MS = original.pollMs;
  env.VTON_JOB_MAX_MS = original.maxMs;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function auth(): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("POST /api/v1/tryon/jobs", () => {
  it("relays real progress and persists a completed result", async () => {
    env.VTON_SERVICE_URL = new URL(env.VTON_API_URL).origin;
    asyncJobPolls = 0;
    receivedBody = null;

    try {
      const personImage = `data:image/png;base64,${Buffer.from("person").toString("base64")}`;
      const garmentImage = `data:image/png;base64,${Buffer.from("garment").toString("base64")}`;

      const created = await request(app)
        .post("/api/v1/tryon/jobs")
        .set(auth())
        .send({
          personImage,
          garmentImage,
          category: "shirt",
          garmentLabel: "Blue shirt",
        });

      expect(created.status).toBe(200);
      expect(created.body.data.status).toBe("queued");
      expect(created.body.data.progressSupported).toBe(true);

      const jobId = created.body.data.id as string;
      let current = created.body.data;

      for (let i = 0; i < 100; i += 1) {
        await delay(25);
        const polled = await request(app)
          .get(`/api/v1/tryon/jobs/${jobId}`)
          .set(auth());
        expect(polled.status).toBe(200);
        current = polled.body.data;
        if (current.status === "succeeded" || current.status === "failed") break;
      }

      expect(current.status).toBe("succeeded");
      expect(current.stage).toBe("done");
      expect(current.progress).toBe(100);
      expect(current.processingTimeMs).toBe(1234);
      expect(current.resultImageUrl).toMatch(
        /^\/api\/v1\/tryon\/results\/[^/]+\/image$/,
      );
      expect(asyncJobPolls).toBeGreaterThanOrEqual(2);

      expect(receivedBody).toMatchObject({
        human_image: Buffer.from("person").toString("base64"),
        garment_image: Buffer.from("garment").toString("base64"),
        garment_description: "Blue shirt",
        category: "upper_body",
      });

      const image = await request(app)
        .get(current.resultImageUrl as string)
        .set(auth());
      expect(image.status).toBe(200);
      expect(image.body).toEqual(PNG_BYTES);
    } finally {
      env.VTON_SERVICE_URL = "";
    }
  });
});

describe("POST /api/v1/tryon", () => {
  it("forwards the real provider request and serves the stored image", async () => {
    const personImage = `data:image/png;base64,${Buffer.from("person").toString("base64")}`;
    const garmentImage = `data:image/png;base64,${Buffer.from("garment").toString("base64")}`;

    const res = await request(app)
      .post("/api/v1/tryon")
      .set(auth())
      .send({ personImage, garmentImage, category: "shirt", garmentLabel: "Blue shirt" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("success");
    expect(res.body.data.provider).toBe("idm_vton");
    expect(res.body.data.resultImageUrl).toMatch(
      /^\/api\/v1\/tryon\/results\/[^/]+\/image$/,
    );

    // No provider URL or credentials leak to the client.
    expect(JSON.stringify(res.body)).not.toContain("127.0.0.1");
    expect(JSON.stringify(res.body)).not.toContain("infer");

    expect(receivedBody).toMatchObject({
      human_image: Buffer.from("person").toString("base64"),
      garment_image: Buffer.from("garment").toString("base64"),
      garment_description: "Blue shirt",
      category: "upper_body",
    });

    const image = await request(app)
      .get(res.body.data.resultImageUrl as string)
      .set(auth());
    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(image.body).toEqual(PNG_BYTES);
  });

  it("returns a clear configuration error when no provider is configured", async () => {
    const configuredUrl = env.VTON_API_URL;
    env.VTON_API_URL = "";

    const res = await request(app)
      .post("/api/v1/tryon")
      .set(auth())
      .send({
        personImage: `data:image/png;base64,${Buffer.from("person").toString("base64")}`,
        garmentImage: `data:image/png;base64,${Buffer.from("garment").toString("base64")}`,
        category: "shirt",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("not_configured");
    expect(res.body.data.message).toContain("VTON_API_URL");
    env.VTON_API_URL = configuredUrl;
  });
});
