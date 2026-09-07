import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
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
const ACCESS_TOKEN_FALLBACK_TTL = 2 * 60 * 60;
const REFRESH_SKEW = 60;
const SESSION_AAD = Buffer.from("lions-of-zion:x-public-session:v2", "utf8");
const IDENTITY_SCOPES = ["tweet.read", "users.read"] as const;
const POSTING_SCOPES = ["tweet.read", "users.read", "tweet.write", "media.write", "offline.access"] as const;

export const X_OAUTH_STATE_COOKIE = "__Host-x-oauth-state";
export const X_PUBLIC_SESSION_COOKIE = "__Host-x-public-session";

export type PublicXAuthorizationMode = "identity" | "posting";
type Pending = {
  version: 2;
  state: string;
  verifier: string;
  returnTo: string;
  mode: PublicXAuthorizationMode;
  expiresAt: number;
};
type LegacyPending = { version: 1; state: string; verifier: string; expiresAt: number };
export type PublicXProfile = { id: string; username: string; name?: string; image?: string };
type LegacySession = { version: 1; profile: PublicXProfile; expiresAt: number };
type CredentialSession = {
  version: 2;
  profile: PublicXProfile;
  accessToken: string;
  refreshToken?: string;
  accessExpiresAt: number;
  scopes: string[];
  expiresAt: number;
};
export type PublicXAuthorization = {
  mode: PublicXAuthorizationMode;
  profile: PublicXProfile;
  accessToken: string;
  refreshToken?: string;
  accessExpiresAt: number;
  scopes: string[];
  returnTo: string;
};
export type PublicXWriteAccess = {
  profile: PublicXProfile;
  accessToken: string;
  sessionCookie?: string;
};
type Failure =
  | "invalid_callback"
  | "token_exchange"
  | "token_payload"
  | "profile_request"
  | "profile_payload"
  | "refresh_failed";

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
const CALLBACK_ORIGIN = new URL(CALLBACK_URL).origin;

export function publicXAvailability(headers?: Headers): ProviderAvailability {
  const configured =
    xOAuthClientIdIfConfigured() && xOAuthClientSecretIfConfigured() && xAuthSessionSecretIfConfigured();
  if (!configured) return "unconfigured";
  return requestOrigin(headers) === CALLBACK_ORIGIN ? "ready" : "production-only";
}

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

/**
 * Ordinary account sign-in remains read-only. Posting permissions are requested
 * only when a reader explicitly starts the native-media posting flow.
 */
export function beginPublicXAuthorization(
  returnTo = "/account",
  mode: PublicXAuthorizationMode = "identity",
): { authorizationUrl: string; stateCookie: string } {
  const state = randomValue();
  const verifier = randomValue();
  const scopes = mode === "posting" ? POSTING_SCOPES : IDENTITY_SCOPES;
  const authorization = new URL(AUTHORIZE_URL);
  authorization.search = new URLSearchParams({
    response_type: "code",
    client_id: xOAuthClientId(),
    redirect_uri: CALLBACK_URL,
    scope: scopes.join(" "),
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return {
    authorizationUrl: authorization.toString(),
    stateCookie: sign({
      version: 2,
      state,
      verifier,
      returnTo: normaliseReturnTo(returnTo),
      mode,
      expiresAt: now() + STATE_TTL,
    }),
  };
}

export async function completePublicXAuthorization(
  params: URLSearchParams,
  value: string | undefined,
): Promise<PublicXAuthorization> {
  const code = params.get("code");
  const state = params.get("state");
  const pending = value ? readPending(value) : null;
  if (!code || !state || !pending || !safeEqual(state, pending.state)) {
    throw new PublicXAuthError("invalid_callback");
  }

  const requestedScopes = pending.mode === "posting" ? [...POSTING_SCOPES] : [...IDENTITY_SCOPES];
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    cache: "no-store",
    headers: tokenHeaders(),
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: CALLBACK_URL,
      code_verifier: pending.verifier,
    }),
  });
  if (!tokenResponse.ok) throw new PublicXAuthError("token_exchange", tokenResponse.status);
  const token = tokenPayload(await tokenResponse.json().catch(() => null), requestedScopes);
  if (!token) throw new PublicXAuthError("token_payload");

  const profileResponse = await fetch(ME_URL, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token.accessToken}`, Accept: "application/json" },
  });
  if (!profileResponse.ok) throw new PublicXAuthError("profile_request", profileResponse.status);
  const profile = profileFrom(await profileResponse.json().catch(() => null));
  if (!profile) throw new PublicXAuthError("profile_payload");

  return {
    mode: pending.mode,
    profile,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    accessExpiresAt: now() + token.expiresIn,
    scopes: token.scopes,
    returnTo: pending.returnTo,
  };
}

/** Identity-only cookies never contain provider credentials. */
export const createPublicSession = (profile: PublicXProfile): string =>
  sign({ version: 1, profile, expiresAt: now() + SESSION_TTL });

/** Posting sessions seal user-context credentials in an encrypted HttpOnly cookie. */
export function createPublicWriteSession(authorization: PublicXAuthorization): string {
  if (authorization.mode !== "posting") {
    throw new Error("An identity-only X authorization cannot create a write session");
  }
  return seal({
    version: 2,
    profile: authorization.profile,
    accessToken: authorization.accessToken,
    refreshToken: authorization.refreshToken,
    accessExpiresAt: authorization.accessExpiresAt,
    scopes: authorization.scopes,
    expiresAt: now() + SESSION_TTL,
  });
}

export function readPublicSession(value: string | undefined): PublicXProfile | null {
  if (!value) return null;
  const credential = readCredentialSession(value);
  if (credential) return credential.profile;
  const session = readSigned<LegacySession>(value);
  return session?.version === 1 && future(session.expiresAt) && isProfile(session.profile)
    ? session.profile
    : null;
}

export async function getPublicXWriteAccess(value: string | undefined): Promise<PublicXWriteAccess | null> {
  if (!value) return null;
  const session = readCredentialSession(value);
  if (!session || !hasWriteScopes(session.scopes)) return null;
  if (session.accessExpiresAt > now() + REFRESH_SKEW) {
    return { profile: session.profile, accessToken: session.accessToken };
  }
  if (!session.refreshToken) return null;

  const refreshed = await refreshTokens(session.refreshToken, session.scopes);
  const replacement: CredentialSession = {
    ...session,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? session.refreshToken,
    accessExpiresAt: now() + refreshed.expiresIn,
    scopes: refreshed.scopes,
    expiresAt: now() + SESSION_TTL,
  };
  if (!hasWriteScopes(replacement.scopes)) return null;
  return {
    profile: replacement.profile,
    accessToken: replacement.accessToken,
    sessionCookie: seal(replacement),
  };
}

function readPending(value: string): Pending | null {
  const pending = readSigned<Pending | LegacyPending>(value);
  if (!pending || !future(pending.expiresAt) || !isUrlValue(pending.state) || !isUrlValue(pending.verifier)) {
    return null;
  }
  if (
    pending.version === 2 &&
    typeof pending.returnTo === "string" &&
    (pending.mode === "identity" || pending.mode === "posting")
  ) return pending;
  if (pending.version === 1) {
    return { ...pending, version: 2, returnTo: "/account", mode: "identity" };
  }
  return null;
}

function sign(payload: Pending | LegacyPending | LegacySession): string {
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

function seal(payload: CredentialSession): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  cipher.setAAD(SESSION_AAD);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v2", iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(".");
}

function readCredentialSession(value: string): CredentialSession | null {
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v2") return null;
  try {
    const iv = Buffer.from(parts[1], "base64url");
    const ciphertext = Buffer.from(parts[2], "base64url");
    const tag = Buffer.from(parts[3], "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", sessionKey(), iv);
    decipher.setAAD(SESSION_AAD);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    const session = JSON.parse(plaintext) as Partial<CredentialSession>;
    if (
      session.version !== 2 ||
      !future(session.expiresAt) ||
      !isProfile(session.profile) ||
      !text(session.accessToken, 4096) ||
      typeof session.accessExpiresAt !== "number" ||
      !Number.isFinite(session.accessExpiresAt) ||
      !Array.isArray(session.scopes) ||
      !session.scopes.every((scope) => text(scope, 128)) ||
      (session.refreshToken !== undefined && !text(session.refreshToken, 4096))
    ) return null;
    return session as CredentialSession;
  } catch {
    return null;
  }
}

function mac(value: string): string {
  return createHmac("sha256", xAuthSessionSecret()).update(value).digest("base64url");
}

function sessionKey(): Buffer {
  return createHash("sha256").update(xAuthSessionSecret()).digest();
}

function basicCredentials(): string {
  const encode = (value: string) => new URLSearchParams({ value }).toString().slice(6);
  return Buffer.from(`${encode(xOAuthClientId())}:${encode(xOAuthClientSecret())}`).toString("base64");
}

function tokenHeaders(): Record<string, string> {
  return {
    Authorization: `Basic ${basicCredentials()}`,
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
}

type ParsedToken = { accessToken: string; refreshToken?: string; expiresIn: number; scopes: string[] };

function tokenPayload(value: unknown, fallbackScopes: readonly string[]): ParsedToken | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  if (!text(payload.access_token, 4096)) return null;
  const expires = Number(payload.expires_in);
  const expiresIn = Number.isFinite(expires) && expires > 0 ? Math.floor(expires) : ACCESS_TOKEN_FALLBACK_TTL;
  const refreshToken = text(payload.refresh_token, 4096) ? payload.refresh_token : undefined;
  const scopeText = typeof payload.scope === "string" ? payload.scope.trim() : "";
  const scopes = scopeText ? scopeText.split(/\s+/).filter(Boolean) : [...fallbackScopes];
  return { accessToken: payload.access_token, refreshToken, expiresIn, scopes };
}

async function refreshTokens(refreshToken: string, fallbackScopes: readonly string[]): Promise<ParsedToken> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    cache: "no-store",
    headers: tokenHeaders(),
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) throw new PublicXAuthError("refresh_failed", response.status);
  const payload = tokenPayload(await response.json().catch(() => null), fallbackScopes);
  if (!payload) throw new PublicXAuthError("refresh_failed");
  return payload;
}

function hasWriteScopes(scopes: readonly string[]): boolean {
  const set = new Set(scopes);
  return set.has("tweet.write") && set.has("media.write");
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

function normaliseReturnTo(value: string): string {
  try {
    const url = new URL(value, CALLBACK_ORIGIN);
    if (url.origin !== CALLBACK_ORIGIN || !url.pathname.startsWith("/")) return "/account";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/account";
  }
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function randomValue(): string {
  return randomBytes(32).toString("base64url");
}

function future(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > now();
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}
