/**
 * Every response shape, in one place.
 *
 * Errors follow RFC 9457 problem+json, with a stable machine-readable `code`
 * that callers may branch on. `detail` is written for a human; it never
 * carries a stack, a query, a provider message or an environment value —
 * leaking those through an error path is the most common way a backend
 * discloses its internals.
 */

export type ProblemCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "NOT_IMPLEMENTED";

const STATUS: Record<ProblemCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
};

export class ApiError extends Error {
  constructor(
    readonly code: ProblemCode,
    message: string,
    readonly errors?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const notFound = (what: string) => new ApiError("NOT_FOUND", `${what} was not found`);
export const forbidden = (why: string) => new ApiError("FORBIDDEN", why);

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, { status: 200, ...init });
}

export function created<T>(data: T, location?: string): Response {
  return Response.json(data, {
    status: 201,
    headers: location ? { Location: location } : undefined,
  });
}

export function problem(error: ApiError, requestId: string): Response {
  const status = STATUS[error.code];
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        ...(error.errors ? { errors: error.errors } : {}),
      },
    },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}
