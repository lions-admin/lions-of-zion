import "server-only";

import { db, withDatabaseRole } from "@/server/db/client";
import { appUser } from "@/server/db/schema";
import { neonAuth } from "@/server/core/auth/neon";
import { readGoogleSession } from "@/server/core/auth/google-session";
import { upsertHumanUser } from "@/server/core/auth/users";
import { count as countRows } from "drizzle-orm";

type AuthenticatedUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export async function syncPublicUser(request?: Request): Promise<{ synced: boolean }> {
  const googleUser = request ? await readGoogleSession(request) : null;
  const result = googleUser ? null : await neonAuth().getSession();
  const user = (googleUser ?? result?.data?.user ?? null) as AuthenticatedUser | null;
  if (!user) return { synced: false };

  const email = user.email?.trim().toLowerCase() || null;
  const displayName = user.name?.trim() || email || "Lions of Zion user";

  await withDatabaseRole("app_service", "service:public-auth", async () => {
    await upsertHumanUser(db(), { externalId: user.id, email, displayName });
  });

  return { synced: true };
}

export async function syncVerifiedGoogleUser(user: AuthenticatedUser): Promise<void> {
  const email = user.email?.trim().toLowerCase() || null;
  const displayName = user.name?.trim() || email || "Lions of Zion user";
  await withDatabaseRole("app_service", "service:google-auth", async () => {
    await upsertHumanUser(db(), { externalId: user.id, email, displayName });
  });
}

export async function registeredUserCount(): Promise<number> {
  const [row] = await db().select({ count: countRows() }).from(appUser);
  return row?.count ?? 0;
}
