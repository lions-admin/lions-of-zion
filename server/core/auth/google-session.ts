import "server-only";

import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import {
  googleAuthSessionSecret,
  googleAuthSessionSecretIfConfigured,
  googleIdentityClientId,
  googleIdentityClientIdIfConfigured,
} from "@/server/core/config";
import type { ProviderAvailability } from "@/server/contracts/public-session";

export const GOOGLE_SESSION_COOKIE = "__Secure-lz-google-session";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const encoder = new TextEncoder();

export type GoogleSessionUser = { id: string; email: string; name: string };

/**
 * Whether Google sign-in can be offered here.
 *
 * Two values, not one: the browser needs the client id to render the Identity
 * Services button, and the server needs the signing secret to turn the
 * returned credential into a session. Either missing and the button is a
 * button to nowhere, so both are required before this says `ready`.
 *
 * There is no `production-only` case. Google accepts `http://localhost` as an
 * authorised origin and the session cookie is `__Secure-` rather than
 * `__Host-`, so the local flow completes; X is the one that cannot.
 */
export function googlePublicAuthAvailability(): ProviderAvailability {
  return googleIdentityClientIdIfConfigured() && googleAuthSessionSecretIfConfigured()
    ? "ready"
    : "unconfigured";
}

function sessionKey(secret = googleAuthSessionSecret()): Uint8Array {
  return encoder.encode(secret);
}

function cookieValue(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}

export async function verifyGoogleCredential(credential: string): Promise<GoogleSessionUser> {
  const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
    audience: googleIdentityClientId(),
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });
  const subject = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!subject || !email || payload.email_verified !== true) {
    throw new Error("Google credential does not contain a verified email address.");
  }
  return { id: `google:${subject}`, email, name: name || email };
}

export async function createGoogleSession(user: GoogleSessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(sessionKey());
}

export async function readGoogleSession(request: Request): Promise<GoogleSessionUser | null> {
  const secret = googleAuthSessionSecretIfConfigured();
  const token = cookieValue(request, GOOGLE_SESSION_COOKIE);
  if (!secret || !token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(secret), { algorithms: ["HS256"] });
    const subject = typeof payload.sub === "string" ? payload.sub : "";
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    return subject && email ? { id: subject, email, name: name || email } : null;
  } catch {
    return null;
  }
}
