import { describe, expect, it } from "vitest";
import { freshDatabase } from "@/server/db/testing";
import { appUser, outbox } from "@/server/db/schema";
import { TOPICS } from "@/server/core/outbox";
import { publicationService } from "@/server/modules/publications/service";

describe("publication cache invalidation", () => {
  it("records the cache-invalidation event in the same completed publication transaction", async () => {
    const db = await freshDatabase();
    const service = publicationService(db);
    const publication = await service.create({
      kind: "news_update",
      section: "israel_update",
      title: "A traceable update for cache invalidation",
      body: "A complete body for this controlled publication test.",
      language: "en",
    }, { label: "admin:test", userId: null });

    const messages = (await db.select().from(outbox))
      .filter((message) => message.topic === TOPICS.publicationCacheInvalidate);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      topic: TOPICS.publicationCacheInvalidate,
      payload: { publicId: publication.publicId },
      publishedAt: null,
    });
  });

  it("records invalidation for publication, update, archive, and deletion", async () => {
    const db = await freshDatabase();
    const service = publicationService(db);
    const [reviewer] = await db.insert(appUser).values({
      externalId: "cache-reviewer",
      email: "cache-reviewer@example.test",
      displayName: "Cache reviewer",
      isAutomated: false,
    }).returning();
    const machine = { label: "service:briefing", userId: null };
    const admin = { label: "admin:cache-reviewer", userId: reviewer!.id };
    const publication = await service.create({
      kind: "news_update",
      section: "israel_update",
      title: "Cache lifecycle story",
      body: "This locally controlled record verifies public cache invalidation.",
      language: "en",
    }, machine);

    await service.transition(publication.id, { to: "under_review" }, admin);
    await service.transition(publication.id, { to: "approved" }, admin);
    await service.transition(publication.id, { to: "published" }, admin);
    await service.update(publication.id, {
      summary: "An edited public summary.",
      changeSummary: "Corrected public summary",
    }, admin);
    await service.transition(publication.id, { to: "archived" }, admin);
    await service.remove(publication.id, admin);

    const messages = (await db.select().from(outbox))
      .filter((message) => message.topic === TOPICS.publicationCacheInvalidate)
      .filter((message) => (message.payload as { publicId?: string }).publicId === publication.publicId);
    expect(messages).toHaveLength(7);
  });
});
