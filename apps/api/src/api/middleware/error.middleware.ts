import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { AppError } from "@/utils/errors";
import { logError } from "@/utils/logger";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Route not found.",
    },
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] = fieldErrors[key] ?? [];
      fieldErrors[key].push(issue.message);
    }
    const firstMessage = Object.values(fieldErrors)[0]?.[0] ?? "Invalid input.";
    res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: firstMessage,
        fieldErrors,
      },
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    res.status(tooLarge ? 413 : 400).json({
      success: false,
      error: {
        code: tooLarge ? "FILE_TOO_LARGE" : "INVALID_UPLOAD",
        message: tooLarge
          ? "The uploaded file is too large."
          : `Invalid upload: ${err.message}`,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  logError("Unhandled error", err);
  const message =
    err instanceof Error && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")
      ? err.message
      : "Internal server error.";
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message },
  });
};
