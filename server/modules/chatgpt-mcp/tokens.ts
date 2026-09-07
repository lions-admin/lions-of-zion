import "server-only";

/**
 * OAuth tokens for the ChatGPT connector — signed, not stored.
 *
 * ChatGPT offers three ways to authenticate a custom MCP connector: OAuth, no
 * authentication, and a mix. There is no static-header option, so the header
 * the HTTP automation API uses cannot be what authenticates a conversation —
 * and an unauthenticated endpoint that can archive a publication is not a
 * thing this project is going to put on the public internet. Hence OAuth.
 *
 * The tokens are HMAC-signed rather than persisted, following the same
 * reasoning already written down for ops confirmations in
 * `server/modules/ops-agent/confirmations.ts`: a table would be a second
 * source of truth that outlives restarts and redeploys, and here it would
 * also be a migration that has to reach Production before this code does.
 * Signing keeps the deploy order free and the failure mode simple.
 *
 * Three properties carry the security:
 *
 *   1. **The identity is not in the request.** A token decodes to the single
 *      fixed actor `service:chatgpt-editorial` and to nothing else. There is
 *      no `sub` a client can choose; a caller that could name its own actor
 *      could file its actions under someone else.
 *   2. **The kind is inside the signature.** An authorization code cannot be
 *      presented as an access token, and a refresh token cannot be presented
 *      as one either — each kind is signed under its own purpose label.
 *   3. **They expire**, and short. The access token outlives a conversation
 *      turn, not a week.
 *
 * The cost of not storing them is that an individual token cannot be revoked.
 * Rotating `CHATGPT_AUTOMATION_SECRET` invalidates every token at once, which
 * is the documented revocation path — see `docs/chatgpt-app.md`.
 */

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { chatgptAutomationSecret } from "@/server/core/config";
import { ApiError } from "@/server/http/responses";

/** Long enough to work, short enough that a leaked token is a small window. */
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1_000;
/** The connector should keep working across a night without a re-consent. */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
/** An authorization code is redeemed immediately or not at all. */
export const AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1_000;

type TokenKind = "code" | "access" | "refresh";

const PURPOSE: Record<TokenKind, string> = {
  code: "lions-of-zion/chatgpt-mcp/authorization-code/v1",
  access: "lions-of-zion/chatgpt-mcp/access-token/v1",
  refresh: "lions-of-zion/chatgpt-mcp/refresh-token/v1",
};

type Payload = {
  id: string;
  kind: TokenKind;
  exp: number;
  /** Present on an authorization code only; PKCE binds it to one client. */
  codeChallenge?: string;
  redirectUri?: string;
};

/** Derived per kind, so a code and an access token are not interchangeable
 *  even though one secret is behind both. */
function signingKey(kind: TokenKind): Buffer {
  return createHmac("sha256", chatgptAutomationSecret()).update(PURPOSE[kind]).digest();
}

const b64url = (value: Buffer | string): string => Buffer.from(value).toString("base64url");

function sign(kind: TokenKind, body: string): string {
  return createHmac("sha256", signingKey(kind)).update(body).digest("base64url");
}

/** Key order is sorted so the same payload always signs the same string. */
function canonicalise(payload: Payload): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

function issue(kind: TokenKind, ttlMs: number, extra: Partial<Payload> = {}, now = new Date()): string {
  const payload: Payload = { id: randomUUID(), kind, exp: now.getTime() + ttlMs, ...extra };
  const body = b64url(canonicalise(payload));
  return `${body}.${sign(kind, body)}`;
}

/**
 * Verifies a token of exactly one kind.
 *
 * Every refusal is the same message on purpose: a caller learning *which*
 * check failed learns whether a token was real but expired, forged, or of the
 * wrong kind, and none of that is its business.
 */
function verify(kind: TokenKind, token: string, now = new Date()): Payload {
  const refuse = (): never => {
    throw new ApiError("UNAUTHENTICATED", "This token is not valid for this endpoint.");
  };
  const [body, signature] = token.split(".");
  if (!body || !signature) refuse();
  const expected = Buffer.from(sign(kind, body!), "utf8");
  const actual = Buffer.from(signature!, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) refuse();

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body!, "base64url").toString("utf8")) as Payload;
  } catch {
    return refuse();
  }
  /* The kind is checked against the payload as well as the key: the key alone
     would already refuse a cross-kind token, and this makes that explicit
     rather than incidental. */
  if (payload.kind !== kind) refuse();
  if (typeof payload.exp !== "number" || payload.exp <= now.getTime()) refuse();
  return payload;
}

export const issueAuthorizationCode = (
  input: { codeChallenge: string; redirectUri: string },
  now = new Date(),
): string => issue("code", AUTHORIZATION_CODE_TTL_MS, input, now);

export const verifyAuthorizationCode = (token: string, now = new Date()): Payload =>
  verify("code", token, now);

export const issueAccessToken = (now = new Date()): string =>
  issue("access", ACCESS_TOKEN_TTL_MS, {}, now);

export const issueRefreshToken = (now = new Date()): string =>
  issue("refresh", REFRESH_TOKEN_TTL_MS, {}, now);

export const verifyRefreshToken = (token: string, now = new Date()): Payload =>
  verify("refresh", token, now);

/**
 * The only question the transport asks: is this bearer token one we issued and
 * still current? It answers with the fixed actor or it throws — there is
 * deliberately no path here that returns an identity taken from the request.
 */
export function verifyAccessToken(token: string, now = new Date()): { expiresAt: Date } {
  const payload = verify("access", token, now);
  return { expiresAt: new Date(payload.exp) };
}

/**
 * PKCE, S256 only.
 *
 * OAuth 2.1 requires PKCE and drops `plain`, so this accepts one method and
 * says so rather than falling back to a comparison that proves nothing. The
 * challenge is `BASE64URL(SHA256(verifier))`, compared in constant time.
 */
export function verifyPkce(codeVerifier: string, codeChallenge: string): void {
  const computed = Buffer.from(createHash("sha256").update(codeVerifier).digest("base64url"), "utf8");
  const expected = Buffer.from(codeChallenge, "utf8");
  if (computed.length !== expected.length || !timingSafeEqual(computed, expected)) {
    throw new ApiError("UNAUTHENTICATED", "This token is not valid for this endpoint.");
  }
}
