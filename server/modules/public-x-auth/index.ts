import "server-only";

/** The routes receive only this narrow, token-free X authentication facade. */
export {
  PublicXAuthError,
  X_OAUTH_STATE_COOKIE,
  X_PUBLIC_SESSION_COOKIE,
  beginPublicXAuthorization,
  completePublicXAuthorization,
  createPublicSession,
  pendingAuthorizationCookieOptions,
  publicSessionCookieOptions,
  publicXAvailability,
  readPublicSession,
  type PublicXProfile,
} from "@/server/core/auth/public-x";
