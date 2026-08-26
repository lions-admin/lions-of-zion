import { NextResponse } from "next/server";
import {
  X_PUBLIC_SESSION_COOKIE,
  publicSessionCookieOptions,
  readPublicSession,
} from "@/server/modules/public-x-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): NextResponse {
  const value = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)__Host-x-public-session=([^;]*)/)?.[1];
  const profile = readPublicSession(value);
  const response = NextResponse.json(
    { authenticated: profile !== null, profile },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
  if (value && !profile) {
    response.cookies.set({
      name: X_PUBLIC_SESSION_COOKIE,
      value: "",
      ...publicSessionCookieOptions,
      maxAge: 0,
    });
  }
  return response;
}
