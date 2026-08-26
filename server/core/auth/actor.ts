import "server-only";

import { eq } from "drizzle-orm";
import { ApiError } from "@/server/http/responses";
import { adminEmail, appEnv } from "@/server/core/config";
import { db } from "@/server/db/client";
import { appUser, capabilityGrant } from "@/server/db/schema";
import { neonAuth } from "./neon";
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

  const result = await neonAuth().getSession();
  const user = (result.data?.user ?? null) as SessionUser | null;
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
 * Capability checks — PLACEHOLDER, and deliberately fail-closed.
 *
 * Returning `true` here until Phase 8 would mean every route silently runs
 * without authorization and every test of a protected path passes for the
 * wrong reason. Refusing means protected routes are visibly unbuilt.
 */
export function requireCapability(actor: Actor, capability: string): void {
  if (!capabilities.get(actor.label)?.has(capability)) {
    throw new ApiError("FORBIDDEN", `Missing required capability: ${capability}.`);
  }
}

async function ensureAdminActor(user: SessionUser, email: string): Promise<Actor> {
  const database = db();
  const displayName = user.name?.trim() || email;
  const rows = await database
    .insert(appUser)
    .values({ externalId: user.id, email, displayName, isAutomated: false })
    .onConflictDoUpdate({
      target: appUser.externalId,
      set: { email, displayName, disabledAt: null },
    })
    .returning();
  const row = rows[0];
  if (!row) throw new ApiError("INTERNAL_ERROR", "Could not initialize the admin account.");

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
