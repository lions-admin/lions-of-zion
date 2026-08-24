import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import { itemService } from "@/server/modules/items/service";
import { appUser, auditLog, entityVersion, itemStatusTransition, outbox } from "@/server/db/schema";

/**
 * The service, not the schema.
 *
 * What matters here is that one call produces all five effects — row, version,
 * audit line, status trail, queued reindex — because four of them are silent
 * when missing. A version that was never written is only noticed months later,
 * when someone asks what an item used to say.
 */

const actor = { label: "editor@example.org", userId: null };

const input = {
  type: "claim" as const,
  title: "The war did not stay at the border",
  canonicalText: "A claim made on October 7, 2023.",
  language: "en",
};

const svc = (db: TestDatabase) => itemService(db);

/** Entering `approved` needs a real, human, non-author reviewer — `actor`
 *  above is a label-only dev-shim identity, which is deliberately refused. */
async function seedReviewer(db: TestDatabase) {
  const [row] = await db
    .insert(appUser)
    .values({ externalId: "auth|reviewer", displayName: "A Reviewer" })
    .returning();
  return { label: row!.displayName, userId: row!.id };
}

describe("creating an item", () => {
  it("writes the row, a version, an audit line and a reindex, in one go", async () => {
    const db = await freshDatabase();
    const item = await svc(db).create(input, actor);

    expect(item.status).toBe("detected");
    expect(item.publicId).toMatch(/^the-war-did-not-stay-at-the-border-[a-z0-9]{5}$/);

    const versions = await db.select().from(entityVersion);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.versionNumber).toBe(1);
    expect(versions[0]!.previousVersionId).toBeNull();
    expect(versions[0]!.changeSummary).toBe("Item created");

    const audits = await db.select().from(auditLog);
    expect(audits.map((a) => a.action)).toContain("information_item.created");
    expect(audits[0]!.actorLabel).toBe(actor.label);

    const queued = await db.select().from(outbox);
    expect(queued.map((o) => o.topic).sort()).toEqual(["item.detected", "search.reindex"]);
  });

  it("points the item at its own head version", async () => {
    const db = await freshDatabase();
    const item = await svc(db).create(input, actor);
    const [version] = await db.select().from(entityVersion);
    const fresh = await svc(db).get(item.id);
    expect(fresh.currentVersionId).toBe(version!.id);
  });

  it("gives two items with the same title distinct public ids", async () => {
    const db = await freshDatabase();
    const a = await svc(db).create(input, actor);
    const b = await svc(db).create(input, actor);
    expect(a.publicId).not.toBe(b.publicId);
  });
});

describe("updating an item", () => {
  it("chains the new version onto the previous one", async () => {
    const db = await freshDatabase();
    const item = await svc(db).create(input, actor);
    await svc(db).update(
      item.id,
      { title: "A corrected title", changeSummary: "Fixed the wording" },
      actor,
    );

    const versions = await db
      .select()
      .from(entityVersion)
      .where(eq(entityVersion.entityId, item.id));
    expect(versions).toHaveLength(2);
    const [v1, v2] = versions.sort((a, b) => a.versionNumber - b.versionNumber);
    expect(v2!.previousVersionId).toBe(v1!.id);
    expect(v2!.changeSummary).toBe("Fixed the wording");
  });

  it("keeps the earlier version readable", async () => {
    const db = await freshDatabase();
    const item = await svc(db).create(input, actor);
    await svc(db).update(item.id, { title: "Changed", changeSummary: "retitled" }, actor);
    const versions = await db.select().from(entityVersion);
    const first = versions.find((v) => v.versionNumber === 1)!;
    expect((first.snapshot as { title: string }).title).toBe(input.title);
  });
});

describe("transitions", () => {
  it("moves an item and records who moved it", async () => {
    const db = await freshDatabase();
    const item = await svc(db).create(input, actor);
    const moved = await svc(db).transition(item.id, { to: "under_review" }, actor);

    expect(moved.status).toBe("under_review");
    const trail = await db
      .select()
      .from(itemStatusTransition)
      .where(eq(itemStatusTransition.itemId, item.id));
    expect(trail).toHaveLength(1);
    expect(trail[0]!.actorLabel).toBe(actor.label);
  });

  it("explains an illegal move instead of surfacing a constraint error", async () => {
    const db = await freshDatabase();
    const item = await svc(db).create(input, actor);
    await expect(svc(db).transition(item.id, { to: "published" }, actor)).rejects.toThrow(
      /cannot move to "published"\. It may move to: under_review, rejected, archived/,
    );
  });

  it("refuses a rejection with no reason, before the database has to", async () => {
    const db = await freshDatabase();
    const item = await svc(db).create(input, actor);
    await svc(db).transition(item.id, { to: "under_review" }, actor);
    await expect(svc(db).transition(item.id, { to: "rejected" }, actor)).rejects.toThrow(
      /requires a reason/,
    );
  });

  it("is a no-op when the item is already there", async () => {
    const db = await freshDatabase();
    const item = await svc(db).create(input, actor);
    await svc(db).transition(item.id, { to: "under_review" }, actor);
    await svc(db).transition(item.id, { to: "under_review" }, actor);
    const trail = await db.select().from(itemStatusTransition);
    expect(trail, "a repeated transition should not litter the trail").toHaveLength(1);
  });

  it("walks the full editorial path", async () => {
    const db = await freshDatabase();
    const item = await svc(db).create(input, actor);
    const reviewer = await seedReviewer(db);
    for (const to of ["under_review", "reviewed", "edited", "reviewed"] as const) {
      await svc(db).transition(item.id, { to }, actor);
    }
    await svc(db).transition(item.id, { to: "approved" }, reviewer);
    const final = await svc(db).get(item.id);
    expect(final.status).toBe("approved");
    expect(final.approvedBy).toBe(reviewer.userId);
    const trail = await db.select().from(itemStatusTransition);
    expect(trail).toHaveLength(5);
  });

  it("refuses to enter approved without a known reviewer identity", async () => {
    const db = await freshDatabase();
    const item = await svc(db).create(input, actor);
    for (const to of ["under_review", "reviewed"] as const) {
      await svc(db).transition(item.id, { to }, actor);
    }
    await expect(svc(db).transition(item.id, { to: "approved" }, actor)).rejects.toThrow(
      /known reviewer identity/,
    );
  });

  it("refuses self-approval", async () => {
    const db = await freshDatabase();
    const author = { label: "author@example.org", userId: crypto.randomUUID() };
    await db.insert(appUser).values({ id: author.userId, externalId: "auth|author", displayName: "The Author" });
    const item = await svc(db).create(input, author);
    for (const to of ["under_review", "reviewed"] as const) {
      await svc(db).transition(item.id, { to }, author);
    }
    await expect(svc(db).transition(item.id, { to: "approved" }, author)).rejects.toThrow(
      /cannot also be the reviewer/,
    );
  });

  it("still cannot publish without an assessment", async () => {
    /* The service permits approved → published; the CHECK refuses it because
       no assessment exists yet. Phase 4 supplies the assessment machinery. */
    const db = await freshDatabase();
    const item = await svc(db).create(input, actor);
    const reviewer = await seedReviewer(db);
    for (const to of ["under_review", "reviewed"] as const) {
      await svc(db).transition(item.id, { to }, actor);
    }
    await svc(db).transition(item.id, { to: "approved" }, reviewer);
    await expect(svc(db).transition(item.id, { to: "published" }, reviewer)).rejects.toThrow();
  });
});

describe("reading", () => {
  it("filters and paginates", async () => {
    const db = await freshDatabase();
    for (let i = 0; i < 3; i++) {
      await svc(db).create({ ...input, title: `Claim ${i}` }, actor);
    }
    const first = await svc(db).list({ limit: 2 });
    expect(first).toHaveLength(2);
    const second = await svc(db).list({
      limit: 2,
      cursor: first.at(-1)!.createdAt.toISOString(),
    });
    expect(second.length).toBeGreaterThanOrEqual(1);
    expect(second[0]!.id).not.toBe(first[0]!.id);
  });

  it("reports a missing item as not found", async () => {
    const db = await freshDatabase();
    await expect(svc(db).get(crypto.randomUUID())).rejects.toThrow(/was not found/);
  });
});
