import { NextResponse } from "next/server";
import {
  X_PUBLIC_SESSION_COOKIE,
  publicSessionCookieOptions,
} from "@/server/modules/public-x-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set({
    name: X_PUBLIC_SESSION_COOKIE,
    value: "",
    ...publicSessionCookieOptions,
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
