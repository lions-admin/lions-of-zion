import { describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import { appUser, informationItem, itemAssessment } from "@/server/db/schema";

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  observedRoles: [] as string[],
}));

/* The production wrapper needs a Neon WebSocket connection. This replacement
 * uses the PGlite role scope instead: it establishes the same app_public role
 * and identity on the same database that the route will query. A pass-through
 * would hide a missing view grant, which is the regression this test guards. */
vi.mock("@/server/db/client", () => ({
  db: () => {
    if (!state.db) throw new Error("No test database registered for this test.");
    return state.db;
  },
  withDatabaseRole: async (role: string, identity: string, fn: () => Promise<unknown>) => {
    if (!state.db) throw new Error("No test database registered for this test.");
    const db = state.db as import("@/server/db/testing").TestDatabase;
    const { withTestDatabaseRole } = await import("@/server/db/testing");
    return withTestDatabaseRole(
      db,
      role as import("@/server/db/testing").TestDatabaseRole,
      identity,
      async () => {
        const result = await db.execute<{ role: string }>(sql`SELECT current_user AS role`);
        state.observedRoles.push(result.rows[0]!.role);
        return fn();
      },
    );
  },
}));

/* `handler()` imports the admin-auth module even though this public route
 * never authenticates. Avoid loading Neon Auth's Next integration in Vitest. */
vi.mock("@/server/core/auth/actor", () => ({
  authenticateAdmin: vi.fn(),
  registerActor: vi.fn(),
}));

const { GET } = await import("@/app/api/v1/published-items/route");

const CONFIDENCE_DIMENSIONS = {
  confidenceEvidenceCoverage: "limited",
  confidenceSourceIndependence: "limited",
  confidenceSourceAuthority: "limited",
  confidenceMediaProvenance: "limited",
  confidenceTemporalConsistency: "limited",
  confidenceGeographicConsistency: "limited",
  confidenceContradictionLevel: "limited",
  confidenceTranslationCertainty: "limited",
  confidenceHumanReviewState: "limited",
  confidenceRemainingGaps: "limited",
  confidenceSummary: "limited",
} as const;

async function seedPublishedItem(db: TestDatabase) {
  const [author] = await db
    .insert(appUser)
    .values({ externalId: "auth|public-route-author", displayName: "Public route author" })
    .returning();
  const [reviewer] = await db
    .insert(appUser)
    .values({ externalId: "auth|public-route-reviewer", displayName: "Public route reviewer" })
    .returning();
  const [item] = await db
    .insert(informationItem)
    .values({
      publicId: "public-route-claim",
      type: "claim",
      title: "A published claim",
      canonicalText: "The claim is publicly available.",
      language: "en",
      createdBy: author!.id,
    })
    .returning();

  await db.execute(sql`UPDATE information_item SET status = 'under_review' WHERE id = ${item!.id}`);
  await db.execute(sql`UPDATE information_item SET status = 'reviewed' WHERE id = ${item!.id}`);
  const [assessment] = await db
    .insert(itemAssessment)
    .values({
      itemId: item!.id,
      value: "verified",
      summary: "Supported by the record.",
      knownGaps: "None.",
      eligibility: {},
      createdBy: author!.id,
      ...CONFIDENCE_DIMENSIONS,
    })
    .returning();
  await db.execute(sql`UPDATE item_assessment SET approved_by = ${reviewer!.id} WHERE id = ${assessment!.id}`);
  await db.execute(
    sql`UPDATE information_item SET status = 'approved', approved_by = ${reviewer!.id} WHERE id = ${item!.id}`,
  );
  await db.execute(
    sql`UPDATE information_item SET status = 'published', published_at = now() WHERE id = ${item!.id}`,
  );
}

describe("GET /api/v1/published-items", () => {
  it("returns the published projection while the request runs as app_public", async () => {
    const db = await freshDatabase();
    state.db = db;
    state.observedRoles.length = 0;
    await seedPublishedItem(db);

    const response = await GET(
      new Request("http://localhost/api/v1/published-items", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );

    expect(response.status).toBe(200);
    expect(state.observedRoles).toEqual(["app_public"]);
    await expect(response.json()).resolves.toMatchObject({
      items: [expect.objectContaining({ public_id: "public-route-claim" })],
    });
  });
});
