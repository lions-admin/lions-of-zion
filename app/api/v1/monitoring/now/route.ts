import { handler, parseQuery } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { monitoringWindowSchema } from "@/server/contracts/narrative";
import { requireActor } from "@/server/core/auth/actor";
import { narratives } from "@/server/modules/narratives";

/**
 * What is circulating right now — and whether it is travelling or being pushed.
 *
 * The one number to read here is `distinctFamilies`, not `distinctActors`.
 * Twenty accounts inside a single source family is one megaphone; three
 * accounts across three families is a story actually spreading. A monitoring
 * view that ranks by account count reports the megaphone as the bigger event,
 * which is the exact mistake `source_family` was introduced to prevent.
 *
 * `reading` states that conclusion in words so no client has to invent its own
 * threshold, and `reportedReach` is labelled as reported because engagement
 * figures are the number a hostile actor most directly controls.
 *
 * Staff-only: this exposes unpublished assessments and actor attributions,
 * neither of which is a public finding.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  const window = parseQuery(request, monitoringWindowSchema);
  return ok(await narratives().now(window));
});
