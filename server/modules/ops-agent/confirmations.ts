import "server-only";

/**
 * Confirmation tokens — the thing that stops a sentence from publishing.
 *
 * An irreversible tool is never executed in the turn the model asks for it.
 * The server issues a token describing exactly one proposed call, the console
 * shows the operator the consequence, and only a token that comes back
 * approved runs anything.
 *
 * The token is signed rather than stored because the alternative — a pending
 * table — makes an approval survive a restart, a redeploy and an operator
 * walking away, which is the opposite of what a ten-minute decision should
 * do. Three properties are what make the signature worth having:
 *
 *   1. **The arguments are inside the signature.** The operator approved
 *      "archive publication X"; a client cannot return that approval for
 *      publication Y. This is the whole point — a confirmation dialog that
 *      names one thing and authorises another is worse than no dialog.
 *   2. **The actor is inside the signature.** A token issued to one operator
 *      is refused for another, so a leaked token is not a second session.
 *   3. **It expires.** Ten minutes: long enough to read a consequence and
 *      think, short enough that a stale approval is not lying around.
 *
 * The HMAC key is derived from `opsConfirmationSecret()` with a purpose
 * label, so the raw internal secret is never the signing key and a token
 * cannot be replayed against anything else that uses that secret.
 */

import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { ApiError } from "@/server/http/responses";
import { opsConfirmationSecret } from "@/server/core/config";
import type { OpsTool } from "@/server/contracts/admin-console";

/** How long an operator has to decide. */
export const CONFIRMATION_TTL_MS = 10 * 60 * 1_000;

const PURPOSE = "lions-of-zion/ops-console/confirmation/v1";

type Payload = {
  id: string;
  tool: OpsTool;
  /** Canonicalised at issue time and compared verbatim at redemption. */
  args: Record<string, unknown>;
  actorLabel: string;
  exp: number;
};

function signingKey(): Buffer {
  return createHmac("sha256", opsConfirmationSecret()).update(PURPOSE).digest();
}

const b64url = (value: Buffer | string): string =>
  Buffer.from(value).toString("base64url");

/**
 * A stable string for an argument object.
 *
 * `JSON.stringify` orders keys by insertion, so the same call built two ways
 * signs two different tokens and a legitimate approval is refused. Sorting
 * keys at every level makes the signature a function of the meaning rather
 * than of how the object happened to be assembled.
 */
export function canonicalise(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalise(v)}`).join(",")}}`;
}

function sign(body: string): string {
  return createHmac("sha256", signingKey()).update(body).digest("base64url");
}

/** Issues a token for one proposed call. Nothing is executed. */
export function issueConfirmation(input: {
  tool: OpsTool;
  args: Record<string, unknown>;
  actorLabel: string;
  now?: Date;
}): { id: string; token: string; expiresAt: Date } {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + CONFIRMATION_TTL_MS);
  const payload: Payload = {
    id: randomUUID(),
    tool: input.tool,
    args: input.args,
    actorLabel: input.actorLabel,
    exp: expiresAt.getTime(),
  };
  const body = b64url(canonicalise(payload));
  return { id: payload.id, token: `${body}.${sign(body)}`, expiresAt };
}

/**
 * Redeems a token, or refuses it.
 *
 * Every refusal is `FORBIDDEN` with the same shape of message: a caller
 * learning *which* check failed learns how to probe the next one.
 */
export function verifyConfirmation(input: {
  token: string;
  id: string;
  actorLabel: string;
  now?: Date;
}): Payload {
  const refuse = (): never => {
    throw new ApiError("FORBIDDEN", "This confirmation is not valid for the operation being requested.");
  };

  const [body, signature] = input.token.split(".");
  if (!body || !signature) refuse();

  const expected = Buffer.from(sign(body!), "utf8");
  const actual = Buffer.from(signature!, "utf8");
  /* `timingSafeEqual` throws on a length mismatch rather than returning
     false, so the lengths are compared first — and a wrong-length signature
     is refused exactly like a wrong one. */
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) refuse();

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body!, "base64url").toString("utf8")) as Payload;
  } catch {
    return refuse();
  }

  const now = (input.now ?? new Date()).getTime();
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    throw new ApiError("PRECONDITION_FAILED", "This confirmation has expired. Ask again and approve the new one.");
  }
  if (payload.id !== input.id) refuse();
  if (payload.actorLabel !== input.actorLabel) refuse();

  return payload;
}
