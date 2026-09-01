import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SQLSTATE, freshDatabase, violation } from "@/server/db/testing";
import { evidence, evidenceProvenance, source, sourceFamily, sourceFetch } from "@/server/db/schema";
import type { TestDatabase } from "@/server/db/testing";
import { sourceRepo } from "@/server/modules/sources/repo";
import { deriveSourceLogicalKey } from "@/server/modules/sources/service";
import { sourceFamilyIdentityForItem } from "@/server/modules/sources/ingest";
import { sourceCadenceMinutes } from "@/server/modules/sources";
import { BRIEFING_DISCOVERY_QUERIES, BRIEFING_PRIORITY_DOMAINS, BRIEFING_RSS_CANDIDATES, sourceCategoryForDomain } from "@/server/modules/sources/catalog";
import { CONNECTORS } from "@/server/modules/sources/connectors";
import { briefingRepo } from "@/server/modules/briefing/repo";

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
  it("keeps discovery queries unique after whitespace and case normalization", () => {
    const normalized = BRIEFING_DISCOVERY_QUERIES.map((entry) => entry.query.trim().replace(/\s+/g, " ").toLowerCase());
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it("uses the same normalized logical key for catalog sync and source creation", () => {
    expect(deriveSourceLogicalKey({ kind: "agent_search", config: { query: " Israel   SECURITY  update " } }))
      .toBe("agent_search:query:israel security update");
  });

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

  it("prevents duplicate logical connector identities", async () => {
    const db = await freshDatabase();
    const family = await seedFamily(db);
    await seedSource(db, family.id, { logicalKey: "rss:url:https://example.org/feed.xml" });
    const v = await violation(seedSource(db, family.id, {
      slug: "duplicate-feed",
      logicalKey: "rss:url:https://example.org/feed.xml",
    }));
    expect(v.code).toBe(SQLSTATE.uniqueViolation);
  });

  it("automatically disables a source after five repeated failures", async () => {
    const db = await freshDatabase();
    const family = await seedFamily(db);
    const src = await seedSource(db, family.id);
    for (let attempt = 0; attempt < 5; attempt++) {
      await sourceRepo(db).recordFetchHealth(src.id, "failed", new Date(), "timeout");
    }
    const updated = await sourceRepo(db).byId(src.id);
    expect(updated).toMatchObject({ active: false, consecutiveFailures: 5 });
    expect(updated?.disabledReason).toContain("timeout");
  });

  it("records the last successful fetch and clears a previous failure state", async () => {
    const db = await freshDatabase();
    const family = await seedFamily(db);
    const src = await seedSource(db, family.id);
    await sourceRepo(db).recordFetchHealth(src.id, "failed", new Date(), "timeout");
    const completedAt = new Date("2026-08-30T12:00:00.000Z");

    await sourceRepo(db).recordFetchHealth(src.id, "success", completedAt);

    const updated = await sourceRepo(db).byId(src.id);
    expect(updated).toMatchObject({ active: true, consecutiveFailures: 0 });
    expect(updated?.lastSuccessfulFetchAt?.toISOString()).toBe(completedAt.toISOString());
    expect(updated?.disabledAt).toBeNull();
    expect(updated?.disabledReason).toBeNull();
  });
});

describe("source collection cadence", () => {
  it("keeps RSS collection current without refetching unchanged front pages every few minutes", () => {
    expect(sourceCadenceMinutes({ kind: "rss", config: null })).toBe(60);
    expect(sourceCadenceMinutes({ kind: "rss", config: { cadenceMinutes: 15 } })).toBe(30);
    expect(sourceCadenceMinutes({ kind: "rss", config: { cadenceMinutes: 2_000 } })).toBe(1_440);
  });

  it("keeps API sources on the same bounded cadence as RSS", () => {
    expect(sourceCadenceMinutes({ kind: "api", config: null })).toBe(60);
    expect(sourceCadenceMinutes({ kind: "api", config: { cadenceMinutes: 120 } })).toBe(120);
  });
});

describe("original-publisher classification", () => {
  it("keeps the bounded discovery corpus unique and category-covered", () => {
    expect(BRIEFING_PRIORITY_DOMAINS).toHaveLength(50);
    expect(new Set(BRIEFING_PRIORITY_DOMAINS).size).toBe(50);
    for (const domain of ["gov.il", "idf.il", "timesofisrael.com", "reuters.com", "aljazeera.com", "tehrantimes.com", "news.un.org", "bellingcat.com"]) {
      expect(sourceCategoryForDomain(domain), `${domain} needs an editorial category`).not.toBeNull();
    }
  });

  it("includes the official English government news feed as an inactive candidate", () => {
    const official = BRIEFING_RSS_CANDIDATES.find((candidate) => candidate.slug === "gov-il-official-news");
    expect(official).toMatchObject({
      category: "official_israeli",
      language: "en",
      feedUrl: expect.stringContaining("/api/NewsApi/rss/"),
    });
  });

  it("retains editorial source categories after Google discovery", () => {
    expect(sourceCategoryForDomain("www.gov.il")).toBe("official_israeli");
    expect(sourceCategoryForDomain("news.idf.il")).toBe("official_israeli");
    expect(sourceCategoryForDomain("tehrantimes.com")).toBe("hostile_state_media");
    expect(sourceCategoryForDomain("www.middleeasteye.net")).toBe("regional_critical");
    expect(sourceCategoryForDomain("unknown.example")).toBeNull();
  });
});

describe("briefing discovery provider boundary", () => {
  it("does not schedule legacy GDELT rows", () => {
    expect(CONNECTORS.map((connector) => connector.kind)).toEqual(["rss", "api", "agent_search"]);
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

describe("source verification visibility", () => {
  it("shows the latest verification reason to the administrator summary", async () => {
    const db = await freshDatabase();
    const family = await seedFamily(db);
    const src = await seedSource(db, family.id, {
      config: { verificationState: "failed", verificationError: "Agent Search returned no direct publisher results" },
    });

    const summary = await briefingRepo(db).summary();
    expect(summary.sources.find((entry) => entry.id === src.id)?.verificationError)
      .toBe("Agent Search returned no direct publisher results");
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

describe("syndication families", () => {
  it("counts five Reuters copies as one upstream source family", () => {
    const copies = Array.from({ length: 5 }, (_, index) => ({
      externalId: `copy-${index}`,
      title: `Outlet ${index} republishes regional report`,
      excerpt: "Reporting by Reuters. The same wire report was syndicated by this outlet.",
    }));
    const families = new Set(copies.map((item, index) =>
      sourceFamilyIdentityForItem(item, `publisher-${index}`),
    ));
    expect([...families]).toEqual(["wire-reuters"]);
  });

  it("keeps genuinely independent publishers in separate families", () => {
    const first = sourceFamilyIdentityForItem({ externalId: "a", title: "Independent field report" }, "aaa");
    const second = sourceFamilyIdentityForItem({ externalId: "b", title: "Separate official analysis" }, "bbb");
    expect(first).not.toBe(second);
  });
});
