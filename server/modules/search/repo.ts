import "server-only";

/**
 * Persistence for the search projection. Owns SQL; owns no policy.
 *
 * `embedding` is never named through Drizzle here — the column exists only
 * where pgvector does (see `server/db/schema/search.ts`), so every statement
 * touching it is raw SQL guarded by `hasSemanticArm()`.
 */

import { and, eq, sql, type SQL } from "drizzle-orm";
import { searchDocument } from "@/server/db/schema";
import type { EntityType } from "@/server/contracts/enums";
import type { SearchHit } from "@/server/contracts/search";
import type { Projection } from "./projection";

type AnyDb = Record<string, (...args: never[]) => never>;

type Db = AnyDb & {
  execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }>;
  delete: (t: unknown) => { where: (w: SQL | undefined) => Promise<unknown> };
};

export function searchRepo(db: unknown) {
  const d = db as Db;

  return {
    /**
     * Upserts one projection, and rewrites the row only when its text actually
     * changed.
     *
     * `WHERE search_document.body IS DISTINCT FROM excluded.body OR ...` is
     * what keeps `updated_at` — and therefore the embedding backlog — from
     * churning every time an unrelated field on the source entity moves. A
     * reindex that touches nothing must cost nothing downstream.
     *
     * `public_id` and `href` join that comparison rather than being written
     * unconditionally. A publication that acquires a `briefing_run_id` after
     * it was first indexed changes its destination without changing a word of
     * its text, and leaving them out of the WHERE would leave that row
     * permanently unreachable. Including them costs an `updated_at` bump on
     * such a row, which reorders the embedding backlog but cannot add to it —
     * the backlog is `indexed_content_hash IS DISTINCT FROM content_hash`, and
     * `content_hash` is generated from title and body alone.
     */
    async upsert(p: Projection): Promise<void> {
      await d.execute(sql`
        INSERT INTO search_document (entity_type, entity_id, title, body, language, public_id, href)
        VALUES (${p.entityType}, ${p.entityId}, ${p.title}, ${p.body}, ${p.language},
                ${p.publicId}, ${p.href})
        ON CONFLICT (entity_type, entity_id) DO UPDATE
          SET title = excluded.title,
              body = excluded.body,
              language = excluded.language,
              public_id = excluded.public_id,
              href = excluded.href,
              updated_at = now()
          WHERE search_document.title IS DISTINCT FROM excluded.title
             OR search_document.body IS DISTINCT FROM excluded.body
             OR search_document.language IS DISTINCT FROM excluded.language
             OR search_document.public_id IS DISTINCT FROM excluded.public_id
             OR search_document.href IS DISTINCT FROM excluded.href
      `);
    },

    /** Used when an entity stops being indexable — reclassified as restricted,
     *  or deleted. Silent when there was nothing to remove. */
    async remove(entityType: EntityType, entityId: string): Promise<void> {
      await d
        .delete(searchDocument)
        .where(
          and(eq(searchDocument.entityType, entityType), eq(searchDocument.entityId, entityId)),
        );
    },

    /** Whether this database actually has the vector column and index. */
    async hasSemanticArm(): Promise<boolean> {
      const result = await d.execute(sql`SELECT search_has_semantic_arm() AS ok`);
      return Boolean((result.rows[0] as { ok?: boolean } | undefined)?.ok);
    },

    async search(
      q: string,
      queryEmbedding: number[] | null,
      limit: number,
      entityType?: EntityType,
    ): Promise<SearchHit[]> {
      /* pgvector accepts its literal as text — passing it that way is what
         lets the parameter be typed `text` in both bodies of `search_hybrid`,
         so callers never branch on whether the extension exists. */
      const embeddingLiteral = queryEmbedding ? `[${queryEmbedding.join(",")}]` : null;

      /* Over-fetch when filtering by type: the filter is applied after fusion,
         so asking for exactly `limit` would return fewer than requested. */
      const fetchLimit = entityType ? limit * 4 : limit;

      const result = await d.execute(sql`
        SELECT document_id, entity_type, entity_id, public_id, href, title, score
        FROM search_hybrid(${q}, ${embeddingLiteral}, ${fetchLimit})
      `);

      const rows = result.rows as {
        document_id: string;
        entity_type: EntityType;
        entity_id: string;
        public_id: string | null;
        href: string | null;
        title: string;
        score: number | string;
      }[];

      return rows
        .filter((r) => !entityType || r.entity_type === entityType)
        .slice(0, limit)
        .map((r) => ({
          documentId: r.document_id,
          entityType: r.entity_type,
          entityId: r.entity_id,
          publicId: r.public_id ?? null,
          href: r.href ?? null,
          title: r.title,
          score: Number(r.score),
        }));
    },

    /**
     * Documents whose text has moved since their embedding was computed.
     *
     * There is no "pending" column to set, clear, or leak: the backlog is a
     * comparison between two hashes, so a crash mid-embed leaves the row in
     * the backlog rather than in a state nobody reconciles.
     */
    async embeddingBacklog(limit: number): Promise<{ id: string; title: string; body: string }[]> {
      const result = await d.execute(sql`
        SELECT id, title, body
        FROM search_document
        WHERE indexed_content_hash IS DISTINCT FROM content_hash
        ORDER BY updated_at ASC
        LIMIT ${limit}
      `);
      return result.rows as unknown as { id: string; title: string; body: string }[];
    },

    /** Stores an embedding and stamps the hash it was computed from, together,
     *  so the two can never disagree. */
    async storeEmbedding(id: string, embedding: number[]): Promise<void> {
      await d.execute(sql`
        UPDATE search_document
        SET embedding = ${`[${embedding.join(",")}]`}::vector,
            indexed_content_hash = content_hash
        WHERE id = ${id}
      `);
    },
  };
}

export type SearchRepo = ReturnType<typeof searchRepo>;
