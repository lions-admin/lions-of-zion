import "server-only";

import { and, count as countRows, eq, isNull } from "drizzle-orm";
import { db, withDatabaseRole } from "@/server/db/client";
import { appUser, capabilityGrant } from "@/server/db/schema";
import { adminEmail } from "@/server/core/config";
import { sendWorkspaceEmail } from "@/server/core/email";
import { briefingLog } from "@/server/core/log";
import { neonAuth } from "@/server/core/auth/neon";
import { readGoogleSession } from "@/server/core/auth/google-session";
import { upsertHumanUserWithStatus, type HumanUserUpsertResult } from "@/server/core/auth/users";

type AuthenticatedUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

async function notifyNewRegistration(result: HumanUserUpsertResult, provider: string): Promise<void> {
  if (!result.created) return;

  const { user } = result;
  const registeredAt = user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt);
  const text = [
    "A new public reader registered on Lions of Zion.",
    "",
    `Name: ${user.displayName}`,
    `Email: ${user.email ?? "not provided"}`,
    `Provider: ${provider}`,
    `Internal user ID: ${user.id}`,
    `External provider ID: ${user.externalId}`,
    `Registered at: ${registeredAt}`,
  ].join("\n");

  try {
    await sendWorkspaceEmail({
      to: adminEmail(),
      subject: `Lions of Zion: new registration — ${user.displayName}`,
      text,
    });
  } catch (cause) {
    // Registration is durable before notification. A mail outage must never
    // turn a successful sign-in into a failed or repeated registration.
    briefingLog("error", "public.registration.email_failed", {}, {
      userId: user.id,
      provider,
      errorClass: cause instanceof Error ? cause.name : "UnknownError",
    });
  }
}

async function syncAuthenticatedUser(
  user: AuthenticatedUser,
  actorLabel: string,
): Promise<HumanUserUpsertResult> {
  const email = user.email?.trim().toLowerCase() || null;
  const displayName = user.name?.trim() || email || "Lions of Zion user";
  return withDatabaseRole("app_service", actorLabel, async () =>
    upsertHumanUserWithStatus(db(), { externalId: user.id, email, displayName }),
  );
}

export async function syncPublicUser(request?: Request): Promise<{ synced: boolean }> {
  const googleUser = request ? await readGoogleSession(request) : null;
  const result = googleUser ? null : await neonAuth().getSession();
  const user = (googleUser ?? result?.data?.user ?? null) as AuthenticatedUser | null;
  if (!user) return { synced: false };

  const synced = await syncAuthenticatedUser(user, "service:public-auth");
  if (googleUser) await notifyNewRegistration(synced, "Google");

  return { synced: true };
}

export async function syncVerifiedGoogleUser(user: AuthenticatedUser): Promise<void> {
  const synced = await syncAuthenticatedUser(user, "service:google-auth");
  await notifyNewRegistration(synced, "Google");
}

/** Public readers are human app_user rows that do not hold a staff capability. */
export async function registeredUserCount(): Promise<number> {
  const [row] = await db()
    .select({ count: countRows() })
    .from(appUser)
    .leftJoin(capabilityGrant, eq(capabilityGrant.userId, appUser.id))
    .where(and(eq(appUser.isAutomated, false), isNull(capabilityGrant.userId)));
  return row?.count ?? 0;
}
