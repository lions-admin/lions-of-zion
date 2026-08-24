import { handler, parseBody, parseQuery } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { listReportsSchema, submitReportSchema } from "@/server/contracts/report";
import { requireActor } from "@/server/core/auth/actor";
import { bucketFor, REPORT_SUBMISSION } from "@/server/core/rate-limit";
import { rateLimit, reports } from "@/server/modules/reports";

/**
 * The public submission endpoint — the only write path in the system open to
 * an unauthenticated stranger.
 *
 * POST is therefore rate limited and returns a receipt rather than the row:
 * nothing the submitter sent is echoed back, which keeps the endpoint from
 * being a trivial reflector and keeps unreviewed public text out of
 * responses. GET is staff-only.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  const filters = parseQuery(request, listReportsSchema);
  return ok({ reports: await reports().list(filters) });
});

export const POST = handler(async (request) => {
  await rateLimit(bucketFor(request, "report"), REPORT_SUBMISSION);

  const input = await parseBody(request, submitReportSchema);
  const row = await reports().submit(
    input,
    request.headers.get("x-forwarded-for") ?? undefined,
  );

  return created(
    { publicId: row.publicId, status: row.status, receivedAt: row.createdAt.toISOString() },
    `/api/v1/reports/${row.id}`,
  );
});
