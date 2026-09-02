/**
 * `GET /api/v1/published-items` does not return what its type says it returns.
 *
 * `itemRepo.listPublished` is `SELECT * FROM published_item` cast straight to
 * `PublishedItemView`, and nothing between the view and the JSON response maps
 * column names. So the declared contract is camelCase and the wire is
 * snake_case, and `publishedAt` — declared `z.iso.datetime()` — arrives as a
 * Postgres timestamp literal (`2026-09-02 15:38:09.569+02`), which is not
 * ISO 8601 and will not round-trip through a consumer that trusts the type.
 *
 * The route has no consumers, which is why this has never surfaced. This test
 * exists so it surfaces before it acquires one: it asserts the shape that
 * actually ships, so whoever fixes the mapping gets a failure telling them the
 * contract moved rather than discovering it in a client.
 *
 * Written 2026-09-02 while building `/updates` and `/fact-check`, both of which
 * therefore read `published-publications` — whose projection is parsed through
 * a real zod schema — and neither of which touches this route.
 */
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { freshDatabase } from "@/server/db/testing";
import { appUser, informationItem, itemAssessment } from "@/server/db/schema";
import { itemRepo } from "@/server/modules/items/repo";
import type { TestDatabase } from "@/server/db/testing";

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

/** Walks an item to `published`, which needs an approved assessment first. */
async function publishedItem(db: TestDatabase) {
  const [author] = await db
    .insert(appUser)
    .values({ externalId: "auth|author", displayName: "Author" })
    .returning();
  const [reviewer] = await db
    .insert(appUser)
    .values({ externalId: "auth|reviewer", displayName: "Reviewer" })
    .returning();
  const [item] = await db
    .insert(informationItem)
    .values({
      publicId: "wire-shape-claim",
      type: "claim",
      title: "A claim on the record",
      canonicalText: "The claim, as recorded.",
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
      summary: "Supported by the material on record.",
      knownGaps: "Nothing outstanding.",
      eligibility: {},
      createdBy: author!.id,
      ...CONFIDENCE_DIMENSIONS,
    })
    .returning();
  await db.execute(
    sql`UPDATE item_assessment SET approved_by = ${reviewer!.id} WHERE id = ${assessment!.id}`,
  );
  await db.execute(
    sql`UPDATE information_item SET status = 'approved', approved_by = ${reviewer!.id} WHERE id = ${item!.id}`,
  );
  await db.execute(
    sql`UPDATE information_item SET status = 'published', published_at = now() WHERE id = ${item!.id}`,
  );
  return item!;
}

describe("published-items wire shape", () => {
  it("returns snake_case keys, not the camelCase its type declares", async () => {
    const db = await freshDatabase();
    await publishedItem(db);

    const rows = await itemRepo(db).listPublished(10);
    expect(rows).toHaveLength(1);
    const row = rows[0] as unknown as Record<string, unknown>;

    /* The view's columns, verbatim. `PublishedItemView` declares `publicId`,
       `canonicalText`, `confidenceSummary`, `publishedAt`, `eventId`,
       `primaryTopicId`, `assessmentSummary`, `assessmentKnownGaps` and
       `assessmentFalseImpression` — none of which exist on the object. */
    expect(Object.keys(row).sort()).toEqual(
      [
        "assessment",
        "assessment_false_impression",
        "assessment_known_gaps",
        "assessment_summary",
        "canonical_text",
        "confidence_summary",
        "event_id",
        "id",
        "language",
        "primary_topic_id",
        "public_id",
        "published_at",
        "summary",
        "title",
        "type",
      ].sort(),
    );

    /* And the timestamp is not ISO 8601: a space where the `T` belongs, and no
       `Z`. `new Date()` parses it in most engines; `z.iso.datetime()` — which
       is what the declared type promises — rejects it. */
    expect(String(row.published_at)).not.toMatch(/T/);
    expect(String(row.published_at)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
  });
});
