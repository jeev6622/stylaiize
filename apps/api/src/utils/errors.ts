/**
 * App error hierarchy.
 * HTTP-aware errors carry a status code and optional error code so the
 * API middleware can render consistent responses.
 */

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    options?: { code?: string; isOperational?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = options?.code ?? "APP_ERROR";
    this.isOperational = options?.isOperational ?? true;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = "BAD_REQUEST") {
    super(400, message, { code });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required.", code = "UNAUTHORIZED") {
    super(401, message, { code });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do this.", code = "FORBIDDEN") {
    super(403, message, { code });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.", code = "NOT_FOUND") {
    super(404, message, { code });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists.", code = "CONFLICT") {
    super(409, message, { code });
  }
}

export class ValidationError extends AppError {
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message = "Invalid input.",
    fieldErrors?: Record<string, string[]>,
    code = "VALIDATION_ERROR",
  ) {
    super(422, message, { code });
    this.fieldErrors = fieldErrors;
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests.", code = "RATE_LIMITED") {
    super(429, message, { code });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service temporarily unavailable.", code = "SERVICE_UNAVAILABLE") {
    super(503, message, { code });
  }
}

/** Thrown by providers/demo layers when a real service is required but absent. */
export class DemoModeError extends AppError {
  constructor(service: string) {
    super(
      503,
      `${service} is not configured. Provide the required credentials in .env or enable demo mode.`,
      { code: "DEMO_MODE_UNAVAILABLE" },
    );
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
