import { NextRequest, NextResponse } from "next/server";
import { xArchiveMediaPostSchema } from "@/server/contracts/x-media-share";
import {
  X_PUBLIC_SESSION_COOKIE,
  postArchiveMediaToX,
  publicSessionCookieOptions,
} from "@/server/modules/x-media-share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LIVE_ORIGIN = "https://lionsofzion.io";

export async function POST(request: NextRequest): Promise<Response> {
  if (request.headers.get("origin") !== LIVE_ORIGIN) {
    return response({ status: "unauthorized" }, 403);
  }

  const parsed = xArchiveMediaPostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { type: "about:blank", title: "Invalid request", status: 400, code: "INVALID_REQUEST" },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const session = request.cookies.get(X_PUBLIC_SESSION_COOKIE)?.value;
  const result = await postArchiveMediaToX(parsed.data, session);
  const status =
    result.body.status === "posted"
      ? 200
      : result.body.status === "unauthorized"
        ? 401
        : result.body.status === "media_unavailable"
          ? 409
          : 502;

  const output = response(result.body, status);
  if (result.sessionCookie) {
    output.cookies.set({
      name: X_PUBLIC_SESSION_COOKIE,
      value: result.sessionCookie,
      ...publicSessionCookieOptions,
    });
  }
  return output;
}

function response(body: object, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: noStoreHeaders() });
}

function noStoreHeaders(): HeadersInit {
  return { "Cache-Control": "no-store, max-age=0" };
}
