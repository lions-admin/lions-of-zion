import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SQLSTATE, freshDatabase, violation } from "@/server/db/testing";
import {
  appUser,
  evidence,
  informationItem,
  itemAssessment,
  itemEvidence,
  reviewQueue,
  source,
  sourceFamily,
} from "@/server/db/schema";
import type { TestDatabase } from "@/server/db/testing";

const baseItem = {
  publicId: "border-claim",
  type: "claim" as const,
  title: "A claim about the border",
  canonicalText: "The war did not stay at the border.",
  language: "en",
};

async function seedItem(db: TestDatabase, overrides: Record<string, unknown> = {}) {
  const [row] = await db.insert(informationItem).values({ ...baseItem, ...overrides }).returning();
  return row!;
}

async function seedEvidence(db: TestDatabase, overrides: Record<string, unknown> = {}) {
  const [family] = await db.insert(sourceFamily).values({ slug: "wire-a", label: "Wire A" }).returning();
  const [src] = await db
    .insert(source)
    .values({ sourceFamilyId: family!.id, kind: "manual", slug: "manual-a", name: "Manual A", language: "en" })
    .returning();
  const [row] = await db
    .insert(evidence)
    .values({ sourceId: src!.id, kind: "article", title: "Something reported", language: "en", ...overrides })
    .returning();
  return row!;
}

async function seedUser(db: TestDatabase, overrides: Record<string, unknown> = {}) {
  const [row] = await db
    .insert(appUser)
    .values({ externalId: `auth|${Math.random()}`, displayName: "Someone", ...overrides })
    .returning();
  return row!;
}

const minimalAssessmentFields = {
  value: "unverified" as const,
  summary: "Nothing confirmed yet.",
  knownGaps: "No corroboration found so far.",
  confidenceEvidenceCoverage: "limited" as const,
  confidenceSourceIndependence: "limited" as const,
  confidenceSourceAuthority: "limited" as const,
  confidenceMediaProvenance: "limited" as const,
  confidenceTemporalConsistency: "limited" as const,
  confidenceGeographicConsistency: "limited" as const,
  confidenceContradictionLevel: "limited" as const,
  confidenceTranslationCertainty: "limited" as const,
  confidenceHumanReviewState: "limited" as const,
  confidenceRemainingGaps: "limited" as const,
  confidenceSummary: "limited" as const,
  eligibility: {},
};

describe("item_evidence", () => {
  it("requires a rationale", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    const ev = await seedEvidence(db);
    const v = await violation(
      db.insert(itemEvidence).values({ itemId: item.id, evidenceId: ev.id, relation: "supports", strength: "adequate", rationale: "   " }),
    );
    expect(v.constraint).toBe("item_evidence_states_why");
  });

  it("allows only one relation per (item, evidence) pair", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    const ev = await seedEvidence(db);
    await db.insert(itemEvidence).values({ itemId: item.id, evidenceId: ev.id, relation: "supports", strength: "adequate", rationale: "Matches the claim." });
    const v = await violation(
      db.insert(itemEvidence).values({ itemId: item.id, evidenceId: ev.id, relation: "contradicts", strength: "adequate", rationale: "Second opinion." }),
    );
    expect(v.code).toBe(SQLSTATE.uniqueViolation);
  });

  it("requires confirmed_by and confirmed_at together", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    const ev = await seedEvidence(db);
    const v = await violation(
      db.insert(itemEvidence).values({
        itemId: item.id,
        evidenceId: ev.id,
        relation: "supports",
        strength: "adequate",
        rationale: "Matches the claim.",
        confirmedAt: new Date(),
      }),
    );
    expect(v.constraint).toBe("item_evidence_confirmation_is_paired");
  });
});

describe("item_assessment", () => {
  it("requires a non-blank summary and known_gaps", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    const v = await violation(
      db.insert(itemAssessment).values({ itemId: item.id, ...minimalAssessmentFields, summary: "  " }),
    );
    expect(v.constraint).toBe("item_assessment_has_a_summary");
  });

  it("requires review_level 2 for manipulated", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    const v = await violation(
      db.insert(itemAssessment).values({ itemId: item.id, ...minimalAssessmentFields, value: "manipulated", reviewLevel: 1 }),
    );
    expect(v.constraint).toBe("manipulated_requires_elevated_review");
  });

  it("requires a stated false impression for misleading", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    const v = await violation(
      db.insert(itemAssessment).values({ itemId: item.id, ...minimalAssessmentFields, value: "misleading" }),
    );
    expect(v.constraint).toBe("misleading_states_the_false_impression");
  });

  it("is immutable except for superseded_by_assessment_id and a one-time approved_by", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    const [a] = await db.insert(itemAssessment).values({ itemId: item.id, ...minimalAssessmentFields }).returning();
    const v = await violation(
      db.update(itemAssessment).set({ summary: "Rewritten after the fact." }).where(eq(itemAssessment.id, a!.id)),
    );
    expect(v.message).toMatch(/item_assessment is immutable/);
  });

  it("lets superseded_by_assessment_id be set once", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    const [a] = await db.insert(itemAssessment).values({ itemId: item.id, ...minimalAssessmentFields }).returning();
    /* Mirrors the service: the old row is superseded by an id generated
       ahead of time, closing the window before the new row — still current —
       would otherwise collide with it under the partial unique index. */
    const bId = crypto.randomUUID();
    await db.execute(sql`UPDATE item_assessment SET superseded_by_assessment_id = ${bId} WHERE id = ${a!.id}`);
    /* A later attempt to point it somewhere else — deliberately not a real
       row: this column is not a foreign key (see the schema comment), so
       only the immutability trigger, not referential integrity, refuses it. */
    const v = await violation(
      db.execute(sql`UPDATE item_assessment SET superseded_by_assessment_id = ${crypto.randomUUID()} WHERE id = ${a!.id}`),
    );
    expect(v.message).toMatch(/may be set once/);
  });

  it("allows at most one current (non-superseded) assessment per item", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    await db.insert(itemAssessment).values({ itemId: item.id, ...minimalAssessmentFields });
    const v = await violation(db.insert(itemAssessment).values({ itemId: item.id, ...minimalAssessmentFields }));
    expect(v.code).toBe(SQLSTATE.uniqueViolation);
  });

  it("syncs the item's derived columns on insert", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    await db.insert(itemAssessment).values({ itemId: item.id, ...minimalAssessmentFields, value: "contested" });
    const [after] = await db.select().from(informationItem).where(eq(informationItem.id, item.id));
    expect(after!.assessment).toBe("contested");
    expect(after!.confidenceSummary).toBe("limited");
    expect(after!.currentAssessmentId).not.toBeNull();
  });
});

describe("review_queue", () => {
  it("requires a claimant when claimed", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    const v = await violation(db.insert(reviewQueue).values({ itemId: item.id, kind: "initial_review", state: "claimed" }));
    expect(v.constraint).toBe("claimed_queue_entry_has_a_claimant");
  });

  it("requires attribution when resolved", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    const v = await violation(db.insert(reviewQueue).values({ itemId: item.id, kind: "initial_review", state: "done" }));
    expect(v.constraint).toBe("resolved_queue_entry_is_attributed");
  });
});

describe("the publish gate", () => {
  /** The item's approver and the assessment's reviewer are independent
   *  identities on purpose — each test isolates one self-review path without
   *  tripping the other. */
  async function approvedItemWithAssessment(
    db: TestDatabase,
    opts: { assessmentReviewedByAuthor?: boolean } = {},
  ) {
    const author = await seedUser(db);
    const itemApprover = await seedUser(db);
    const assessmentReviewer = opts.assessmentReviewedByAuthor ? author : await seedUser(db);
    const item = await seedItem(db, { createdBy: author.id });
    await db.execute(sql`UPDATE information_item SET status = 'under_review' WHERE id = ${item.id}`);
    await db.execute(sql`UPDATE information_item SET status = 'reviewed' WHERE id = ${item.id}`);
    const [assessment] = await db
      .insert(itemAssessment)
      .values({ itemId: item.id, ...minimalAssessmentFields, value: "verified", createdBy: author.id })
      .returning();
    await db.execute(sql`UPDATE item_assessment SET approved_by = ${assessmentReviewer.id} WHERE id = ${assessment!.id}`);
    await db.execute(
      sql`UPDATE information_item SET status = 'approved', approved_by = ${itemApprover.id} WHERE id = ${item.id}`,
    );
    return { item, author, itemApprover, assessmentReviewer, assessment: assessment! };
  }

  it("refuses to publish when the item's approver is automated", async () => {
    const db = await freshDatabase();
    const { item, itemApprover } = await approvedItemWithAssessment(db);
    await db.execute(sql`UPDATE app_user SET is_automated = true WHERE id = ${itemApprover.id}`);
    const v = await violation(
      db.execute(sql`UPDATE information_item SET status = 'published' WHERE id = ${item.id}`),
    );
    expect(v.message).toMatch(/must be a human reviewer/);
  });

  it("refuses to publish when the item's approver is its own author", async () => {
    /* Not caught on the way into `approved` — a raw SQL statement, unlike the
       service, is not required to name a reviewer at all — but the publish
       gate re-checks whatever `approved_by` ended up holding. */
    const db = await freshDatabase();
    const { item, author } = await approvedItemWithAssessment(db);
    await db.execute(sql`UPDATE information_item SET approved_by = ${author.id} WHERE id = ${item.id}`);
    const v = await violation(
      db.execute(sql`UPDATE information_item SET status = 'published' WHERE id = ${item.id}`),
    );
    expect(v.message).toMatch(/cannot be approved by its own author/);
  });

  it("refuses to publish when the current assessment was reviewed by its own author", async () => {
    const db = await freshDatabase();
    const { item } = await approvedItemWithAssessment(db, { assessmentReviewedByAuthor: true });
    const v = await violation(
      db.execute(sql`UPDATE information_item SET status = 'published' WHERE id = ${item.id}`),
    );
    expect(v.message).toMatch(/cannot be reviewed by its own author/);
  });

  it("publishes once every gate is satisfied", async () => {
    const db = await freshDatabase();
    const { item } = await approvedItemWithAssessment(db);
    await db.execute(
      sql`UPDATE information_item SET status = 'published', published_at = now() WHERE id = ${item.id}`,
    );
    const [after] = await db.select().from(informationItem).where(eq(informationItem.id, item.id));
    expect(after!.status).toBe("published");
  });
});

describe("published_item view", () => {
  it("exposes only published or updated items, joined to their assessment", async () => {
    const db = await freshDatabase();
    const author = await seedUser(db);
    const reviewer = await seedUser(db);
    const item = await seedItem(db, { createdBy: author.id });
    await db.execute(sql`UPDATE information_item SET status = 'under_review' WHERE id = ${item.id}`);
    await db.execute(sql`UPDATE information_item SET status = 'reviewed' WHERE id = ${item.id}`);
    const [assessment] = await db
      .insert(itemAssessment)
      .values({ itemId: item.id, ...minimalAssessmentFields, value: "verified", createdBy: author.id })
      .returning();
    await db.execute(sql`UPDATE item_assessment SET approved_by = ${reviewer.id} WHERE id = ${assessment!.id}`);
    await db.execute(sql`UPDATE information_item SET status = 'approved', approved_by = ${reviewer.id} WHERE id = ${item.id}`);

    const before = await db.execute(sql`SELECT * FROM published_item WHERE id = ${item.id}`);
    expect(before.rows).toHaveLength(0);

    await db.execute(
      sql`UPDATE information_item SET status = 'published', published_at = now() WHERE id = ${item.id}`,
    );
    const after = await db.execute<{ id: string; assessment: string }>(
      sql`SELECT * FROM published_item WHERE id = ${item.id}`,
    );
    expect(after.rows).toHaveLength(1);
    expect(after.rows[0]!.assessment).toBe("verified");
  });
});
