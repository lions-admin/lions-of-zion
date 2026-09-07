import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { as, freshDatabase } from "@/server/db/testing";
import { appUser, capabilityGrant } from "@/server/db/schema";
import { upsertHumanUserWithStatus } from "@/server/core/auth/users";

describe("authenticated user linking", () => {
  it("marks a genuinely new authenticated user as newly created", async () => {
    const db = await freshDatabase();

    await as(db, "app_service", "service:admin-auth-bootstrap", async (serviceDb) => {
      const result = await upsertHumanUserWithStatus(serviceDb as never, {
        externalId: "provider-admin-subject",
        email: "admin@lionsofzion.io",
        displayName: "Lions of Zion Admin",
      });
      expect(result.created).toBe(true);
      expect(result.user.email).toBe("admin@lionsofzion.io");
      expect(await serviceDb.select().from(appUser)).toHaveLength(1);
    });
  });

  it("links a new provider subject to the existing email record without creating a second user", async () => {
    const db = await freshDatabase();
    const [original] = await db.insert(appUser).values({
      externalId: "password-subject",
      email: "admin@lionsofzion.io",
      displayName: "Original admin",
      isAutomated: false,
    }).returning();
    await db.insert(capabilityGrant).values({
      userId: original!.id,
      capability: "assessment.publish",
      grantedBy: original!.id,
      rationale: "Existing owner permission.",
    });

    const linked = await upsertHumanUserWithStatus(db as never, {
      externalId: "google-subject",
      email: "admin@lionsofzion.io",
      displayName: "Lions of Zion Admin",
    });

    expect(linked.created).toBe(false);
    expect(linked.user.id).toBe(original!.id);
    expect(linked.user.externalId).toBe("google-subject");
    const users = await db.select().from(appUser);
    expect(users).toHaveLength(1);
    const grants = await db.select().from(capabilityGrant).where(eq(capabilityGrant.userId, original!.id));
    expect(grants).toHaveLength(1);
  });

  it("does not mark a repeat sign-in for the same provider subject as a new registration", async () => {
    const db = await freshDatabase();
    const first = await upsertHumanUserWithStatus(db as never, {
      externalId: "google-reader-subject",
      email: "reader@example.test",
      displayName: "Reader",
    });
    const repeat = await upsertHumanUserWithStatus(db as never, {
      externalId: "google-reader-subject",
      email: "reader@example.test",
      displayName: "Reader Updated",
    });

    expect(first.created).toBe(true);
    expect(repeat.created).toBe(false);
    expect(repeat.user.id).toBe(first.user.id);
    expect(await db.select().from(appUser)).toHaveLength(1);
  });
});
