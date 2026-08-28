import { syncPublicUser } from "@/server/modules/public-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const result = await syncPublicUser();
  return Response.json(result, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
