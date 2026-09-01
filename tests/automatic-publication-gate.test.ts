import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { as, freshDatabase, violation } from "@/server/db/testing";
import {
  appUser,
  briefingQualityCheck,
  briefingRun,
  evidence,
  informationItem,
  publication,
  source,
  sourceFamily,
} from "@/server/db/schema";
import { publicationService } from "@/server/modules/publications/service";
import { REQUIRED_QUALITY_CHECKS } from "@/server/modules/briefing/quality";

const actor = { label: "service:briefing", userId: null };
const input = {
  kind: "brief" as const,
  section: "daily_brief" as const,
  title: "Security cabinet publishes a new regional assessment",
  summary: "A source-grounded summary.",
  body: "A complete source-grounded article body with all required traceability.",
  language: "en",
};

async function qualityRun(failedCheck?: string) {
  const db = await freshDatabase();
  const [run] = await db.insert(briefingRun).values({
    localDate: "2026-08-30",
    stage: "editorial",
    status: "running",
    startedAt: new Date(),
  }).returning();
  await db.insert(briefingQualityCheck).values(REQUIRED_QUALITY_CHECKS.map((checkName) => ({
    briefingRunId: run!.id,
    candidateKey: "daily-brief",
    checkName,
    status: checkName === failedCheck ? "fail" : "pass",
    detail: checkName === failedCheck ? "controlled failure" : "controlled pass",
  })));
  return { db, run: run! };
}

describe("automatic publication quality gate", () => {
  it("publishes only when every stored check passes", async () => {
    const { db, run } = await qualityRun();
    const row = await publicationService(db).autoPublish(input, {
      briefingRunId: run.id,
      machineAuthor: "machine:test",
      candidateKeys: ["daily-brief"],
    }, actor);
    expect(row).toMatchObject({
      status: "published",
      briefingRunId: run.id,
      machineAuthor: "machine:test",
    });
    expect(row.autoPublishedAt).not.toBeNull();
    expect(row.qualityApprovedAt).not.toBeNull();
  });

  it("keeps each public passage linked to its generated claim and source", async () => {
    const { db, run } = await qualityRun();
    const [family] = await db.insert(sourceFamily).values({ slug: "traceability-family", label: "Traceability family" }).returning();
    const [publisher] = await db.insert(source).values({
      sourceFamilyId: family!.id,
      kind: "manual",
      slug: "traceability-source",
      name: "Traceability publisher",
      language: "en",
    }).returning();
    const [sourceEvidence] = await db.insert(evidence).values({
      sourceId: publisher!.id,
      kind: "official_record",
      dataClass: "public",
      title: "Official traceability source",
      excerpt: "An official public source supports the traceability regression test.",
      canonicalUrl: "https://example.org/official-traceability-source",
      url: "https://example.org/official-traceability-source",
      publisherDomain: "example.org",
      language: "en",
      usableTextLength: 80,
      retrievalStatus: "fetched",
      accessState: "open",
    }).returning();
    const [claim] = await db.insert(informationItem).values({
      publicId: "traceability-claim",
      type: "claim",
      title: "Traceability claim",
      canonicalText: "The official source supports this traceability claim.",
      language: "en",
    }).returning();

    const [published] = await publicationService(db).autoPublishMany([{
      ...input,
      itemIds: [claim!.id],
      evidenceIds: [sourceEvidence!.id],
      passages: [{
        text: "The official public source supports this traceability claim in the published article.",
        itemId: claim!.id,
        evidenceIds: [sourceEvidence!.id],
      }],
    }], {
      briefingRunId: run.id,
      machineAuthor: "machine:test",
      candidateKeys: ["daily-brief"],
    }, actor);

    const detail = await publicationService(db).getBriefingPublicDetail(published!.publicId);
    expect(detail.passages).toHaveLength(1);
    expect(detail.passages[0]?.claim).toMatchObject({ publicId: "traceability-claim", title: "Traceability claim" });
    expect(detail.passages[0]?.sources).toMatchObject([{ title: "Official traceability source", publisher: "Traceability publisher" }]);
  });

  it("refuses a candidate with one failed check", async () => {
    const { db, run } = await qualityRun("exact_fact_fidelity");
    await expect(publicationService(db).autoPublish(input, {
      briefingRunId: run.id,
      machineAuthor: "machine:test",
      candidateKeys: ["daily-brief"],
    }, actor)).rejects.toThrow(/quality checks are incomplete or failed/i);
  });

  it("refuses a legacy quality record that predates a newly required safety check", async () => {
    const { db, run } = await qualityRun();
    await db.delete(briefingQualityCheck).where(eq(
      // Simulate a completed older pipeline run: the old stored checks cannot
      // satisfy the current publication contract after a new safety check is
      // introduced.
      briefingQualityCheck.checkName, "adversarial_only_routing",
    ));
    await expect(publicationService(db).autoPublish(input, {
      briefingRunId: run.id,
      machineAuthor: "machine:test",
      candidateKeys: ["daily-brief"],
    }, actor)).rejects.toThrow(/quality checks are incomplete or failed/i);
  });

  it("returns the original automatic publication when a completed worker is retried", async () => {
    const { db, run } = await qualityRun();
    const service = publicationService(db);
    const provenance = {
      briefingRunId: run.id,
      machineAuthor: "machine:test",
      candidateKeys: ["daily-brief"],
    };
    const first = await service.autoPublish(input, provenance, actor);
    const retry = await service.autoPublish(input, provenance, actor);

    expect(retry.id).toBe(first.id);
    expect((await db.select().from(publication)).filter((row) => row.briefingRunId === run.id)).toHaveLength(1);
  });

  it("never reports a pre-existing generated draft as an automatic publication", async () => {
    const { db, run } = await qualityRun();
    const service = publicationService(db);
    const provenance = {
      briefingRunId: run.id,
      machineAuthor: "machine:test",
      candidateKeys: ["daily-brief"],
    };
    await service.createMany([input], actor, undefined, provenance);

    await expect(service.autoPublish(input, provenance, actor)).rejects.toThrow(/requires paused-edition recovery/i);
  });

  it("promotes the original approved draft without creating a duplicate edition", async () => {
    const { db, run } = await qualityRun();
    const service = publicationService(db);
    const provenance = {
      briefingRunId: run.id,
      machineAuthor: "machine:test",
      candidateKeys: ["daily-brief"],
    };
    const [draft] = await service.createMany([input], actor, undefined, provenance);
    const [published] = await service.resumeGeneratedDrafts([input], provenance, actor);

    expect(published.id).toBe(draft!.id);
    expect(published.status).toBe("published");
    expect(published.autoPublishedAt).not.toBeNull();
    expect((await db.select().from(publication)).filter((row) => row.briefingRunId === run.id)).toHaveLength(1);
  });

  it("returns the same rows when paused-edition recovery is repeated", async () => {
    const { db, run } = await qualityRun();
    const service = publicationService(db);
    const provenance = {
      briefingRunId: run.id,
      machineAuthor: "machine:test",
      candidateKeys: ["daily-brief"],
    };
    await service.createMany([input], actor, undefined, provenance);
    const first = await service.resumeGeneratedDrafts([input], provenance, actor);
    const retry = await service.resumeGeneratedDrafts([input], provenance, actor);

    expect(retry[0]!.id).toBe(first[0]!.id);
    expect((await db.select().from(publication)).filter((row) => row.briefingRunId === run.id)).toHaveLength(1);
  });

  it("promotes an existing generated draft when the automatic publish stage is retried", async () => {
    const { db, run } = await qualityRun();
    const service = publicationService(db);
    const provenance = {
      briefingRunId: run.id,
      machineAuthor: "machine:test",
      candidateKeys: ["daily-brief"],
    };
    const [draft] = await service.createMany([input], actor, undefined, provenance);
    const [published] = await service.autoPublishMany([input], provenance, actor);

    expect(published!.id).toBe(draft!.id);
    expect(published!.status).toBe("published");
    expect(published!.autoPublishedAt).not.toBeNull();
    expect((await db.select().from(publication)).filter((row) => row.briefingRunId === run.id)).toHaveLength(1);
  });

  it("recovers a legacy paused draft that predates candidate keys", async () => {
    const { db, run } = await qualityRun();
    const [draft] = await db.insert(publication).values({
      ...input,
      publicId: "legacy-paused-draft",
      status: "draft",
      briefingRunId: run.id,
      machineAuthor: "machine:test",
    }).returning();
    const [published] = await publicationService(db).resumeGeneratedDrafts([input], {
      briefingRunId: run.id,
      machineAuthor: "machine:test",
      candidateKeys: ["daily-brief"],
    }, actor);

    expect(published.id).toBe(draft!.id);
    expect(published.briefingCandidateKey).toBe("daily-brief");
    expect((await db.select().from(publication)).filter((row) => row.briefingRunId === run.id)).toHaveLength(1);
  });

  it("keeps legacy site publications out of briefing-only public feeds", async () => {
    const { db, run } = await qualityRun();
    const service = publicationService(db);
    await service.autoPublish(input, {
      briefingRunId: run.id,
      machineAuthor: "machine:test",
      candidateKeys: ["daily-brief"],
    }, actor);
    const [reviewer] = await db.insert(appUser).values({
      externalId: "auth|site-editor",
      displayName: "Site editor",
    }).returning();
    await db.insert(publication).values({
      kind: "brief",
      section: "israel_update",
      publicId: "site-reference-page",
      title: "A site reference page",
      body: "This is not an automated briefing publication.",
      language: "en",
      status: "published",
      publishedAt: new Date(),
      approvedBy: reviewer!.id,
    });

    const rows = await service.listBriefingPublic({ limit: 100 });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.publicId).not.toBe("site-reference-page");
    await expect(service.getBriefingPublic("site-reference-page")).rejects.toThrow(/briefing publication/i);

    const editorRows = await service.list({ limit: 100, briefingOnly: true });
    expect(editorRows).toHaveLength(1);
    expect(editorRows[0]?.publicId).not.toBe("site-reference-page");
  });

  it("prevents the service role from inserting a human-style published row", async () => {
    const db = await freshDatabase();
    await as(db, "app_service", "service:cron", async (serviceDb) => {
      const v = await violation(serviceDb.insert(publication).values({
        kind: "brief",
        section: "daily_brief",
        publicId: "service-bypass",
        title: "Service bypass attempt",
        body: "This must never become public.",
        language: "en",
        status: "published",
        publishedAt: new Date(),
      }));
      expect(v.message).toMatch(/service identities may publish only through the automatic quality path/);
    });
  });
});
