import { handler } from "@/server/http/handler";
import { notFound, ok } from "@/server/http/responses";
import { entityTypeSchema } from "@/server/contracts/enums";
import { listEntityVersionsSchema } from "@/server/contracts/admin-console";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request, _ctx, { params }: { params: Promise<{ entityType: string; entityId: string }> }) => {
  const { entityType, entityId } = await params;
  requireActor(request);
  const parsedType = entityTypeSchema.safeParse(entityType);
  if (!parsedType.success) throw notFound("Entity type");
  const query = listEntityVersionsSchema.parse({
    entityType: parsedType.data,
    entityId,
    ...Object.fromEntries(new URL(request.url).searchParams),
  });
  return ok(await adminConsole().entityVersions(query));
});
