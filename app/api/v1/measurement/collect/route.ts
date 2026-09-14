import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { measurementCollectSchema } from "@/server/contracts/measurement";
import { bucketFor, MEASUREMENT_COLLECT } from "@/server/core/rate-limit";
import { adminEmail } from "@/server/core/config";
import { measurement, rateLimit } from "@/server/modules/measurement";
import { readGoogleSession } from "@/server/core/auth/google-session";

/**
 * Public first-party measurement ingest.
 *
 * Failure here must never break the public site: the client ignores send
 * errors. This route still validates strictly and rate-limits cheaply.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (request) => {
  await rateLimit(bucketFor(request, "measurement"), MEASUREMENT_COLLECT);
  /* Also bucket by visitor after parse — cheap second ceiling. */
  const input = await parseBody(request, measurementCollectSchema);
  await rateLimit(bucketFor(request, `measurement:${input.visitor_id}`), MEASUREMENT_COLLECT);

  let isStaff = false;
  try {
    const google = await readGoogleSession(request);
    const email = google?.email?.trim().toLowerCase();
    if (email && email === adminEmail()) isStaff = true;
  } catch {
    /* Staff detection is best-effort; never fail collect. */
  }

  const result = await measurement().collect(input, {
    headers: request.headers,
    isStaff,
    userAgent: request.headers.get("user-agent"),
  });
  return ok(result);
});
