import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase } from "@/server/db/testing";
import { appUser, publication } from "@/server/db/schema";
import { publicationService } from "@/server/modules/publications/service";

describe("publication deletion policy", () => {
  it("deletes only drafts and keeps live publications recoverable by archive", async () => {
    const db = await freshDatabase();
    const svc = publicationService(db);
    const actor = { label: "admin:test", userId: null };
    const draft = await svc.create({ kind: "news_update", section: "israel_update", title: "Draft story", body: "Draft body", language: "en" }, actor);
    await svc.remove(draft.id, actor);
    expect(await db.select().from(publication).where(eq(publication.id, draft.id))).toHaveLength(0);

    const review = await svc.create({ kind: "news_update", section: "israel_update", title: "Live story", body: "Live body", language: "en" }, actor);
    await svc.transition(review.id, { to: "under_review" }, actor);
    await expect(svc.remove(review.id, actor)).rejects.toThrow(/drafts and archived/);
  });

  it("completes the administrator draft, review, publish, archive, restore and delete lifecycle", async () => {
    const db = await freshDatabase();
    const svc = publicationService(db);
    const [reviewer] = await db.insert(appUser).values({
      externalId: "admin-lifecycle",
      email: "admin@example.test",
      displayName: "Administrator",
      isAutomated: false,
    }).returning();
    const machine = { label: "service:briefing", userId: null };
    const admin = { label: "admin:reviewer", userId: reviewer!.id };
    const draft = await svc.create({
      kind: "news_update",
      section: "israel_update",
      title: "Lifecycle story",
      body: "Source-linked publication used only for local lifecycle validation.",
      language: "en",
    }, machine);

    expect((await svc.transition(draft.id, { to: "under_review" }, admin)).status).toBe("under_review");
    expect((await svc.transition(draft.id, { to: "approved" }, admin)).approvedBy).toBe(reviewer!.id);
    expect((await svc.transition(draft.id, { to: "published" }, admin)).publishedAt).not.toBeNull();
    expect((await svc.transition(draft.id, { to: "archived" }, admin)).status).toBe("archived");
    expect((await svc.transition(draft.id, { to: "draft" }, admin)).status).toBe("draft");
    await svc.remove(draft.id, admin);
    expect(await db.select().from(publication).where(eq(publication.id, draft.id))).toHaveLength(0);
  });
});
