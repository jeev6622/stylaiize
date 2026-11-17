import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "@/config/env";

export interface TokenPayload {
  sub: string;
  role: "user" | "admin";
  rm?: boolean;
}

const SIGN_OPTIONS: jwt.SignOptions = { issuer: env.JWT_ISSUER, algorithm: "HS256" };
// Pinning the accepted algorithms prevents algorithm-confusion attacks, where
// a token is presented as `none` or as an RS/ES token using the HMAC secret.
const VERIFY_OPTIONS: jwt.VerifyOptions = { issuer: env.JWT_ISSUER, algorithms: ["HS256"] };

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    ...SIGN_OPTIONS,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

export function signRefreshToken(payload: TokenPayload, expiresIn?: string): string {
  // `iat` has second granularity; without a unique ID, two tokens signed in the
  // same second for the same user are byte-identical and collide on the
  // refresh-token `tokenHash_1` unique index (breaking login→refresh, and
  // revoking the family when the duplicate write fails).
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    ...SIGN_OPTIONS,
    jwtid: randomUUID(),
    expiresIn: (expiresIn ?? env.JWT_REFRESH_EXPIRES_IN) as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, VERIFY_OPTIONS);
  return decoded as unknown as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, VERIFY_OPTIONS);
  return decoded as unknown as TokenPayload;
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
}
