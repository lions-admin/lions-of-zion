import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { as, freshDatabase } from "@/server/db/testing";
import { appUser, capabilityGrant } from "@/server/db/schema";
import { upsertHumanUser } from "@/server/core/auth/users";

describe("authenticated user linking", () => {
  it("allows the service-role authentication bootstrap to create the owner record", async () => {
    const db = await freshDatabase();

    await as(db, "app_service", "service:admin-auth-bootstrap", async (serviceDb) => {
      const owner = await upsertHumanUser(serviceDb as never, {
        externalId: "provider-admin-subject",
        email: "admin@lionsofzion.io",
        displayName: "Lions of Zion Admin",
      });
      expect(owner.email).toBe("admin@lionsofzion.io");
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

    /* The helper only uses Drizzle's portable query builder; PGlite is the
       migration-accurate test driver whereas production uses Neon. */
    const linked = await upsertHumanUser(db as never, {
      externalId: "google-subject",
      email: "admin@lionsofzion.io",
      displayName: "Lions of Zion Admin",
    });

    expect(linked.id).toBe(original!.id);
    expect(linked.externalId).toBe("google-subject");
    const users = await db.select().from(appUser);
    expect(users).toHaveLength(1);
    const grants = await db.select().from(capabilityGrant).where(eq(capabilityGrant.userId, original!.id));
    expect(grants).toHaveLength(1);
  });
});
