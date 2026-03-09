import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Base error
// ---------------------------------------------------------------------------

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Specific error classes
// ---------------------------------------------------------------------------

export class ValidationError extends AppError {
  public readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message, 422, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403, "FORBIDDEN");
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class InsufficientFundsError extends AppError {
  constructor(message = "Insufficient funds") {
    super(message, 400, "INSUFFICIENT_FUNDS");
    this.name = "InsufficientFundsError";
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message = "Too many requests", retryAfter?: number) {
    super(message, 429, "RATE_LIMITED");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

// ---------------------------------------------------------------------------
// Error response converter
// ---------------------------------------------------------------------------

/**
 * Convert any thrown error into a properly formatted NextResponse.
 *
 * Handles AppError subclasses, Zod validation errors, Prisma known
 * errors, and generic unknown errors.
 */
export function errorResponse(error: unknown): NextResponse {
  // AppError hierarchy
  if (error instanceof AppError) {
    const body: Record<string, unknown> = {
      error: error.message,
      code: error.code,
    };

    if (error instanceof ValidationError && error.details) {
      body.details = error.details;
    }

    const headers: Record<string, string> = {};
    if (error instanceof RateLimitError && error.retryAfter) {
      headers["Retry-After"] = String(error.retryAfter);
    }

    return NextResponse.json(body, { status: error.statusCode, headers });
  }

  // Zod validation errors
  if (
    error instanceof Error &&
    error.name === "ZodError" &&
    "issues" in error
  ) {
    return NextResponse.json(
      {
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: (error as any).issues,
      },
      { status: 422 }
    );
  }

  // Prisma unique constraint violation
  if (
    error instanceof Error &&
    "code" in error &&
    (error as any).code === "P2002"
  ) {
    const target = (error as any).meta?.target;
    return NextResponse.json(
      {
        error: `A record with this ${Array.isArray(target) ? target.join(", ") : "value"} already exists`,
        code: "CONFLICT",
      },
      { status: 409 }
    );
  }

  // Prisma record not found
  if (
    error instanceof Error &&
    "code" in error &&
    (error as any).code === "P2025"
  ) {
    return NextResponse.json(
      { error: "Resource not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  // Ledger InsufficientFundsError (from transfer.ts)
  if (error instanceof Error && error.name === "InsufficientFundsError") {
    return NextResponse.json(
      { error: "Insufficient funds", code: "INSUFFICIENT_FUNDS" },
      { status: 400 }
    );
  }

  // Generic error
  console.error("Unhandled error:", error);
  return NextResponse.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}
