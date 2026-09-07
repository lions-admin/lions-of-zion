import { NextRequest, NextResponse } from "next/server";
import {
  PublicXAuthError,
  X_OAUTH_STATE_COOKIE,
  X_PUBLIC_SESSION_COOKIE,
  completePublicXAuthorization,
  createPublicSession,
  createPublicWriteSession,
  pendingAuthorizationCookieOptions,
  publicSessionCookieOptions,
} from "@/server/modules/public-x-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const callbackUrl = "https://lionsofzion.io/auth/x/callback";
const ACCOUNT = "/account";

type Marker = "cancelled" | "failed";
const CANCELLATIONS = new Set(["access_denied", "user_cancelled_login", "user_cancelled_authorize"]);

export async function GET(request: NextRequest): Promise<Response> {
  const pendingCookie = request.cookies.get(X_OAUTH_STATE_COOKIE)?.value;
  const params = new URL(request.url).searchParams;

  const declined = params.get("error");
  if (declined) {
    return outcome(CANCELLATIONS.has(declined) ? "cancelled" : "failed");
  }

  try {
    const authorization = await completePublicXAuthorization(params, pendingCookie);
    const response = redirectTo(authorization.returnTo);
    response.cookies.set({
      name: X_PUBLIC_SESSION_COOKIE,
      value: authorization.mode === "posting"
        ? createPublicWriteSession(authorization)
        : createPublicSession(authorization.profile),
      ...publicSessionCookieOptions,
    });
    clearPendingCookie(response);
    return response;
  } catch (error) {
    console.warn("[public-x-auth] callback failed", {
      stage: error instanceof PublicXAuthError ? error.reason : "unexpected",
      status: error instanceof PublicXAuthError ? error.status : undefined,
    });
    return outcome("failed");
  }
}

function outcome(marker: Marker): NextResponse {
  const response = redirectToAccount(marker);
  clearPendingCookie(response);
  return response;
}

function redirectToAccount(marker?: Marker): NextResponse {
  const destination = new URL(ACCOUNT, callbackUrl);
  if (marker) destination.searchParams.set("x_error", marker);
  return redirect(destination);
}

function redirectTo(returnTo: string): NextResponse {
  return redirect(new URL(returnTo, callbackUrl));
}

function redirect(destination: URL): NextResponse {
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
