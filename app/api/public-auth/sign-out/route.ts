import { NextResponse } from "next/server";
import { GOOGLE_SESSION_COOKIE } from "@/server/core/auth/google-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const response = NextResponse.json({ signedOut: true });
  response.cookies.set(GOOGLE_SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
