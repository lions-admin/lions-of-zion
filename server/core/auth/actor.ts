import "server-only";

import { eq } from "drizzle-orm";
import { ApiError } from "@/server/http/responses";
import { adminEmail, appEnv } from "@/server/core/config";
import { db } from "@/server/db/client";
import { capabilityGrant } from "@/server/db/schema";
import { neonAuth } from "./neon";
import { readGoogleSession } from "./google-session";
import { upsertHumanUser } from "./users";
import type { Actor } from "@/server/core/audit";

const actors = new WeakMap<Request, Actor>();
const capabilities = new Map<string, ReadonlySet<string>>();

export const ADMIN_CAPABILITIES = [
  "assessment.approve",
  "assessment.publish",
  "approval.grant",
  "evidence.restricted.read",
  "policy.manage",
] as const;

type SessionUser = { id: string; email?: string | null; name?: string | null };

/** Authenticate once at the route boundary and cache the actor on the Request.
 * Individual routes still call `requireActor`, so an omitted central wrapper
 * cannot silently turn into authorization. */
export async function authenticateAdmin(request: Request): Promise<Actor> {
  if (appEnv() === "development") {
    const label = request.headers.get("x-actor-label")?.trim();
    if (label) {
      const actor = { label, userId: null };
      actors.set(request, actor);
      capabilities.set(label, new Set(ADMIN_CAPABILITIES));
      return actor;
    }
  }

  const googleUser = await readGoogleSession(request);
  const result = googleUser ? null : await neonAuth().getSession();
  const user = (googleUser ?? result?.data?.user ?? null) as SessionUser | null;
  const email = user?.email?.trim().toLowerCase();
  if (!user || !email) throw new ApiError("UNAUTHENTICATED", "Please sign in to continue.");
  if (email !== adminEmail()) {
    throw new ApiError("FORBIDDEN", "This account is not authorized for the admin area.");
  }

  const actor = await ensureAdminActor(user, email);
  actors.set(request, actor);
  capabilities.set(actor.label, new Set(ADMIN_CAPABILITIES));
  return actor;
}

/** Registers an anonymous actor prepared by the HTTP boundary. */
export function registerActor(request: Request, actor: Actor): void {
  actors.set(request, actor);
}

export function requireActor(request: Request): Actor {
  const actor = actors.get(request);
  if (actor) return actor;
  throw new ApiError("UNAUTHENTICATED", "Please sign in to continue.");
}

/**
 * Capability checks read the grants loaded for the authenticated actor and
 * fail closed when a route asks for anything outside that set.
 *
 * **Deliberately called from nowhere, and that is the decision — not an
 * oversight.** There is exactly one account: `ADMIN_EMAIL` is the only address
 * `app/api/auth/[...path]` will accept a signup for, `ensureAdminActor` is the
 * only writer of `app_user`, and it grants all of `ADMIN_CAPABILITIES` at every
 * sign-in. A capability check against an actor who holds every capability can
 * only ever pass, so wiring it into routes today would add a way to be locked
 * out and no way to be protected.
 *
 * What does protect these operations is not this function. The publish gate,
 * the human-reviewer rule and assessment immutability are SQL triggers in
 * `server/db/migrations/`, and they hold for every caller on every path —
 * including one that forgot to call this. The one capability with real teeth,
 * `evidence.restricted.read`, is enforced by the `evidence_staff_reads_
 * unrestricted` RLS policy reading `capability_grant` directly.
 *
 * Wire this up when a second account exists — an editor who may write an
 * assessment but not publish it. Until then, narrowing `ADMIN_CAPABILITIES` or
 * adding calls here locks the owner out of their own admin area.
 * `tests/admin-capabilities.test.ts` pins that. See `.ai/DECISIONS.md`.
 */
export function requireCapability(actor: Actor, capability: string): void {
  if (!capabilities.get(actor.label)?.has(capability)) {
    throw new ApiError("FORBIDDEN", `Missing required capability: ${capability}.`);
  }
}

async function ensureAdminActor(user: SessionUser, email: string): Promise<Actor> {
  const database = db();
  const displayName = user.name?.trim() || email;
  const row = await upsertHumanUser(database, { externalId: user.id, email, displayName });

  for (const capability of ADMIN_CAPABILITIES) {
    await database
      .insert(capabilityGrant)
      .values({
        userId: row.id,
        capability,
        grantedBy: row.id,
        rationale: "Bootstrap grant for the single account owner configured by ADMIN_EMAIL.",
      })
      .onConflictDoNothing();
  }

  const granted = await database
    .select({ capability: capabilityGrant.capability })
    .from(capabilityGrant)
    .where(eq(capabilityGrant.userId, row.id));
  capabilities.set(displayName, new Set(granted.map((item) => item.capability)));
  return { userId: row.id, label: displayName };
}
