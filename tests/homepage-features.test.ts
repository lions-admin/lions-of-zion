import { describe, expect, it } from "vitest";
import { briefingQualityCheck, briefingRun, publication } from "@/server/db/schema";
import { freshDatabase } from "@/server/db/testing";
import { REQUIRED_QUALITY_CHECKS } from "@/server/modules/briefing/quality";
import { publicationService } from "@/server/modules/publications/service";

const actor = { label: "service:briefing", userId: null };

async function fixture() {
  const db = await freshDatabase();
  const [run] = await db.insert(briefingRun).values({
    localDate: "2026-08-30", stage: "publish", status: "completed", startedAt: new Date(), finishedAt: new Date(),
  }).returning();
  const keys = ["article-1", "article-2", "article-3"];
  await db.insert(briefingQualityCheck).values(keys.flatMap((candidateKey) => REQUIRED_QUALITY_CHECKS.map((checkName) => ({
    briefingRunId: run!.id, candidateKey, checkName, status: "pass", detail: "homepage fixture",
  }))));
  const service = publicationService(db);
  /* article-3 is a historical war_update row seeded raw: the write contract
     no longer accepts the retired section, but a war_update row must stay
     eligible for a homepage slot, so the fixture bypasses the service. */
  const rows = await service.autoPublishMany([0, 1].map((index) => ({
    kind: "news_update" as const,
    section: "israel_update" as const,
    title: `Eligible headline ${index + 1}`,
    body: `Source-linked body for eligible headline ${index + 1}.`,
    language: "en",
  })), { briefingRunId: run!.id, machineAuthor: "machine:test", candidateKeys: ["article-1", "article-2"] }, actor);
  const [warRow] = await db.insert(publication).values({
    kind: "news_update", section: "war_update", publicId: "eligible-war-3",
    title: "Eligible headline 3", body: "Source-linked body for eligible headline 3.", language: "en",
    status: "published", publishedAt: new Date(), autoPublishedAt: new Date(),
    briefingRunId: run!.id, briefingCandidateKey: "article-3", machineAuthor: "machine:test",
  }).returning();
  return { service, rows: [...rows, warRow!] };
}

describe("homepage feature slots", () => {
  it("falls back to the three newest eligible briefing publications", async () => {
    const { service } = await fixture();
    expect(await service.featured()).toHaveLength(3);
  });

  it("uses explicitly selected slots in their slot order and rejects a non-live item", async () => {
    const { service, rows } = await fixture();
    await service.setHomepageFeature(2, rows[0]!.id, actor);
    await service.setHomepageFeature(1, rows[2]!.id, actor);
    expect((await service.featured()).map((row) => row.publicId)).toEqual([rows[2]!.publicId, rows[0]!.publicId]);
    await expect(service.setHomepageFeature(4, rows[1]!.id, actor)).rejects.toThrow(/slot must be 1, 2, or 3/i);
  });
});
