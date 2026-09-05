import { NextRequest, NextResponse } from "next/server";
import {
  PublicXAuthError,
  X_OAUTH_STATE_COOKIE,
  X_PUBLIC_SESSION_COOKIE,
  completePublicXAuthorization,
  createPublicSession,
  pendingAuthorizationCookieOptions,
  publicSessionCookieOptions,
} from "@/server/modules/public-x-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const callbackUrl = "https://lionsofzion.io/auth/x/callback";
const ACCOUNT = "/account";

/**
 * The only three things this endpoint will ever say out loud.
 *
 * The reader arrives here from x.com, so the outcome has to be carried in the
 * URL — and a URL is the least private thing in a browser: it reaches the
 * history, the referrer, and any analytics on the page it lands on. So the
 * marker is drawn from a closed set of our own words. Nothing from the
 * provider is reflected: not its `error` value, not a status, and certainly
 * not the code, state or verifier.
 */
type Marker = "cancelled" | "failed";

/** X's spelling of "the reader pressed Cancel"; anything else is a failure. */
const CANCELLATIONS = new Set(["access_denied", "user_cancelled_login", "user_cancelled_authorize"]);

export async function GET(request: NextRequest): Promise<Response> {
  // Use the platform cookie parser so the signed value is read correctly
  // even when the browser changes cookie ordering or formatting.
  const pendingCookie = request.cookies.get(X_OAUTH_STATE_COOKIE)?.value;
  const params = new URL(request.url).searchParams;

  /* A cancellation is not a fault, and it should not read like one. X returns
     `error=access_denied` with no `code`, which would otherwise fall through
     to `invalid_callback` and be logged and reported as a failure. */
  const declined = params.get("error");
  if (declined) {
    return outcome(CANCELLATIONS.has(declined) ? "cancelled" : "failed");
  }

  try {
    const profile = await completePublicXAuthorization(params, pendingCookie);
    const response = redirectToAccount();
    response.cookies.set({
      name: X_PUBLIC_SESSION_COOKIE,
      value: createPublicSession(profile),
      ...publicSessionCookieOptions,
    });
    clearPendingCookie(response);
    return response;
  } catch (error) {
    // No credentials, query parameters, cookies or provider tokens reach logs.
    console.warn("[public-x-auth] callback failed", {
      stage: error instanceof PublicXAuthError ? error.reason : "unexpected",
      status: error instanceof PublicXAuthError ? error.status : undefined,
    });
    return outcome("failed");
  }
}

/** Every exit ends on the account page, and every exit drops the state cookie. */
function outcome(marker: Marker): NextResponse {
  const response = redirectToAccount(marker);
  clearPendingCookie(response);
  return response;
}

function redirectToAccount(marker?: Marker): NextResponse {
  const destination = new URL(ACCOUNT, callbackUrl);
  if (marker) destination.searchParams.set("x_error", marker);
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function clearPendingCookie(response: NextResponse): void {
  response.cookies.set({
    name: X_OAUTH_STATE_COOKIE,
    value: "",
    ...pendingAuthorizationCookieOptions,
    maxAge: 0,
  });
}
