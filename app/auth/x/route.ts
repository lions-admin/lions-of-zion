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
  /* Starting a flow that provably cannot finish is worse than not starting
     one. Outside production the `__Host-` state cookie is never written, and
     the callback is registered on lionsofzion.io regardless — the reader would
     be handed to X and returned to a page that could only fail. Send them back
     to the account page, which knows how to say why. */
  if (publicXAvailability(request.headers) !== "ready") return unavailable(request);

  const { authorizationUrl, stateCookie } = beginPublicXAuthorization();
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
