import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  xAuthSessionSecret,
  xAuthSessionSecretIfConfigured,
  xOAuthClientId,
  xOAuthClientIdIfConfigured,
  xOAuthClientSecret,
  xOAuthClientSecretIfConfigured,
} from "@/server/core/config";
import type { ProviderAvailability } from "@/server/contracts/public-session";

const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const ME_URL = "https://api.x.com/2/users/me?user.fields=profile_image_url";
const CALLBACK_URL = "https://lionsofzion.io/auth/x/callback";
const STATE_TTL = 5 * 60;
const SESSION_TTL = 12 * 60 * 60;

export const X_OAUTH_STATE_COOKIE = "__Host-x-oauth-state";
export const X_PUBLIC_SESSION_COOKIE = "__Host-x-public-session";

type Pending = { version: 1; state: string; verifier: string; expiresAt: number };
export type PublicXProfile = { id: string; username: string; name?: string; image?: string };
type Session = { version: 1; profile: PublicXProfile; expiresAt: number };
type Failure = "invalid_callback" | "token_exchange" | "token_payload" | "profile_request" | "profile_payload";

export class PublicXAuthError extends Error {
  constructor(readonly reason: Failure, readonly status?: number) {
    super("Public X authentication could not be completed");
  }
}

const hostCookie = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: true,
  priority: "high" as const,
};
export const pendingAuthorizationCookieOptions = { ...hostCookie, maxAge: STATE_TTL };
export const publicSessionCookieOptions = { ...hostCookie, maxAge: SESSION_TTL };

/** The origin X will hand the reader back to, and the only one that can finish. */
const CALLBACK_ORIGIN = new URL(CALLBACK_URL).origin;

/**
 * Whether an X sign-in can actually complete on the origin being asked.
 *
 * `production-only` is not a policy choice made in this function; it is the
 * shape of the flow. `CALLBACK_URL` is registered with X as
 * `https://lionsofzion.io/auth/x/callback` and both cookies are `__Host-`
 * prefixed with `secure: true`, which no browser writes over plain http. A
 * local attempt would send the reader to production, arrive with no state
 * cookie, and fail at `invalid_callback`. Saying so up front is the difference
 * between an explanation and a dead end.
 *
 * **This asked `isProduction()` until it was caught not working.** Both local
 * `.env.local` files on the maintainer's machine declare
 * `VERCEL_ENV="production"`, so `isProduction()` was true on localhost, the
 * gate never fired, and `GET http://localhost:3100/auth/x` really did answer
 * `302` to x.com with a `__Host-` cookie the browser then refused — the exact
 * dead end the gate exists to prevent. An environment variable is a *claim*
 * about where the code is running; it can be written by anyone with a text
 * editor.
 *
 * So the question asked here is the one that actually decides the outcome: is
 * the browser on the origin X was told to return to, and where a `__Host-`
 * cookie can be written? No headers, or an origin that does not match, means
 * `production-only` — this fails to the strict side, because starting a flow
 * that cannot finish is worse than declining one that could.
 */
export function publicXAvailability(headers?: Headers): ProviderAvailability {
  const configured =
    xOAuthClientIdIfConfigured() && xOAuthClientSecretIfConfigured() && xAuthSessionSecretIfConfigured();
  if (!configured) return "unconfigured";
  return requestOrigin(headers) === CALLBACK_ORIGIN ? "ready" : "production-only";
}

/**
 * The public origin of the request, as the browser sees it.
 *
 * On Vercel the function is reached through a proxy, so `host` alone is not
 * the whole answer — `x-forwarded-host` and `x-forwarded-proto` carry what the
 * reader actually typed. Both are proxy-controlled headers, which is safe for
 * this use: the worst a forged one can do is *unlock* an X sign-in that then
 * fails at the callback for the same reason it would have anyway. It cannot
 * mint a session, because the state cookie and PKCE verifier are still checked.
 */
function requestOrigin(headers?: Headers): string | null {
  const host = headers?.get("x-forwarded-host") ?? headers?.get("host");
  if (!host) return null;
  const proto = headers?.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
}

export function beginPublicXAuthorization(): { authorizationUrl: string; stateCookie: string } {
  const state = randomValue();
  const verifier = randomValue();
  const authorization = new URL(AUTHORIZE_URL);
  authorization.search = new URLSearchParams({
    response_type: "code",
    client_id: xOAuthClientId(),
    redirect_uri: CALLBACK_URL,
    scope: "tweet.read users.read",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return {
    authorizationUrl: authorization.toString(),
    stateCookie: sign({ version: 1, state, verifier, expiresAt: now() + STATE_TTL }),
  };
}

/** The X access token is used only for `/2/users/me`; it is never persisted. */
export async function completePublicXAuthorization(
  params: URLSearchParams,
  value: string | undefined,
): Promise<PublicXProfile> {
  const code = params.get("code");
  const state = params.get("state");
  const pending = value ? readPending(value) : null;
  if (!code || !state || !pending || !safeEqual(state, pending.state)) {
    throw new PublicXAuthError("invalid_callback");
  }

  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Basic ${basicCredentials()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: CALLBACK_URL,
      code_verifier: pending.verifier,
    }),
  });
  if (!tokenResponse.ok) throw new PublicXAuthError("token_exchange");
  const token = tokenFrom(await tokenResponse.json().catch(() => null));
  if (!token) throw new PublicXAuthError("token_payload");

  const profileResponse = await fetch(ME_URL, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!profileResponse.ok) throw new PublicXAuthError("profile_request", profileResponse.status);
  const profile = profileFrom(await profileResponse.json().catch(() => null));
  if (!profile) throw new PublicXAuthError("profile_payload");
  return profile;
}

export const createPublicSession = (profile: PublicXProfile): string =>
  sign({ version: 1, profile, expiresAt: now() + SESSION_TTL });

export function readPublicSession(value: string | undefined): PublicXProfile | null {
  const session = value ? readSigned<Session>(value) : null;
  return session?.version === 1 && future(session.expiresAt) && isProfile(session.profile)
    ? session.profile
    : null;
}

function readPending(value: string): Pending | null {
  const pending = readSigned<Pending>(value);
  return pending?.version === 1 && future(pending.expiresAt) && isUrlValue(pending.state) && isUrlValue(pending.verifier)
    ? pending
    : null;
}

function sign(payload: Pending | Session): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${mac(encoded)}`;
}

function readSigned<T>(value: string): T | null {
  const dot = value.indexOf(".");
  if (dot < 1 || dot !== value.lastIndexOf(".")) return null;
  const encoded = value.slice(0, dot);
  if (!safeEqual(value.slice(dot + 1), mac(encoded))) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function mac(value: string): string {
  return createHmac("sha256", xAuthSessionSecret()).update(value).digest("base64url");
}

function basicCredentials(): string {
  const encode = (value: string) => new URLSearchParams({ value }).toString().slice(6);
  return Buffer.from(`${encode(xOAuthClientId())}:${encode(xOAuthClientSecret())}`).toString("base64");
}

function tokenFrom(value: unknown): string | null {
  const token = value && typeof value === "object" ? (value as { access_token?: unknown }).access_token : null;
  return typeof token === "string" && token.length > 0 && token.length <= 4096 ? token : null;
}

function profileFrom(value: unknown): PublicXProfile | null {
  const data = value && typeof value === "object" ? (value as { data?: unknown }).data : null;
  if (!data || typeof data !== "object") return null;
  const profile = data as Record<string, unknown>;
  if (!text(profile.id, 128) || !text(profile.username, 128)) return null;
  const result: PublicXProfile = { id: profile.id, username: profile.username };
  if (text(profile.name, 256)) result.name = profile.name;
  if (safeImage(profile.profile_image_url)) result.image = profile.profile_image_url;
  return result;
}

function isProfile(value: unknown): value is PublicXProfile {
  return Boolean(
    value &&
      typeof value === "object" &&
      text((value as Record<string, unknown>).id, 128) &&
      text((value as Record<string, unknown>).username, 128),
  );
}

function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function safeImage(value: unknown): value is string {
  try {
    return text(value, 2048) && new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isUrlValue(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43,128}$/.test(value);
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function randomValue(): string {
  return randomBytes(32).toString("base64url");
}

function future(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value > now();
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}
