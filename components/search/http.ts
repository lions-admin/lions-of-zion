/**
 * Reading this API's errors the way it writes them.
 *
 * Every route under `/api/v1` answers a failure with RFC 9457 problem+json
 * carrying a stable machine `code` and a `detail` written for a person. That
 * is unusually good, and a client that throws it away to render "Something
 * went wrong" is discarding the one thing that makes a failure actionable —
 * most of all the two that this surface hits in normal use: a rate limit
 * (which names its own ceiling and window) and `NOT_IMPLEMENTED` (which means
 * the deployment has no AI gateway, and no amount of waiting will fix it).
 *
 * The code union is restated here rather than imported: `ProblemCode` lives in
 * `server/http/responses.ts`, and `app/**` and `components/**` may import
 * nothing under `server/` but `contracts`. An unknown code degrades to
 * `"UNKNOWN"` rather than failing to parse, so a new code added server-side
 * never breaks a client.
 *
 * This module is shared with `components/ask` — the two are one surface (the
 * desk's query tools), and this wave owns no neutral directory to put a shared
 * helper in.
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
  | "NOT_IMPLEMENTED"
  | "TIMEOUT"
  | "UNKNOWN";

export class ApiProblem extends Error {
  constructor(
    readonly code: ProblemCode,
    readonly status: number,
    readonly detail: string,
  ) {
    super(detail);
    this.name = "ApiProblem";
  }
}

const KNOWN_CODES = new Set<ProblemCode>([
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "NOT_IMPLEMENTED",
  "TIMEOUT",
]);

/**
 * A `fetch` that returns parsed JSON or throws an `ApiProblem`.
 *
 * An aborted request re-throws the `AbortError` untouched — it is a
 * cancellation, not a failure, and the caller must be able to tell them apart
 * to avoid rendering an error for a request it cancelled itself.
 */
export async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, { ...init, headers: { Accept: "application/json", ...init?.headers } });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiProblem(
      "UNKNOWN",
      0,
      "The request did not reach the server. Check your connection and try again.",
    );
  }

  if (response.ok) return (await response.json()) as T;

  let code: ProblemCode = "UNKNOWN";
  let detail = "";
  try {
    /* The API nests its problem under `error` (`problem()` in
       `server/http/responses.ts`): `{ error: { code, message } }`. This read
       the flat RFC 9457 shape until 2026-09-09, so every real failure parsed
       as UNKNOWN with no detail and the RATE_LIMITED / NOT_IMPLEMENTED
       branches downstream never fired. The flat keys stay as a fallback. */
    const body = (await response.json()) as {
      error?: { code?: string; message?: string };
      code?: string;
      detail?: string;
      title?: string;
    };
    const raw = body.error?.code ?? body.code;
    if (raw && KNOWN_CODES.has(raw as ProblemCode)) code = raw as ProblemCode;
    detail = body.error?.message ?? body.detail ?? body.title ?? "";
  } catch {
    /* A non-JSON body — a gateway timeout page, most likely. The status is
       still the truth, so fall through to it rather than discarding it. */
  }

  throw new ApiProblem(code, response.status, detail || fallbackDetail(response.status));
}

function fallbackDetail(status: number): string {
  if (status === 504 || status === 408) return "The request took too long and was cut off.";
  if (status >= 500) return "The server could not complete the request.";
  /* No status code: a reader has nothing to do with one, and the 429 case
     already carries its own title in `SearchPanel`. */
  return "Something went wrong on our side. Try again in a moment.";
}

/** True for the cancellation a new keystroke causes, which must never surface. */
export function isAbort(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === "AbortError";
}
