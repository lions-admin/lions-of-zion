import { describe, expect, it } from "vitest";
import { briefingQualityCheck, briefingRun, publication } from "@/server/db/schema";
import { freshDatabase } from "@/server/db/testing";
import { REQUIRED_QUALITY_CHECKS } from "@/server/modules/briefing/quality";
import { mediaRepo, type EditorialMediaDraft } from "@/server/modules/media/repo";
import { publicationService } from "@/server/modules/publications/service";

const actor = { label: "service:briefing", userId: null };

/** Attach media when a test intentionally needs a homepage-capable or article-only hero. */
async function attachHomepageHero(db: unknown, publicationId: string, surfaces: Array<"homepage" | "article"> = ["homepage", "article"]) {
  const draft: EditorialMediaDraft = {
    src: `/images/homepage-fixture-${publicationId.slice(0, 8)}.webp`, width: 1536, height: 1024,
    alt: "Homepage fixture", caption: null, credit: "Lions of Zion", sourceUrl: null, originUrl: null,
    disclosure: "Editorial illustration — not evidence", role: "editorial-illustration",
    focalPoint: { x: 50, y: 50 }, sensitivity: "safe",
    rights: { status: "cleared", basis: "Original editorial illustration", reference: "test", clearedAt: "2026-09-06", surfaces },
    contentHash: publicationId.replace(/-/g, "").padEnd(64, "a").slice(0, 64), byteSize: 12000, contentType: "image/webp",
    generated: true, provenance: { runId: "fixture" },
  };
  const asset = await mediaRepo(db).insertMedia(draft);
  await mediaRepo(db).attachToPublication(publicationId, asset.id);
}

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
  const rows = await service.autoPublishMany([0, 1].map((index) => ({
    kind: "news_update" as const,
    section: "israel_update" as const,
    title: `Eligible headline ${index + 1}`,
    body: `Source-linked body for eligible headline ${index + 1}.`,
    language: "en",
  })), { briefingRunId: run!.id, machineAuthor: "machine:test", candidateKeys: ["article-1", "article-2"] }, actor);
  const [warRow] = await db.insert(publication).values({
    kind: "news_update", section: "israel_update", publicId: "eligible-3",
    title: "Eligible headline 3", body: "Source-linked body for eligible headline 3.", language: "en",
    status: "published", publishedAt: new Date(), autoPublishedAt: new Date(),
    briefingRunId: run!.id, briefingCandidateKey: "article-3", machineAuthor: "machine:test",
  }).returning();
  return { db, service, rows: [...rows, warRow!] };
}

describe("homepage placements", () => {
  it("falls back to the three newest eligible briefing publications", async () => {
    const { service } = await fixture();
    expect(await service.featured()).toHaveLength(3);
  });

  it("uses a matching-area lead placement and rejects a mismatched area", async () => {
    const { service, rows } = await fixture();
    await service.setHomepagePlacement("news", "lead", rows[2]!.id, actor);
    expect((await service.featured()).map((row) => row.publicId)[0]).toBe(rows[2]!.publicId);
    await expect(service.setHomepagePlacement("people", "lead", rows[1]!.id, actor))
      .rejects.toThrow(/matching homepage area/i);
    await service.setHomepagePlacement("news", "lead", null, actor);
    expect(await service.homepagePlacements()).toEqual([]);
  });

  it("allows text-only placements while keeping non-homepage media off the homepage surface", async () => {
    const { db, service, rows } = await fixture();
    await service.setHomepagePlacement("news", "lead", rows[0]!.id, actor);
    await attachHomepageHero(db, rows[1]!.id, ["article"]);
    await service.setHomepagePlacement("news", "secondary", rows[1]!.id, actor);

    expect(await service.homepagePlacements()).toEqual(expect.arrayContaining([
      { area: "news", position: "lead", publicationId: rows[0]!.id },
      { area: "news", position: "secondary", publicationId: rows[1]!.id },
    ]));
    const featured = await service.featured();
    expect(featured[0]!.publicId).toBe(rows[0]!.publicId);
    expect(featured[0]!.media).toBeNull();
    expect(featured[1]!.publicId).toBe(rows[1]!.publicId);
    expect(featured[1]!.media).not.toBeNull();
  });
});
