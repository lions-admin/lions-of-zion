import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import { entityVersion, source, sourceFamily, sourceFetch } from "@/server/db/schema";
import { reverifyDisabledSources, sourcesAwaitingReverification } from "@/server/modules/sources/reverify";
import type { ConnectorFetchResult } from "@/server/modules/sources/connector";

/**
 * A source the system disabled for fetch failures had no way back but a
 * person. The Times of Israel feed answered 403 on 2026-09-01, was retired,
 * answered 200 again within days, and stayed off for a week while the alert
 * evaluator counted it as failing every morning. The sweep below is that
 * way back: one real fetch a day, nothing written from it, reactivation
 * through the versioned service when it succeeds.
 */

async function seed(db: TestDatabase, slug: string, overrides: Record<string, unknown>) {
  const [family] = await db.insert(sourceFamily).values({ slug: `outlet-${slug}`, label: slug }).returning();
  const [row] = await db.insert(source).values({
    sourceFamilyId: family!.id,
    kind: "rss",
    slug,
    logicalKey: `rss:url:https://example.org/${slug}.xml`,
    name: slug,
    feedUrl: `https://example.org/${slug}.xml`,
    language: "en",
    ...overrides,
  }).returning();
  return row!;
}

const item = (n: number) => ({ externalId: `urn:item:${n}`, title: `Item ${n}`, url: `https://example.org/${n}` });
const ok = (items: number): ConnectorFetchResult => ({ status: "success", httpStatus: 200, items: Array.from({ length: items }, (_, i) => item(i)) });
const forbidden = (): ConnectorFetchResult => ({ status: "failed", httpStatus: 403, items: [], errorMessage: "Feed returned HTTP 403" });

describe("disabled source re-verification", () => {
  it("selects only sources the system itself disabled or retired for fetch failures", async () => {
    const db = await freshDatabase();
    const auto = await seed(db, "auto-disabled", {
      active: false, consecutiveFailures: 5, disabledAt: new Date(),
      disabledReason: "Repeated failed fetches: Feed returned HTTP 404",
    });
    const retired = await seed(db, "retired", {
      active: false, consecutiveFailures: 9,
      config: { retired: true, retiredReason: "Removed from the live RSS catalog after endpoint verification failed." },
    });
    await seed(db, "switched-off-by-hand", { active: false });
    await seed(db, "live", { active: true });
    await seed(db, "discovery", {
      kind: "agent_search", feedUrl: null, logicalKey: "agent_search:q", active: false,
      disabledReason: "Repeated failed fetches: quota", config: { query: "q" },
    });

    const candidates = await sourcesAwaitingReverification(db);
    expect(candidates.map((row) => row.id).sort()).toEqual([auto.id, retired.id].sort());
  });

  it("reactivates a source whose feed answers again, as a recorded change with clean counters", async () => {
    const db = await freshDatabase();
    const retired = await seed(db, "times-of-israel", {
      active: false, consecutiveFailures: 9,
      config: {
        category: "israeli_media", retired: true, retiredAt: "2026-09-01T17:59:26.109Z",
        retiredReason: "Removed from the live RSS catalog after endpoint verification failed.",
      },
    });
    const now = new Date("2026-09-09T03:20:00.000Z");

    const outcomes = await reverifyDisabledSources(db, { fetch: async () => ok(13), now });

    expect(outcomes).toEqual([{ sourceId: retired.id, slug: "times-of-israel", outcome: "reactivated", items: 13 }]);
    const [row] = await db.select().from(source).where(eq(source.id, retired.id));
    expect(row).toMatchObject({
      active: true, consecutiveFailures: 0, disabledAt: null, disabledReason: null,
      lastSuccessfulFetchAt: now,
    });
    expect(row?.config).toMatchObject({
      category: "israeli_media", retired: false, verificationState: "verified", verificationItems: 13,
      reactivatedAt: now.toISOString(), retiredReason: expect.any(String),
    });
    /* Through the versioned service, so the reactivation is a change with an
       actor and a summary rather than a silent column flip. */
    const versions = await db.select().from(entityVersion).where(eq(entityVersion.entityId, retired.id));
    expect(versions).toHaveLength(1);
    expect(versions[0]?.changeSummary).toMatch(/Reactivated after a successful re-verification fetch \(13 items\)/);
    expect(versions[0]?.changedByLabel).toBe("service:source-reverify");
    /* A probe is not a collection: nothing is recorded as a fetch. */
    expect(await db.select().from(sourceFetch)).toHaveLength(0);
  });

  it("leaves a still-dead source exactly as it was", async () => {
    const db = await freshDatabase();
    const dead = await seed(db, "arab-news", {
      active: false, consecutiveFailures: 5, disabledAt: new Date("2026-09-06T11:00:51.449Z"),
      disabledReason: "Repeated failed fetches: Feed returned HTTP 404",
    });
    const before = (await db.select().from(source).where(eq(source.id, dead.id)))[0];

    const outcomes = await reverifyDisabledSources(db, { fetch: async () => forbidden() });
    expect(outcomes).toEqual([{ sourceId: dead.id, slug: "arab-news", outcome: "still_failing", items: 0, error: "Feed returned HTTP 403" }]);

    const after = (await db.select().from(source).where(eq(source.id, dead.id)))[0];
    expect(after).toEqual(before);
    expect(await db.select().from(entityVersion).where(eq(entityVersion.entityId, dead.id))).toHaveLength(0);
  });

  it("treats a fetch that throws, or returns no items, as still failing", async () => {
    const db = await freshDatabase();
    const empty = await seed(db, "empty", { active: false, disabledReason: "Repeated partial fetches: no usable feed data" });
    const throwing = await seed(db, "throwing", { active: false, disabledReason: "Repeated failed fetches: timeout" });

    const outcomes = await reverifyDisabledSources(db, {
      fetch: async (src) => { if (src.id === throwing.id) throw new Error("connect ETIMEDOUT"); return ok(0); },
    });
    expect(outcomes).toEqual(expect.arrayContaining([
      { sourceId: empty.id, slug: "empty", outcome: "still_failing", items: 0, error: "Feed returned no items." },
      { sourceId: throwing.id, slug: "throwing", outcome: "still_failing", error: "connect ETIMEDOUT" },
    ]));
    for (const id of [empty.id, throwing.id]) {
      expect((await db.select().from(source).where(eq(source.id, id)))[0]?.active).toBe(false);
    }
  });
});
