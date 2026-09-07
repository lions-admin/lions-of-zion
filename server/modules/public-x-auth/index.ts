import "server-only";

/** The routes receive only this narrow X authentication facade. */
export {
  PublicXAuthError,
  X_OAUTH_STATE_COOKIE,
  X_PUBLIC_SESSION_COOKIE,
  beginPublicXAuthorization,
  completePublicXAuthorization,
  createPublicSession,
  createPublicWriteSession,
  getPublicXWriteAccess,
  pendingAuthorizationCookieOptions,
  publicSessionCookieOptions,
  publicXAvailability,
  readPublicSession,
  type PublicXAuthorization,
  type PublicXProfile,
  type PublicXWriteAccess,
} from "@/server/core/auth/public-x";
