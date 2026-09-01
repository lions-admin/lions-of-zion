import { readGoogleSession } from "@/server/core/auth/google-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return Response.json({ user: await readGoogleSession(request) }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
