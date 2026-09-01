import { syncPublicUser } from "@/server/modules/public-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const result = await syncPublicUser(request);
  return Response.json(result, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
