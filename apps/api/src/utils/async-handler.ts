import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async Express handler so rejections are forwarded to the
 * centralized error middleware instead of crashing the process.
 */
export function asyncHandler(handler: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function ok(res: Response, data: unknown, meta?: Record<string, unknown>): void {
  res.status(200).json({ success: true, data, ...(meta ?? {}) });
}

export function created(res: Response, data: unknown, meta?: Record<string, unknown>): void {
  res.status(201).json({ success: true, data, ...(meta ?? {}) });
}
