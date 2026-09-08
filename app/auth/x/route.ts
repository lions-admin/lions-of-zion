import { NextResponse, type NextRequest } from "next/server";
import {
  X_OAUTH_STATE_COOKIE,
  beginPublicXAuthorization,
  pendingAuthorizationCookieOptions,
  publicXAvailability,
} from "@/server/modules/public-x-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest): NextResponse {
  if (publicXAvailability(request.headers) !== "ready") return unavailable(request);

  const returnTo = request.nextUrl.searchParams.get("return_to") ?? "/account";

  // Public X authorization is identity-only. Archive media sharing no longer
  // requests tweet/media write permission or persistent access to a reader's
  // account. A stale `intent=post` URL is intentionally ignored.
  const { authorizationUrl, stateCookie } = beginPublicXAuthorization(returnTo, "identity");
  const response = NextResponse.redirect(authorizationUrl, 302);
  response.cookies.set({
    name: X_OAUTH_STATE_COOKIE,
    value: stateCookie,
    ...pendingAuthorizationCookieOptions,
  });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function unavailable(request: NextRequest): NextResponse {
  const destination = new URL("/account", request.url);
  destination.searchParams.set("x_error", "unavailable");
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
