import { describe, expect, it } from "vitest";
import { as, freshDatabase, violation } from "@/server/db/testing";
import { briefingRun, publication } from "@/server/db/schema";
import { publicationService } from "@/server/modules/publications/service";

const actor = { label: "service:briefing", userId: null };
const input = {
  kind: "brief" as const,
  section: "daily_brief" as const,
  title: "Security cabinet publishes a new regional assessment",
  summary: "A generated daily summary.",
  body: "A complete generated article body.",
  language: "en",
};

async function publicationRun(stage = "publish") {
  const db = await freshDatabase();
  const [run] = await db.insert(briefingRun).values({
    localDate: "2026-08-30", stage, status: "running", startedAt: new Date(),
  }).returning();
  return { db, run: run! };
}

describe("automatic publication machine provenance", () => {
  it("publishes without the retired quality-review stage", async () => {
    const { db, run } = await publicationRun();
    const row = await publicationService(db).autoPublish(input, {
      briefingRunId: run.id, machineAuthor: "machine:test", candidateKeys: ["daily-brief"],
    }, actor);

    expect(row).toMatchObject({
      status: "published", briefingRunId: run.id, briefingCandidateKey: "daily-brief",
      machineAuthor: "machine:test", qualityApprovedAt: null,
    });
    expect(row.autoPublishedAt).not.toBeNull();
  });

  it("returns the original publication when a completed worker is retried", async () => {
    const { db, run } = await publicationRun();
    const service = publicationService(db);
    const provenance = { briefingRunId: run.id, machineAuthor: "machine:test", candidateKeys: ["daily-brief"] };
    const first = await service.autoPublish(input, provenance, actor);
    const retry = await service.autoPublish(input, provenance, actor);

    expect(retry.id).toBe(first.id);
    expect((await db.select().from(publication)).filter((row) => row.briefingRunId === run.id)).toHaveLength(1);
  });

  it("promotes a paused generated draft without creating a duplicate", async () => {
    const { db, run } = await publicationRun();
    const service = publicationService(db);
    const provenance = { briefingRunId: run.id, machineAuthor: "machine:test", candidateKeys: ["daily-brief"] };
    const [draft] = await service.createMany([input], actor, undefined, provenance);
    const [published] = await service.resumeGeneratedDrafts([input], provenance, actor);

    expect(published!.id).toBe(draft!.id);
    expect(published!.status).toBe("published");
    expect((await db.select().from(publication)).filter((row) => row.briefingRunId === run.id)).toHaveLength(1);
  });

  it("promotes an existing draft when automatic publication is retried", async () => {
    const { db, run } = await publicationRun();
    const service = publicationService(db);
    const provenance = { briefingRunId: run.id, machineAuthor: "machine:test", candidateKeys: ["daily-brief"] };
    const [draft] = await service.createMany([input], actor, undefined, provenance);
    const [published] = await service.autoPublishMany([input], provenance, actor);

    expect(published!.id).toBe(draft!.id);
    expect(published!.status).toBe("published");
  });

  it("archives the previous same-day automatic edition after replacement", async () => {
    const { db, run: priorRun } = await publicationRun();
    const service = publicationService(db);
    const [prior] = await service.autoPublishMany([input], {
      briefingRunId: priorRun.id, machineAuthor: "machine:test", candidateKeys: ["daily-brief"],
    }, actor);
    const [replacementRun] = await db.insert(briefingRun).values({
      localDate: "2026-08-30", stage: "publish-replacement", status: "running", startedAt: new Date(),
    }).returning();
    const [replacement] = await service.autoPublishMany([{ ...input, title: "Replacement edition" }], {
      briefingRunId: replacementRun!.id,
      machineAuthor: "machine:test",
      candidateKeys: ["daily-brief"],
      supersedeLocalDate: "2026-08-30",
    }, actor);

    expect(replacement!.status).toBe("published");
    expect((await service.get(prior!.id)).status).toBe("archived");
  });

  it("prevents the service role from inserting a human-style published row", async () => {
    const db = await freshDatabase();
    await as(db, "app_service", "service:cron", async (serviceDb) => {
      const error = await violation(serviceDb.insert(publication).values({
        kind: "brief", section: "daily_brief", publicId: "service-bypass",
        title: "Service bypass attempt", body: "This must never become public.",
        language: "en", status: "published", publishedAt: new Date(),
      }));
      expect(error.message).toMatch(/service identities may publish only through the automatic publication path/);
    });
  });
});
