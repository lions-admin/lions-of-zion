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

export async function GET(request: NextRequest): Promise<Response> {
  // Use the platform cookie parser so the signed value is read correctly
  // even when the browser changes cookie ordering or formatting.
  const pendingCookie = request.cookies.get(X_OAUTH_STATE_COOKIE)?.value;
  try {
    const profile = await completePublicXAuthorization(
      new URL(request.url).searchParams,
      pendingCookie,
    );
    const response = NextResponse.redirect(new URL("/", callbackUrl), 303);
    response.cookies.set({
      name: X_PUBLIC_SESSION_COOKIE,
      value: createPublicSession(profile),
      ...publicSessionCookieOptions,
    });
    clearPendingCookie(response);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    // No credentials, query parameters, cookies or provider tokens reach logs.
    console.warn("[public-x-auth] callback failed", {
      stage: error instanceof PublicXAuthError ? error.reason : "unexpected",
      status: error instanceof PublicXAuthError ? error.status : undefined,
    });
    const response = new NextResponse("Authentication could not be completed.", {
      status: 400,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
    clearPendingCookie(response);
    return response;
  }
}

function clearPendingCookie(response: NextResponse): void {
  response.cookies.set({
    name: X_OAUTH_STATE_COOKIE,
    value: "",
    ...pendingAuthorizationCookieOptions,
    maxAge: 0,
  });
}
