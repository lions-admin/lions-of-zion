import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase } from "@/server/db/testing";
import { outbox } from "@/server/db/schema";
import { drainOutbox } from "@/server/core/outbox";
import type { TestDatabase } from "@/server/db/testing";
import type { OutboxRow } from "@/server/db/schema";

async function seedOutboxRow(db: TestDatabase, overrides: Record<string, unknown> = {}) {
  const [row] = await db
    .insert(outbox)
    .values({ topic: "search.reindex", payload: { id: "x" }, ...overrides })
    .returning();
  return row!;
}

describe("outbox drain", () => {
  it("marks a row published once dispatch succeeds", async () => {
    const db = await freshDatabase();
    const row = await seedOutboxRow(db);

    const dispatched: OutboxRow[] = [];
    const result = await drainOutbox(db, {
      dispatch: async (r) => {
        dispatched.push(r);
      },
    });

    expect(result).toEqual({ attempted: 1, dispatched: 1, failed: 0 });
    expect(dispatched).toHaveLength(1);
    const [after] = await db.select().from(outbox).where(eq(outbox.id, row.id));
    expect(after!.publishedAt).not.toBeNull();
  });

  it("leaves a row pending and records the error when dispatch fails", async () => {
    const db = await freshDatabase();
    const row = await seedOutboxRow(db);

    const result = await drainOutbox(db, {
      dispatch: async () => {
        throw new Error("queue unreachable");
      },
    });

    expect(result).toEqual({ attempted: 1, dispatched: 0, failed: 1 });
    const [after] = await db.select().from(outbox).where(eq(outbox.id, row.id));
    expect(after!.publishedAt).toBeNull();
    expect(after!.attempts).toBe(1);
    expect(after!.lastError).toBe("queue unreachable");
    expect(after!.availableAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("does not pick up a row whose backoff has not elapsed", async () => {
    const db = await freshDatabase();
    await seedOutboxRow(db, { availableAt: new Date(Date.now() + 60_000) });

    const result = await drainOutbox(db, { dispatch: async () => {} });
    expect(result).toEqual({ attempted: 0, dispatched: 0, failed: 0 });
  });

  it("does not pick up a row already published", async () => {
    const db = await freshDatabase();
    await seedOutboxRow(db, { publishedAt: new Date() });

    const result = await drainOutbox(db, { dispatch: async () => {} });
    expect(result).toEqual({ attempted: 0, dispatched: 0, failed: 0 });
  });

  /* The default limit is a throughput, not a taste: the cron ticks every 15
     minutes, so a batch left behind waits a quarter hour. A briefing edition
     arrives as roughly 190 reindex rows at once, and at the old default of 25
     that took eight ticks — a story published at 05:00 was not searchable
     until nearly 07:00. This fails if anyone lowers it back under an edition. */
  it("clears an edition-sized batch in a single tick with no limit given", async () => {
    const db = await freshDatabase();
    await db.insert(outbox).values(
      Array.from({ length: 200 }, (_, i) => ({ topic: "search.reindex", payload: { id: `item-${i}` } })),
    );

    const result = await drainOutbox(db, { dispatch: async () => {} });
    expect(result).toEqual({ attempted: 200, dispatched: 200, failed: 0 });
  });

  it("still honours an explicit limit", async () => {
    const db = await freshDatabase();
    await db.insert(outbox).values(
      Array.from({ length: 5 }, (_, i) => ({ topic: "search.reindex", payload: { id: `item-${i}` } })),
    );

    const result = await drainOutbox(db, { limit: 2, dispatch: async () => {} });
    expect(result).toEqual({ attempted: 2, dispatched: 2, failed: 0 });
  });
});
