import { describe, expect, it } from "vitest";
import { briefingQualityCheck, briefingRun } from "@/server/db/schema";
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
  const rows = await service.autoPublishMany(keys.map((key, index) => ({
    kind: "news_update" as const,
    section: index === 2 ? "war_update" as const : "israel_update" as const,
    title: `Eligible headline ${index + 1}`,
    body: `Source-linked body for eligible headline ${index + 1}.`,
    language: "en",
  })), { briefingRunId: run!.id, machineAuthor: "machine:test", candidateKeys: keys }, actor);
  return { service, rows };
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
