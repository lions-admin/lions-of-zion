import "server-only";

import { eq } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { appUser, type AppUser } from "@/server/db/schema";

export type HumanUserUpsertResult = {
  user: AppUser;
  created: boolean;
};

/** The authentication provider may issue a new subject when an existing
 * person connects an additional sign-in method. Email is the owner-approved
 * account link in this single-user system, so retain the existing database
 * identity (and its audit/capability links) rather than inserting a twin.
 *
 * The status-bearing variant lets public authentication distinguish a real
 * first registration from a repeat sign-in without sending duplicate
 * notifications. */
export async function upsertHumanUserWithStatus(
  database: Database,
  input: { externalId: string; email: string | null; displayName: string },
): Promise<HumanUserUpsertResult> {
  const bySubject = await database
    .select()
    .from(appUser)
    .where(eq(appUser.externalId, input.externalId))
    .limit(1);

  if (bySubject[0]) {
    const [updated] = await database
      .update(appUser)
      .set({ email: input.email, displayName: input.displayName, disabledAt: null })
      .where(eq(appUser.id, bySubject[0].id))
      .returning();
    if (updated) return { user: updated, created: false };
  }

  if (input.email) {
    const byEmail = await database
      .select()
      .from(appUser)
      .where(eq(appUser.email, input.email))
      .limit(1);
    if (byEmail[0]) {
      const [linked] = await database
        .update(appUser)
        .set({ externalId: input.externalId, email: input.email, displayName: input.displayName, disabledAt: null })
        .where(eq(appUser.id, byEmail[0].id))
        .returning();
      if (linked) return { user: linked, created: false };
    }
  }

  const [created] = await database
    .insert(appUser)
    .values({ ...input, isAutomated: false })
    .returning();
  if (!created) throw new Error("Could not initialize the authenticated user.");
  return { user: created, created: true };
}

/** Existing callers only need the durable user record. */
export async function upsertHumanUser(
  database: Database,
  input: { externalId: string; email: string | null; displayName: string },
): Promise<AppUser> {
  return (await upsertHumanUserWithStatus(database, input)).user;
}
