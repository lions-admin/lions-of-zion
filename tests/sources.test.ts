import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SQLSTATE, freshDatabase, violation } from "@/server/db/testing";
import { evidence, evidenceProvenance, source, sourceFamily, sourceFetch } from "@/server/db/schema";
import type { TestDatabase } from "@/server/db/testing";

async function seedFamily(db: TestDatabase, overrides: Record<string, unknown> = {}) {
  const [row] = await db
    .insert(sourceFamily)
    .values({ slug: "example-wire", label: "Example Wire", ...overrides })
    .returning();
  return row!;
}

async function seedSource(db: TestDatabase, sourceFamilyId: string, overrides: Record<string, unknown> = {}) {
  const [row] = await db
    .insert(source)
    .values({
      sourceFamilyId,
      kind: "rss",
      slug: "example-feed",
      name: "Example Feed",
      feedUrl: "https://example.org/feed.xml",
      language: "en",
      ...overrides,
    })
    .returning();
  return row!;
}

describe("source", () => {
  it("requires a feed_url for a polled kind", async () => {
    const db = await freshDatabase();
    const family = await seedFamily(db);
    const v = await violation(seedSource(db, family.id, { feedUrl: null }));
    expect(v.code).toBe(SQLSTATE.checkViolation);
    expect(v.constraint).toBe("polled_sources_have_a_feed_url");
  });

  it("does not require a feed_url for a manual source", async () => {
    const db = await freshDatabase();
    const family = await seedFamily(db);
    const row = await seedSource(db, family.id, { kind: "manual", slug: "manual-tips", feedUrl: null });
    expect(row.feedUrl).toBeNull();
  });
});

describe("source_fetch", () => {
  it("requires an error message on a failed fetch", async () => {
    const db = await freshDatabase();
    const family = await seedFamily(db);
    const src = await seedSource(db, family.id);
    const v = await violation(
      db.insert(sourceFetch).values({
        sourceId: src.id,
        status: "failed",
        startedAt: new Date(),
        finishedAt: new Date(),
      }),
    );
    expect(v.constraint).toBe("failed_fetch_states_why");
  });

  it("is append-only", async () => {
    const db = await freshDatabase();
    const family = await seedFamily(db);
    const src = await seedSource(db, family.id);
    const [fetchRow] = await db
      .insert(sourceFetch)
      .values({ sourceId: src.id, status: "success", startedAt: new Date(), finishedAt: new Date() })
      .returning();
    const v = await violation(
      db.update(sourceFetch).set({ itemsNew: 99 }).where(eq(sourceFetch.id, fetchRow!.id)),
    );
    expect(v.message).toMatch(/source_fetch is append-only/);
  });
});

describe("evidence", () => {
  async function seedEvidence(db: TestDatabase, sourceId: string, overrides: Record<string, unknown> = {}) {
    const [row] = await db
      .insert(evidence)
      .values({
        sourceId,
        kind: "article",
        title: "A report about the border",
        language: "en",
        ...overrides,
      })
      .returning();
    return row!;
  }

  it("refuses a url on restricted evidence", async () => {
    const db = await freshDatabase();
    const family = await seedFamily(db);
    const src = await seedSource(db, family.id);
    const v = await violation(
      seedEvidence(db, src.id, { dataClass: "restricted", url: "https://example.org/x" }),
    );
    expect(v.code).toBe(SQLSTATE.checkViolation);
    expect(v.constraint).toBe("restricted_material_is_not_linked");
  });

  it("refuses a blob_url on secret evidence", async () => {
    const db = await freshDatabase();
    const family = await seedFamily(db);
    const src = await seedSource(db, family.id);
    const v = await violation(
      seedEvidence(db, src.id, { dataClass: "secret", blobUrl: "https://blob.vercel-storage.com/x" }),
    );
    expect(v.constraint).toBe("restricted_material_is_not_linked");
  });

  it("allows public evidence to carry a url", async () => {
    const db = await freshDatabase();
    const family = await seedFamily(db);
    const src = await seedSource(db, family.id);
    const row = await seedEvidence(db, src.id, { url: "https://example.org/x" });
    expect(row.url).toBe("https://example.org/x");
  });

  it("deduplicates by (source_id, external_id)", async () => {
    const db = await freshDatabase();
    const family = await seedFamily(db);
    const src = await seedSource(db, family.id);
    await seedEvidence(db, src.id, { externalId: "guid-1" });
    const v = await violation(seedEvidence(db, src.id, { externalId: "guid-1" }));
    expect(v.code).toBe(SQLSTATE.uniqueViolation);
  });

  it("allows two rows with no external id at all", async () => {
    const db = await freshDatabase();
    const family = await seedFamily(db);
    const src = await seedSource(db, family.id);
    await seedEvidence(db, src.id);
    const second = await seedEvidence(db, src.id);
    expect(second.id).not.toBeUndefined();
  });
});

describe("evidence_provenance", () => {
  it("is append-only", async () => {
    const db = await freshDatabase();
    const family = await seedFamily(db);
    const src = await seedSource(db, family.id);
    const [ev] = await db
      .insert(evidence)
      .values({ sourceId: src.id, kind: "article", title: "A claim", language: "en" })
      .returning();
    const [prov] = await db
      .insert(evidenceProvenance)
      .values({ evidenceId: ev!.id, action: "captured", actorLabel: "connector:rss" })
      .returning();
    const v = await violation(
      db.execute(sql`UPDATE evidence_provenance SET action = 'tampered' WHERE id = ${prov!.id}`),
    );
    expect(v.message).toMatch(/evidence_provenance is append-only/);
  });
});
