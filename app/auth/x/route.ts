import { NextResponse } from "next/server";
import {
  X_OAUTH_STATE_COOKIE,
  beginPublicXAuthorization,
  pendingAuthorizationCookieOptions,
} from "@/server/modules/public-x-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): NextResponse {
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
