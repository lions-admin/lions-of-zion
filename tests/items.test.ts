import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SQLSTATE, freshDatabase, violation } from "@/server/db/testing";
import {
  informationItem,
  itemStatusTransition,
  statusTransition,
} from "@/server/db/schema";
import { LEGAL_TRANSITIONS } from "@/server/contracts/item";
import { ITEM_STATUSES } from "@/server/contracts/enums";
import type { TestDatabase } from "@/server/db/testing";

const baseItem = {
  publicId: "oct-7-border-claim",
  type: "claim" as const,
  title: "A claim about the border",
  canonicalText: "The war did not stay at the border.",
  language: "en",
};

async function seedItem(db: TestDatabase, overrides: Record<string, unknown> = {}) {
  const [row] = await db
    .insert(informationItem)
    .values({ ...baseItem, ...overrides })
    .returning();
  return row!;
}

/** Moves an item to a status by walking a legal path, since transitions are enforced. */
async function moveTo(db: TestDatabase, id: string, path: readonly string[]) {
  for (const status of path) {
    await db.execute(
      sql`UPDATE information_item SET status = ${status}::item_status WHERE id = ${id}`,
    );
  }
}

describe("information item", () => {
  it("starts as detected and derives a content hash", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    expect(item.status).toBe("detected");
    expect(item.contentHash).toMatch(/^[a-f0-9]{32}$/);
  });

  it("recomputes the content hash when the text changes", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    await db
      .update(informationItem)
      .set({ canonicalText: "Something else entirely." })
      .where(eq(informationItem.id, item.id));
    const [after] = await db.select().from(informationItem).where(eq(informationItem.id, item.id));
    expect(after!.contentHash).not.toBe(item.contentHash);
  });

  it("refuses a blank canonical text", async () => {
    const db = await freshDatabase();
    const v = await violation(seedItem(db, { canonicalText: "   " }));
    expect(v.code).toBe(SQLSTATE.checkViolation);
    expect(v.constraint).toBe("information_item_has_canonical_text");
  });

  it("refuses a language that is not a tag", async () => {
    const db = await freshDatabase();
    const v = await violation(seedItem(db, { language: "English" }));
    expect(v.constraint).toBe("information_item_language_is_a_tag");
  });
});

describe("status transitions", () => {
  it("permits a legal move and records it", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    await moveTo(db, item.id, ["under_review"]);
    const trail = await db
      .select()
      .from(itemStatusTransition)
      .where(eq(itemStatusTransition.itemId, item.id));
    expect(trail).toHaveLength(1);
    expect(trail[0]!.fromStatus).toBe("detected");
    expect(trail[0]!.toStatus).toBe("under_review");
  });

  it("refuses a move that skips review", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    const v = await violation(
      db.execute(sql`UPDATE information_item SET status = 'published' WHERE id = ${item.id}`),
    );
    expect(v.code).toBe(SQLSTATE.restrictViolation);
    expect(v.message).toMatch(/may not move from detected to published/);
  });

  it("keeps the transition trail append-only", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    await moveTo(db, item.id, ["under_review"]);
    const v = await violation(
      db.execute(sql`UPDATE item_status_transition SET to_status = 'published'`),
    );
    expect(v.message).toMatch(/item_status_transition is append-only/);
  });

  it("attributes the move to app.identity when it is set", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    await db.execute(sql.raw("BEGIN"));
    await db.execute(sql`SELECT set_config('app.identity', 'editor@example.org', true)`);
    await db.execute(
      sql`UPDATE information_item SET status = 'under_review' WHERE id = ${item.id}`,
    );
    const trail = await db.select().from(itemStatusTransition);
    expect(trail[0]!.actorLabel).toBe("editor@example.org");
    await db.execute(sql.raw("ROLLBACK"));
  });

  it("agrees with the TypeScript copy of the rules", async () => {
    const db = await freshDatabase();
    const rows = await db.select().from(statusTransition);
    const fromDb = new Set(rows.map((r) => `${r.fromStatus}->${r.toStatus}`));
    const fromTs = new Set(
      Object.entries(LEGAL_TRANSITIONS).flatMap(([from, tos]) =>
        tos.map((to) => `${from}->${to}`),
      ),
    );
    expect([...fromTs].filter((t) => !fromDb.has(t)), "in TypeScript, absent from the DB").toEqual(
      [],
    );
    expect([...fromDb].filter((t) => !fromTs.has(t)), "in the DB, absent from TypeScript").toEqual(
      [],
    );
  });
});

describe("publication preconditions", () => {
  it("refuses to publish without an approver, a timestamp and a verdict", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    await moveTo(db, item.id, ["under_review", "reviewed", "approved"]);
    const v = await violation(
      db.execute(sql`UPDATE information_item SET status = 'published' WHERE id = ${item.id}`),
    );
    expect(v.code).toBe(SQLSTATE.checkViolation);
    expect(v.constraint).toBe("published_has_timestamp_and_approver");
  });

  it("refuses a rejection with no stated reason", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    await moveTo(db, item.id, ["under_review"]);
    const v = await violation(
      db.execute(sql`UPDATE information_item SET status = 'rejected' WHERE id = ${item.id}`),
    );
    expect(v.constraint).toBe("rejected_states_why");
  });

  it("accepts a rejection that states one", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    await moveTo(db, item.id, ["under_review"]);
    await db.execute(
      sql`UPDATE information_item
          SET status = 'rejected', status_reason = 'Duplicate of an existing item'
          WHERE id = ${item.id}`,
    );
    const [after] = await db.select().from(informationItem).where(eq(informationItem.id, item.id));
    expect(after!.status).toBe("rejected");
  });
});

describe("derived columns", () => {
  it("refuses an application write to assessment", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    const v = await violation(
      db.execute(sql`UPDATE information_item SET assessment = 'verified' WHERE id = ${item.id}`),
    );
    expect(v.code).toBe(SQLSTATE.restrictViolation);
    expect(v.message).toMatch(/derived from item_assessment and may not be written directly/);
  });

  it("refuses an application write to confidence_summary", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    const v = await violation(
      db.execute(sql`UPDATE information_item SET confidence_summary = 'high' WHERE id = ${item.id}`),
    );
    expect(v.message).toMatch(/may not be written directly/);
  });

  it("lets the sanctioned sync path through", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    await db.execute(sql.raw("BEGIN"));
    await db.execute(sql`SELECT set_config('app.syncing_derived', 'on', true)`);
    await db.execute(
      sql`UPDATE information_item SET assessment = 'contested' WHERE id = ${item.id}`,
    );
    const [after] = await db.select().from(informationItem).where(eq(informationItem.id, item.id));
    expect(after!.assessment).toBe("contested");
    await db.execute(sql.raw("ROLLBACK"));
  });

  it("leaves an unassessed item with no verdict", async () => {
    const db = await freshDatabase();
    const item = await seedItem(db);
    expect(item.assessment).toBeNull();
    expect(item.confidenceSummary).toBeNull();
  });
});

describe("the status list itself", () => {
  it("has no status that cannot be reached", async () => {
    const db = await freshDatabase();
    const rows = await db.select().from(statusTransition);
    const reachable = new Set(rows.map((r) => r.toStatus));
    const unreachable = ITEM_STATUSES.filter((s) => s !== "detected" && !reachable.has(s));
    expect(unreachable, "statuses nothing can transition into").toEqual([]);
  });

  it("gives every status a way in and a way out", async () => {
    /* The first draft of the transition table left `edited` unreachable —
       outgoing edges, nothing leading in — which is what a status looks like
       when it is really an event in disguise. It earned inbound edges instead
       of being deleted, because "returned to the author for rewriting" is a
       real position, distinct from "being fact-checked".

       `detected` is the one legitimate exception: it is where items enter. */
    const db = await freshDatabase();
    const rows = await db.select().from(statusTransition);
    const noWayIn = ITEM_STATUSES.filter(
      (s) => s !== "detected" && !rows.some((r) => r.toStatus === s),
    );
    const noWayOut = ITEM_STATUSES.filter((s) => !rows.some((r) => r.fromStatus === s));
    expect(noWayIn, "statuses nothing can transition into").toEqual([]);
    expect(noWayOut, "statuses nothing can leave — a dead end is rarely intended").toEqual([]);
  });
});
