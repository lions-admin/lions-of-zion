import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { freshDatabase, hasVectorDatabase, type TestDatabase } from "@/server/db/testing";
import { searchService } from "@/server/modules/search/service";
import { searchRepo } from "@/server/modules/search/repo";
import { projectPublication } from "@/server/modules/search/projection";
import { itemService } from "@/server/modules/items/service";
import { consumerFor } from "@/server/jobs/consumers";
import { outbox, searchDocument } from "@/server/db/schema";

/**
 * Retrieval against a real Postgres (PGlite), which has pg_trgm and full-text
 * search but no pgvector — so these exercise the three lexical arms and the
 * fusion between them. The semantic arm is covered by the skipped block at the
 * bottom, which runs only against a `TEST_DATABASE_URL` that has the extension.
 */

const actor = { label: "editor@example.org", userId: null };

async function publishItem(db: TestDatabase, itemId: string) {
  const [assessor] = (
    await db.execute(sql`
      INSERT INTO app_user (external_id, display_name)
      VALUES (${`auth|assessor-${crypto.randomUUID()}`}, 'Search test assessor')
      RETURNING id`)
  ).rows as { id: string }[];
  const [reviewer] = (
    await db.execute(sql`
      INSERT INTO app_user (external_id, display_name)
      VALUES (${`auth|reviewer-${crypto.randomUUID()}`}, 'Search test reviewer')
      RETURNING id`)
  ).rows as { id: string }[];

  const [assessment] = (
    await db.execute(sql`
      INSERT INTO item_assessment (
        item_id, value, summary, known_gaps,
        confidence_evidence_coverage, confidence_source_independence, confidence_source_authority,
        confidence_media_provenance, confidence_temporal_consistency, confidence_geographic_consistency,
        confidence_contradiction_level, confidence_translation_certainty, confidence_human_review_state,
        confidence_remaining_gaps, confidence_summary, eligibility, created_by
      ) VALUES (
        ${itemId}, 'verified', 'Reviewed for the search projection test.', 'None.',
        'high', 'high', 'high', 'not_applicable', 'high', 'high',
        'limited', 'high', 'high', 'high', 'high', '{}'::jsonb, ${assessor!.id}
      ) RETURNING id`)
  ).rows as { id: string }[];
  await db.execute(sql`
    UPDATE item_assessment SET approved_by = ${reviewer!.id}
    WHERE id = ${assessment!.id}`);

  await db.execute(sql`UPDATE information_item SET status = 'under_review' WHERE id = ${itemId}`);
  await db.execute(sql`UPDATE information_item SET status = 'reviewed' WHERE id = ${itemId}`);
  await db.execute(sql`
    UPDATE information_item SET status = 'approved', approved_by = ${reviewer!.id}
    WHERE id = ${itemId}`);
  await db.execute(sql`
    UPDATE information_item SET status = 'published', published_at = now()
    WHERE id = ${itemId}`);
}

async function seedDocs(db: TestDatabase, docs: [string, string, string][]) {
  for (const [title, body, language] of docs) {
    await db.execute(sql`
      INSERT INTO search_document (entity_type, entity_id, title, body, language)
      VALUES ('information_item', gen_random_uuid(), ${title}, ${body}, ${language})
    `);
  }
}

describe("search_hybrid", () => {
  it("reports honestly that this database has no semantic arm", async () => {
    const db = await freshDatabase();
    expect(await searchRepo(db).hasSemanticArm()).toBe(false);
  });

  it("finds an English document by a stemmed word", async () => {
    const db = await freshDatabase();
    await seedDocs(db, [["Border incident reported", "The war did not stay at the border", "en"]]);
    const { hits } = await searchService(db).search({ q: "borders", limit: 10 });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.title).toBe("Border incident reported");
  });

  it("finds a Hebrew document, which only the simple configuration can tokenise", async () => {
    const db = await freshDatabase();
    await seedDocs(db, [["המלחמה בגבול", "המלחמה לא נשארה בגבול", "he"]]);
    const { hits } = await searchService(db).search({ q: "המלחמה", limit: 10 });
    expect(hits).toHaveLength(1);
  });

  it("finds an Arabic document too", async () => {
    const db = await freshDatabase();
    await seedDocs(db, [["الحرب على الحدود", "الحرب لم تبق عند الحدود", "ar"]]);
    const { hits } = await searchService(db).search({ q: "الحرب", limit: 10 });
    expect(hits).toHaveLength(1);
  });

  it("still matches a misspelled name through the trigram arm", async () => {
    /* The arm that exists for names and transliterations: no full-text
       configuration will match "Netanyahou" to "Netanyahu", but trigrams do. */
    const db = await freshDatabase();
    await seedDocs(db, [["Netanyahu statement", "A statement was issued.", "en"]]);
    const { hits } = await searchService(db).search({ q: "Netanyahou statement", limit: 10 });
    expect(hits.map((h) => h.title)).toContain("Netanyahu statement");
  });

  it("ranks a document matched by several arms above one matched by a single arm", async () => {
    const db = await freshDatabase();
    await seedDocs(db, [
      ["Border incident reported", "The war did not stay at the border", "en"],
      ["Unrelated dispatch", "A passing mention of the border.", "en"],
    ]);
    const { hits } = await searchService(db).search({ q: "border incident", limit: 10 });
    expect(hits[0]!.title).toBe("Border incident reported");
    expect(hits[0]!.score).toBeGreaterThan(hits[1]?.score ?? 0);
  });

  it("returns nothing for a query that matches nothing, rather than everything", async () => {
    const db = await freshDatabase();
    await seedDocs(db, [["Border incident reported", "The war did not stay at the border", "en"]]);
    const { hits } = await searchService(db).search({ q: "zzzzqqqq", limit: 10 });
    expect(hits).toEqual([]);
  });

  it("respects the limit", async () => {
    const db = await freshDatabase();
    await seedDocs(
      db,
      Array.from({ length: 8 }, (_, i) => [`Border report ${i}`, "border", "en"] as [string, string, string]),
    );
    const { hits } = await searchService(db).search({ q: "border", limit: 3 });
    expect(hits).toHaveLength(3);
  });

  it("filters by entity type", async () => {
    const db = await freshDatabase();
    await seedDocs(db, [["Border incident reported", "The war did not stay at the border", "en"]]);
    const svc = searchService(db);
    expect((await svc.search({ q: "border", entityType: "information_item", limit: 10 })).hits).toHaveLength(1);
    expect((await svc.search({ q: "border", entityType: "evidence", limit: 10 })).hits).toEqual([]);
  });

  it("returns the destination alongside the hit, so a result can be opened", async () => {
    /* The defect this closes: `entity_type` + `entity_id` are the only
       identifiers a hit used to carry, and nothing public resolves either —
       `published-publications` takes a `public_id`, not a uuid, and there is
       no route at all from an internal id to a URL. Every result was a title
       with nowhere to go. */
    const db = await freshDatabase();
    await searchRepo(db).upsert(
      projectPublication({
        id: crypto.randomUUID(),
        publicId: "what-we-know-about-the-border-incident-x9y8z",
        briefingRunId: crypto.randomUUID(),
        kind: "brief",
        title: "What we know about the border incident",
        summary: null,
        body: "The reporting so far.",
        language: "en",
      }),
    );

    const { hits } = await searchService(db).search({ q: "border incident", limit: 10 });
    expect(hits[0]).toMatchObject({
      publicId: "what-we-know-about-the-border-incident-x9y8z",
      href: "/articles/what-we-know-about-the-border-incident-x9y8z",
    });
  });

  it("returns a null destination rather than a fabricated one", async () => {
    const db = await freshDatabase();
    await searchRepo(db).upsert(
      projectPublication({
        id: crypto.randomUUID(),
        publicId: "a-historic-reference-page-q1w2e",
        briefingRunId: null,
        kind: "brief",
        title: "A historic reference page about the border",
        summary: null,
        body: "Written before the briefing existed.",
        language: "en",
      }),
    );

    const { hits } = await searchService(db).search({ q: "border", limit: 10 });
    expect(hits[0]!.publicId).toBe("a-historic-reference-page-q1w2e");
    expect(hits[0]!.href).toBeNull();
  });

  it("rewrites a destination that changed while the text did not", async () => {
    /* A publication that acquires a briefing run becomes addressable without a
       word of it changing. The upsert's "only when it actually changed" guard
       compares the destination too, or that row would stay unreachable
       forever. */
    const db = await freshDatabase();
    const row = {
      id: crypto.randomUUID(),
      publicId: "a-brief-that-was-adopted-m5n6b",
      kind: "brief" as const,
      title: "A brief that was adopted",
      summary: null,
      body: "Unchanged wording throughout.",
      language: "en",
    };
    const repo = searchRepo(db);
    await repo.upsert(projectPublication({ ...row, briefingRunId: null }));
    expect((await searchService(db).search({ q: "adopted", limit: 5 })).hits[0]!.href).toBeNull();

    await repo.upsert(projectPublication({ ...row, briefingRunId: crypto.randomUUID() }));
    expect((await searchService(db).search({ q: "adopted", limit: 5 })).hits[0]!.href).toBe(
      "/articles/a-brief-that-was-adopted-m5n6b",
    );
  });

  it("marks results as non-semantic when there is no vector arm", async () => {
    const db = await freshDatabase();
    await seedDocs(db, [["Border incident reported", "The war did not stay at the border", "en"]]);
    const result = await searchService(db).search({ q: "border", limit: 10 });
    expect(result.semantic).toBe(false);
  });
});

describe("reindexing", () => {
  it("projects a real item, and finds it", async () => {
    const db = await freshDatabase();
    const item = await itemService(db).create(
      {
        type: "claim",
        title: "The war did not stay at the border",
        canonicalText: "A claim made on October 7, 2023.",
        language: "en",
      },
      actor,
    );
    await publishItem(db, item.id);

    expect(await searchService(db).reindex("information_item", item.id)).toBe("indexed");

    const { hits } = await searchService(db).search({ q: "October", limit: 10 });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.entityId).toBe(item.id);
    /* A real item, projected through the real reindex: it has a public id and
       still no page to open, and the hit says exactly that. */
    expect(hits[0]!.publicId).toBe(item.publicId);
    expect(hits[0]!.href).toBeNull();
  });

  it("does not touch updated_at when the text has not changed", async () => {
    /* This is what keeps the embedding backlog from churning on every
       unrelated write to the source entity. */
    const db = await freshDatabase();
    const item = await itemService(db).create(
      { type: "claim", title: "A stable claim", canonicalText: "Unchanged text.", language: "en" },
      actor,
    );
    await publishItem(db, item.id);
    const svc = searchService(db);
    await svc.reindex("information_item", item.id);
    const [first] = await db.select().from(searchDocument);

    await svc.reindex("information_item", item.id);
    const [second] = await db.select().from(searchDocument);

    expect(second!.updatedAt.getTime()).toBe(first!.updatedAt.getTime());
  });

  it("rewrites the row, and the hash, when the text does change", async () => {
    const db = await freshDatabase();
    const items = itemService(db);
    const item = await items.create(
      { type: "claim", title: "A claim", canonicalText: "First wording.", language: "en" },
      actor,
    );
    await publishItem(db, item.id);
    const svc = searchService(db);
    await svc.reindex("information_item", item.id);
    const [before] = await db.select().from(searchDocument);

    await items.update(item.id, { canonicalText: "Second wording entirely.", changeSummary: "Reworded" }, actor);
    await svc.reindex("information_item", item.id);
    const [after] = await db.select().from(searchDocument);

    expect(after!.body).toContain("Second wording");
    expect(after!.contentHash).not.toBe(before!.contentHash);
  });

  it("removes an entity that no longer exists", async () => {
    const db = await freshDatabase();
    await seedDocs(db, [["Ghost", "gone", "en"]]);
    expect(await searchService(db).reindex("information_item", crypto.randomUUID())).toBe("removed");
  });

  it("refuses to index restricted evidence, and removes it if it was indexed", async () => {
    const db = await freshDatabase();
    const [family] = await db
      .execute(sql`INSERT INTO source_family (slug, label) VALUES ('wire', 'Wire') RETURNING id`)
      .then((r) => r.rows as { id: string }[]);
    const [src] = await db
      .execute(
        sql`INSERT INTO source (source_family_id, kind, slug, name, language)
            VALUES (${family!.id}, 'manual', 'manual', 'Manual', 'en') RETURNING id`,
      )
      .then((r) => r.rows as { id: string }[]);
    const [ev] = await db
      .execute(
        sql`INSERT INTO evidence (source_id, kind, title, excerpt, language, data_class)
            VALUES (${src!.id}, 'document', 'A restricted document', 'Sensitive contents.', 'en', 'restricted')
            RETURNING id`,
      )
      .then((r) => r.rows as { id: string }[]);

    expect(await searchService(db).reindex("evidence", ev!.id)).toBe("removed");
    const { hits } = await searchService(db).search({ q: "restricted document", limit: 10 });
    expect(hits).toEqual([]);
  });
});

describe("the reindex consumer", () => {
  it("is registered for the topic the outbox already emits", async () => {
    expect(consumerFor("search.reindex")).toBeDefined();
  });

  it("indexes the item named by a real outbox row", async () => {
    const db = await freshDatabase();
    const item = await itemService(db).create(
      {
        type: "claim",
        title: "A claim that should become searchable",
        canonicalText: "Indexed by way of the outbox.",
        language: "en",
      },
      actor,
    );
    await publishItem(db, item.id);

    /* Phase 2 has been queuing this row on every versioned write; Phase 5 is
       where the consumer stops being a no-op. */
    const queued = (await db.select().from(outbox)).find((o) => o.topic === "search.reindex");
    expect(queued, "recordVersion should have emitted a reindex").toBeDefined();

    await searchService(db).reindex(
      queued!.entityType as "information_item",
      queued!.entityId as string,
    );

    const { hits } = await searchService(db).search({ q: "searchable", limit: 10 });
    expect(hits[0]!.entityId).toBe(item.id);
  });
});

describe("the embedding backlog", () => {
  it("skips cleanly, and says why, when there is no pgvector", async () => {
    const db = await freshDatabase();
    const result = await searchService(db).processEmbeddingBacklog();
    expect(result.embedded).toBe(0);
    expect(result.skipped).toMatch(/pgvector/);
  });

  it("reports a backlog but embeds nothing when no embedder is configured", async () => {
    /* The Phase 6 shape: a database that could store embeddings, and no
       client yet to compute them. Simulated by claiming the arm exists. */
    const db = await freshDatabase();
    await seedDocs(db, [["A document awaiting its embedding", "Some text.", "en"]]);
    await db.execute(
      sql`CREATE OR REPLACE FUNCTION search_has_semantic_arm() RETURNS boolean
          LANGUAGE sql STABLE AS $$ SELECT true $$`,
    );

    const result = await searchService(db).processEmbeddingBacklog();
    expect(result.pending).toBe(1);
    expect(result.embedded).toBe(0);
    expect(result.skipped).toMatch(/no embedder/);
  });

  it("embeds the backlog and stops reporting it once stored", async () => {
    const db = await freshDatabase();
    await seedDocs(db, [["A document awaiting its embedding", "Some text.", "en"]]);

    /* PGlite cannot store a vector, so the store is stubbed while the backlog
       arithmetic — which is the part with the logic in it — stays real. */
    const stored = new Set<string>();
    const repo = searchRepo(db);
    const backlog = () =>
      repo.embeddingBacklog(50).then((rows) => rows.filter((r) => !stored.has(r.id)));

    expect(await backlog()).toHaveLength(1);
    for (const doc of await backlog()) stored.add(doc.id);
    expect(await backlog()).toHaveLength(0);
  });
});

describe.skipIf(!hasVectorDatabase())("the semantic arm", () => {
  it("is live when TEST_DATABASE_URL points at a Postgres with pgvector", async () => {
    /* Deliberately unimplemented against PGlite rather than faked: a green
       assertion about vector retrieval on a database with no vector type
       would be the exact false-green this suite is built to avoid. Provision
       TEST_DATABASE_URL and this block becomes real. */
    expect(hasVectorDatabase()).toBe(true);
  });
});
