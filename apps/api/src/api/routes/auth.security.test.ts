import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { registerDemoUserRepository } from "@/infrastructure/repos/user.repo";
import { InMemoryUserRepository } from "@/infrastructure/repos/memory/user.memory.repo";
import { registerDemoRefreshTokenRepository } from "@/infrastructure/repos/refresh-token.repo";
import { InMemoryRefreshTokenRepository } from "@/infrastructure/repos/memory/refresh-token.memory.repo";
import { uploadRateLimiter } from "@/api/middleware/rate-limit";
import wardrobeRouter from "@/api/routes/wardrobe.routes";
import * as passwordUtils from "@/utils/password";
import { signAccessToken, verifyAccessToken } from "@/utils/jwt";
import { env } from "@/config/env";
import jwt from "jsonwebtoken";

/**
 * Regression coverage for the Phase 18 security fixes.
 *
 * The headline bug: `POST /auth/logout` was mounted without any auth
 * middleware, so `req.user` was always `undefined` and the session-revocation
 * branch inside the controller could never run. Logout looked like it worked
 * (the client dropped its tokens) while the refresh token stayed valid in the
 * database, so a stolen copy kept minting access tokens for up to 30 days.
 */

const app = createApp();

const PASSWORD = "Str0ng!Passw0rd";

let userRepository: InMemoryUserRepository;
let refreshTokenRepository: InMemoryRefreshTokenRepository;
let userCounter = 0;

beforeAll(() => {
  userRepository = new InMemoryUserRepository();
  registerDemoUserRepository(userRepository);
  refreshTokenRepository = new InMemoryRefreshTokenRepository();
  registerDemoRefreshTokenRepository(refreshTokenRepository);
});

beforeEach(() => {
  userCounter += 1;
  refreshTokenRepository = new InMemoryRefreshTokenRepository();
  registerDemoRefreshTokenRepository(refreshTokenRepository);
});

interface Registered {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

async function register(overrides: Partial<Record<string, string>> = {}): Promise<Registered> {
  const payload = {
    name: `Sec ${userCounter}`,
    email: `sec-${userCounter}@example.com`,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    mobile: `9000000${userCounter}`,
    countryCode: "+1",
    ...overrides,
  };
  const res = await request(app).post("/api/v1/auth/register").send(payload);
  expect(res.status).toBe(201);
  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
    userId: res.body.data.user.id,
  };
}

describe("logout revokes refresh tokens", () => {
  it("rejects the presented refresh token after logout", async () => {
    const account = await register();

    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${account.accessToken}`)
      .send({ refreshToken: account.refreshToken });
    expect(logout.status).toBe(200);
    expect(logout.body.data.loggedOut).toBe(true);

    // The whole point: the refresh token must no longer mint new access tokens.
    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: account.refreshToken });
    expect(refresh.status).toBe(401);
    expect(refresh.body.error.code).toBe("TOKEN_REUSE_DETECTED");
  });

  it("revokes the session even when the access token is missing or expired", async () => {
    const account = await register();

    // An expired access token is the normal reason a client cannot be
    // authenticated at logout time, so revocation must not depend on it.
    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .send({ refreshToken: account.refreshToken });
    expect(logout.status).toBe(200);

    const refresh = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: account.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it("revokes every session for the account when authenticated without a token", async () => {
    const first = await register();
    const second = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: `sec-${userCounter}@example.com`, password: PASSWORD });
    expect(second.status).toBe(200);
    const secondRefresh = second.body.data.refreshToken as string;
    expect(secondRefresh).not.toBe(first.refreshToken);

    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .send({});
    expect(logout.status).toBe(200);

    for (const token of [first.refreshToken, secondRefresh]) {
      const refresh = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: token });
      expect(refresh.status).toBe(401);
    }
  });

  it("still returns 200 when the client sends no token at all", async () => {
    const logout = await request(app).post("/api/v1/auth/logout").send({});
    expect(logout.status).toBe(200);
    expect(logout.body.data.loggedOut).toBe(true);
  });
});

describe("login resists account enumeration", () => {
  it("spends a real bcrypt comparison when the account does not exist", async () => {
    const spy = vi.spyOn(passwordUtils, "burnPasswordCompare");

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody-here@example.com", password: "whatever123" });

    expect(res.status).toBe(401);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("returns an identical error for an unknown account and a wrong password", async () => {
    const account = await register();

    const unknown = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "ghost-account@example.com", password: "Wrong!Passw0rd" });
    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: `sec-${userCounter}@example.com`, password: "Wrong!Passw0rd" });

    expect(unknown.status).toBe(wrongPassword.status);
    expect(unknown.body.error).toEqual(wrongPassword.body.error);
    expect(account.userId).toBeTruthy();
  });
});

describe("token verification pins the signing algorithm", () => {
  it("rejects an unsigned `alg: none` token", () => {
    const unsigned = [
      Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
      Buffer.from(
        JSON.stringify({ sub: "attacker", role: "admin", iss: env.JWT_ISSUER, exp: 9999999999 }),
      ).toString("base64url"),
      "",
    ].join(".");

    expect(() => verifyAccessToken(unsigned)).toThrow();
  });

  it("rejects a token whose algorithm is not HS256", () => {
    // Signed with the HMAC secret but advertised as RS256: without an
    // `algorithms` allow-list this would be treated as an RSA/ECDSA token.
    const token = jwt.sign({ sub: "attacker", role: "admin" }, env.JWT_ACCESS_SECRET, {
      issuer: env.JWT_ISSUER,
      algorithm: "HS512",
      expiresIn: "1h",
    });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it("still accepts a correctly signed access token", () => {
    const userId = "11111111-1111-1111-1111-111111111111";
    expect(verifyAccessToken(signAccessToken({ sub: userId, role: "user" })).sub).toBe(userId);
  });
});

describe("upload endpoints are rate limited", () => {
  /** The limiter was defined but never mounted, leaving uploads on the global limit only. */
  function handlersFor(method: "post", path: string): unknown[] {
    const layer = wardrobeRouter.stack.find(
      (entry) =>
        Object.prototype.hasOwnProperty.call(entry.route ?? {}, "path") &&
        entry.route?.path === path &&
        entry.route?.methods?.[method],
    );
    return layer?.route?.stack?.map((entry: { handle: unknown }) => entry.handle) ?? [];
  }

  it("mounts uploadRateLimiter on the image upload endpoints", () => {
    for (const path of ["/upload", "/categorize"]) {
      expect(handlersFor("post", path)).toContain(uploadRateLimiter);
    }
  });
});
