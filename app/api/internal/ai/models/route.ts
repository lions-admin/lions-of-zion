import { gateway } from "ai";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireInternalSecret } from "@/server/http/internal-guard";
import { MODEL_PROFILES } from "@/server/core/config";

/**
 * What the gateway actually offers, next to what this project asks for.
 *
 * Exists because gateway slugs move and a stale one fails at call time with a
 * 400 rather than at deploy time — see the note on `MODEL_PROFILES`. Run this
 * after provisioning, and after any model change, to confirm every profile
 * still resolves to something real.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireInternalSecret(request);

  const available = await gateway.getAvailableModels();
  const ids = new Set(available.models.map((m) => m.id));

  const profiles = Object.entries(MODEL_PROFILES).map(([profile, slug]) => ({
    profile,
    slug,
    available: ids.has(slug),
  }));

  return ok({
    profiles,
    /* Loud, because a false here is a route that will 400 in production. */
    allResolve: profiles.every((p) => p.available),
    availableCount: ids.size,
  });
});
