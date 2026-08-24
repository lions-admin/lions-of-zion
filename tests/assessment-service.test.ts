import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import { itemService } from "@/server/modules/items/service";
import { itemAssessmentService, itemEvidenceService } from "@/server/modules/assessments/service";
import { appUser, auditLog, evidence, itemAssessment, source, sourceFamily } from "@/server/db/schema";

/**
 * The Phase 4 spine, end to end: evidence attached to an item, confirmed by a
 * human, an assessment written and reviewed, a correction superseding it
 * without erasing it, and a publish that only succeeds once every gate — the
 * item's own and the assessment's — is satisfied.
 */

const itemInput = {
  type: "claim" as const,
  title: "A claim under dispute",
  canonicalText: "The claim as it was actually made.",
  language: "en",
};

const confidence = {
  evidenceCoverage: "medium" as const,
  sourceIndependence: "medium" as const,
  sourceAuthority: "medium" as const,
  mediaProvenance: "not_applicable" as const,
  temporalConsistency: "medium" as const,
  geographicConsistency: "medium" as const,
  contradictionLevel: "limited" as const,
  translationCertainty: "medium" as const,
  humanReviewState: "high" as const,
  remainingGaps: "medium" as const,
};

async function seedUser(db: TestDatabase, displayName: string) {
  const [row] = await db
    .insert(appUser)
    .values({ externalId: `auth|${displayName}`, displayName })
    .returning();
  return row!;
}

async function seedEvidenceFromFamily(db: TestDatabase, familySlug: string) {
  const [family] = await db.insert(sourceFamily).values({ slug: familySlug, label: familySlug }).returning();
  const [src] = await db
    .insert(source)
    .values({ sourceFamilyId: family!.id, kind: "manual", slug: `${familySlug}-source`, name: familySlug, language: "en" })
    .returning();
  const [row] = await db
    .insert(evidence)
    .values({ sourceId: src!.id, kind: "article", title: `Reporting from ${familySlug}`, language: "en" })
    .returning();
  return row!;
}

describe("the Phase 4 spine", () => {
  it("attaches evidence, refuses self-approval, and only publishes once reviewed by a second human", async () => {
    const db = await freshDatabase();
    const items = itemService(db);
    const evidenceLinks = itemEvidenceService(db);
    const assessments = itemAssessmentService(db);

    const author = await seedUser(db, "The Author");
    const reviewer = await seedUser(db, "A Reviewer");
    const authorActor = { label: author.displayName, userId: author.id };
    const reviewerActor = { label: reviewer.displayName, userId: reviewer.id };

    const item = await items.create(itemInput, authorActor);

    const supportA = await seedEvidenceFromFamily(db, "wire-a");
    const supportB = await seedEvidenceFromFamily(db, "wire-b");
    const contradictC = await seedEvidenceFromFamily(db, "wire-c");

    await evidenceLinks.link(item.id, { evidenceId: supportA.id, relation: "supports", strength: "adequate", rationale: "Independently reported." }, authorActor);
    await evidenceLinks.link(item.id, { evidenceId: supportB.id, relation: "supports", strength: "adequate", rationale: "A second independent account." }, authorActor);
    await evidenceLinks.link(item.id, { evidenceId: contradictC.id, relation: "contradicts", strength: "adequate", rationale: "Disputes the timeline." }, authorActor);

    await items.transition(item.id, { to: "under_review" }, authorActor);
    await items.transition(item.id, { to: "reviewed" }, authorActor);

    // Refused: the author is not a second reviewer.
    await expect(items.transition(item.id, { to: "approved" }, authorActor)).rejects.toThrow(
      /cannot also be the reviewer/,
    );

    // Nothing is confirmed yet, so nothing is eligible for a verdict that needs it.
    await expect(
      assessments.create(item.id, { value: "contested", summary: "Draft.", knownGaps: "Nothing confirmed.", confidence }, authorActor),
    ).rejects.toThrow(/not eligible/);

    // Confirm the edges as the human reviewer — only confirmed edges count.
    await evidenceLinks.confirm(item.id, supportA.id, reviewerActor);
    await evidenceLinks.confirm(item.id, supportB.id, reviewerActor);
    await evidenceLinks.confirm(item.id, contradictC.id, reviewerActor);

    const { eligibility } = await evidenceLinks.eligibility(item.id);
    expect(eligibility.verified.eligible).toBe(false);
    expect(eligibility.contested.eligible).toBe(true);

    // A first assessment, later to be corrected.
    const firstAssessment = await assessments.create(
      item.id,
      { value: "contested", summary: "Confirmed evidence on both sides.", knownGaps: "Translation of the primary document is pending.", confidence },
      authorActor,
    );
    expect(firstAssessment.confidenceSummary).toBe("medium");
    expect(firstAssessment.reviewLevel).toBe(1);
    await assessments.approve(firstAssessment.id, reviewerActor);

    // A correction: the translation lands, the assessment is rewritten.
    const secondAssessment = await assessments.create(
      item.id,
      { value: "contested", summary: "Confirmed evidence on both sides; translation now complete.", knownGaps: "None remaining.", confidence: { ...confidence, translationCertainty: "high" } },
      authorActor,
    );

    const [supersededFirst] = await db.select().from(itemAssessment).where(eq(itemAssessment.id, firstAssessment.id));
    expect(supersededFirst!.supersededByAssessmentId).toBe(secondAssessment.id);
    // The superseded row's own content is untouched — immutable except that pointer.
    expect(supersededFirst!.summary).toBe(firstAssessment.summary);

    const midway = await items.get(item.id);
    expect(midway.currentAssessmentId).toBe(secondAssessment.id);
    expect(midway.assessment).toBe("contested");

    await assessments.approve(secondAssessment.id, reviewerActor);

    const approvedItem = await items.transition(item.id, { to: "approved" }, reviewerActor);
    expect(approvedItem.approvedBy).toBe(reviewer.id);

    const published = await items.transition(item.id, { to: "published" }, reviewerActor);
    expect(published.status).toBe("published");
    expect(published.assessment).toBe("contested");
    expect(published.publishedAt).not.toBeNull();

    const actions = (await db.select().from(auditLog)).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "information_item.created",
        "item_evidence.linked",
        "item_evidence.confirmed",
        "item_assessment.created",
        "item_assessment.approved",
      ]),
    );
  });
});
