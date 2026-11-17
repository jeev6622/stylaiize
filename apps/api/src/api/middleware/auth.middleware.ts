import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "@/utils/errors";
import { verifyAccessToken } from "@/utils/jwt";
import { userRepository } from "@/infrastructure/repos/user.repo";
import { asyncHandler } from "@/utils/async-handler";

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (!token) {
      throw new UnauthorizedError("Access token missing.");
    }

    let payload: { sub: string; role: "user" | "admin" };
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError("Access token invalid or expired.");
    }

    const user = await userRepository().findById(payload.sub);
    if (!user) {
      throw new UnauthorizedError("Account not found.");
    }

    req.user = user;
    req.accessToken = token;
    next();
  },
);

export const requireAdmin = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }
    if (req.user.role !== "admin") {
      throw new UnauthorizedError("Admin privileges required.");
    }
    next();
  },
);

/** Optional auth - attaches the user if a valid token is present, never throws. */
export const optionalAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        const user = await userRepository().findById(payload.sub);
        if (user) {
          req.user = user;
          req.accessToken = token;
        }
      } catch {
        // Ignore invalid tokens for optional auth.
      }
    }
    next();
  },
);
