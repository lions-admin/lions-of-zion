/**
 * The search projection: one row per indexable entity, denormalised.
 *
 * Items and evidence are projected here rather than searched in place, because
 * a query that has to UNION two differently-shaped tables and rank across them
 * cannot use an index on either. One table, one shape, one index set.
 *
 * **The `embedding` column is deliberately absent from this file.** PGlite
 * ships no pgvector (confirmed by spike, twice — see `DECISIONS.md`), so the
 * column and its HNSW index are added by a conditional `DO` block in the
 * migration and exist only where the extension does. Declaring it here would
 * make `db.select().from(searchDocument)` select a column that does not exist
 * locally and break every test. Nothing reads it through the ORM anyway: the
 * vector arm lives inside `search_hybrid`, and the backlog query names its
 * columns explicitly.
 *
 * Two `tsvector` configurations, both generated and both indexed:
 *   - `simple` carries Hebrew, Arabic and Farsi — it does not stem, which is
 *     exactly right for languages Postgres has no stemmer for.
 *   - `english` is the second list, stemming English properly.
 * Every query ranks against both and fuses the ranks, so no caller has to
 * declare which language it is searching in.
 */

import { sql } from "drizzle-orm";
import { customType, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { entityType } from "./_enums";
import { createdAt, nonBlank, primaryId, updatedAt } from "./_shared";

/** `tsvector` has no first-class Drizzle column type; it is only ever read
 *  through `@@` inside SQL, so the TS side needs nothing but a name. */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => "tsvector",
});

export const searchDocument = pgTable(
  "search_document",
  {
    id: primaryId(),
    entityType: entityType("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),

    title: text("title").notNull(),
    /** The substantive text, already flattened by the projection. */
    body: text("body").notNull(),
    language: text("language").notNull(),

    tsSimple: tsvector("ts_simple").generatedAlwaysAs(
      sql`to_tsvector('simple', title || ' ' || body)`,
    ),
    tsEnglish: tsvector("ts_english").generatedAlwaysAs(
      sql`to_tsvector('english', title || ' ' || body)`,
    ),

    /** md5, generated. The reindex upsert compares against this to avoid
     *  rewriting a row whose text did not actually change — sha256 cannot be
     *  generated here, see the Phase 1 decision on `convert_to` being STABLE. */
    contentHash: text("content_hash").generatedAlwaysAs(
      sql`md5(title || E'\n' || body)`,
    ),
    /** The `content_hash` the current `embedding` was computed from. The
     *  embedding backlog is literally `WHERE indexed_content_hash IS DISTINCT
     *  FROM content_hash` — there is no "pending" flag to leak or reconcile. */
    indexedContentHash: text("indexed_content_hash"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    /* One projection row per entity. The reindex path is an upsert onto this. */
    uniqueIndex("search_document_identifies_one_entity").on(t.entityType, t.entityId),
    index("search_document_simple").using("gin", t.tsSimple),
    index("search_document_english").using("gin", t.tsEnglish),
    /* Trigram on the title only, not the body: this arm exists to catch names
       and transliterations ("Netanyahu"/"Netanyahou"), and a trigram index
       over full article bodies is enormous and matches everything. */
    index("search_document_title_trigram").using("gin", sql`${t.title} gin_trgm_ops`),
    index("search_document_embedding_backlog")
      .on(t.updatedAt)
      .where(sql`${t.indexedContentHash} IS DISTINCT FROM ${t.contentHash}`),
    nonBlank(t.title, "search_document_is_titled"),
  ],
);

export type SearchDocument = typeof searchDocument.$inferSelect;
export type NewSearchDocument = typeof searchDocument.$inferInsert;
