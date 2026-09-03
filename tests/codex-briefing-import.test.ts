import { describe, expect, it } from "vitest";
import { freshDatabase } from "@/server/db/testing";
import { codexBriefingImportSchema } from "@/server/contracts/codex-briefing-import";
import { importCodexBriefing } from "@/server/modules/briefing/codex-import";
import { publicationService } from "@/server/modules/publications/service";

const input = codexBriefingImportSchema.parse({
  schemaVersion: 1,
  idempotencyKey: "2026-09-03-codex-import-test",
  editorialDate: "2026-09-03",
  sources: [{
    key: "source-1",
    title: "Official update",
    publisher: "Example Publisher",
    url: "https://example.com/official-update",
    excerpt: "A public source excerpt imported by the scheduled Codex task.",
    publishedAt: "2026-09-03T06:00:00.000Z",
  }],
  publications: [{
    candidateKey: "daily-brief",
    section: "daily_brief",
    title: "Daily briefing import test",
    summary: "An imported summary.",
    body: "A complete imported daily briefing body.",
    sourceKeys: ["source-1"],
    editorialTopic: "Israel",
    arena: "Middle East",
  }],
});

describe("Codex briefing import", () => {
  it("publishes an attributed package and treats the same key as a retry", async () => {
    const db = await freshDatabase();
    const actor = { label: "service:codex", userId: null };
    const first = await importCodexBriefing(db, input, actor, "request-1");
    const retry = await importCodexBriefing(db, input, actor, "request-2");

    expect(first.duplicate).toBe(false);
    expect(retry.duplicate).toBe(true);
    expect(retry.publications[0]!.id).toBe(first.publications[0]!.id);

    const detail = await publicationService(db).getBriefingPublicDetail(first.publications[0]!.publicId);
    expect(detail.sources).toMatchObject([{
      title: "Official update",
      publisher: "Example Publisher",
      url: "https://example.com/official-update",
    }]);
  });

  it("rejects references to source keys outside the package", () => {
    const parsed = codexBriefingImportSchema.safeParse({
      ...input,
      publications: [{ ...input.publications[0], sourceKeys: ["missing-source"] }],
    });
    expect(parsed.success).toBe(false);
  });
});
