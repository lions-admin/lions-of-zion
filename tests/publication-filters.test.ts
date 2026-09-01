import { describe, expect, it } from "vitest";
import { briefingQualityCheck, briefingRun, publication } from "@/server/db/schema";
import { freshDatabase } from "@/server/db/testing";
import { REQUIRED_QUALITY_CHECKS } from "@/server/modules/briefing/quality";
import { publicationService } from "@/server/modules/publications/service";

async function seededBriefingPublications() {
  const db = await freshDatabase();
  const [run] = await db.insert(briefingRun).values({
    localDate: "2026-08-30",
    stage: "publish",
    status: "completed",
    startedAt: new Date("2026-08-30T07:00:00.000Z"),
    finishedAt: new Date("2026-08-30T07:01:00.000Z"),
  }).returning();
  await db.insert(briefingQualityCheck).values(["daily-brief", "article-1"].flatMap((candidateKey) =>
    REQUIRED_QUALITY_CHECKS.map((checkName) => ({
      briefingRunId: run!.id, candidateKey, checkName, status: "pass", detail: "filter fixture",
    })),
  ));
  const service = publicationService(db);
  const daily = await service.autoPublish({
    kind: "brief", section: "daily_brief", title: "Daily Brief", body: "Daily source-linked briefing.", language: "en",
    editorialTopic: "Security", primaryActor: "IDF", arena: "Northern Israel",
  }, { briefingRunId: run!.id, machineAuthor: "machine:test", candidateKeys: ["daily-brief"] }, { label: "service:briefing", userId: null });
  await service.autoPublish({
    kind: "news_update", section: "war_update", title: "War Update", body: "A source-linked operational update.", language: "en",
    editorialTopic: "Diplomacy", primaryActor: "Government of Israel", arena: "Jerusalem",
  }, { briefingRunId: run!.id, machineAuthor: "machine:test", candidateKeys: ["article-1"] }, { label: "service:briefing", userId: null });
  await db.insert(publication).values([
    {
      kind: "news_update", section: "israel_update", publicId: "draft-filter-test",
      title: "Private Draft", body: "Never public.", language: "en",
      status: "draft", briefingRunId: run!.id, machineAuthor: "machine:test",
      editorialTopic: "Security", primaryActor: "IDF", arena: "Northern Israel",
    },
  ]);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(daily.publishedAt!);
  return { db, date };
}

describe("published briefing archive filters", () => {
  it("filters only live briefing publications by date, actor, topic, and arena", async () => {
    const { db, date } = await seededBriefingPublications();
    const service = publicationService(db);

    await expect(service.listBriefingPublic({ limit: 100, date }))
      .resolves.toHaveLength(2);
    await expect(service.listBriefingPublic({ limit: 100, actor: "idf" }))
      .resolves.toMatchObject([{ title: "Daily Brief" }]);
    await expect(service.listBriefingPublic({ limit: 100, topicLabel: "diplomacy" }))
      .resolves.toMatchObject([{ title: "War Update" }]);
    await expect(service.listBriefingPublic({ limit: 100, arena: "Northern Israel" }))
      .resolves.toMatchObject([{ title: "Daily Brief" }]);
  });
});
