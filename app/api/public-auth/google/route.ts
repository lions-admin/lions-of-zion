import { NextResponse } from "next/server";
import { z } from "zod";
import { createGoogleSession, GOOGLE_SESSION_COOKIE, verifyGoogleCredential } from "@/server/core/auth/google-session";
import { syncVerifiedGoogleUser } from "@/server/modules/public-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ credential: z.string().min(20) });

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ message: "The request origin is not allowed." }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Invalid Google sign-in request." }, { status: 400 });
  try {
    const user = await verifyGoogleCredential(parsed.data.credential);
    await syncVerifiedGoogleUser(user);
    const response = NextResponse.json({ user });
    response.cookies.set(GOOGLE_SESSION_COOKIE, await createGoogleSession(user), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    console.warn("Google identity sign-in rejected", error instanceof Error ? error.message : String(error));
    return Response.json({ message: "Google sign-in could not be verified." }, { status: 401 });
  }
}
