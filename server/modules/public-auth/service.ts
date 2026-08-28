import "server-only";

import { db, withDatabaseRole } from "@/server/db/client";
import { appUser } from "@/server/db/schema";
import { neonAuth } from "@/server/core/auth/neon";
import { count as countRows } from "drizzle-orm";

type AuthenticatedUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export async function syncPublicUser(): Promise<{ synced: boolean }> {
  const result = await neonAuth().getSession();
  const user = (result.data?.user ?? null) as AuthenticatedUser | null;
  if (!user) return { synced: false };

  const email = user.email?.trim().toLowerCase() || null;
  const displayName = user.name?.trim() || email || "Lions of Zion user";

  await withDatabaseRole("app_service", "service:public-auth", async () => {
    await db()
      .insert(appUser)
      .values({
        externalId: user.id,
        email,
        displayName,
        isAutomated: false,
      })
      .onConflictDoUpdate({
        target: appUser.externalId,
        set: { email, displayName, disabledAt: null },
      });
  });

  return { synced: true };
}

export async function registeredUserCount(): Promise<number> {
  const [row] = await db().select({ count: countRows() }).from(appUser);
  return row?.count ?? 0;
}
