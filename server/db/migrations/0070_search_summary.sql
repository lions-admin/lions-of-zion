-- A search result a reader can read, not merely identify.
--
-- `SearchResults.tsx` rendered the destination *path* as each result's
-- description, so a reader searching "October 7" met
-- `/articles/how-to-read-the-october-7-archive-source-taxonom-zjy4f` in the
-- slot where a sentence belongs — a URL set in the site's own body face, as if
-- it were prose. The component was not inventing that: `search_document`
-- carried title, body and nothing between them, and the body is the whole
-- article. There was no sentence to show.
--
-- Every entity that has a standfirst already has one on its own row
-- (`publication.summary`, `information_item.summary`, `narrative.summary`), and
-- the projection already folds that text into `body` for matching. This stores
-- it separately so it can be *displayed*, for the same reason the table is
-- denormalised at all: resolving a result must cost no second query and no
-- UNION over differently-shaped tables.
--
-- Three properties of the column, all deliberate:
--
--   * It is **not** in either `tsvector`. The summary text is already inside
--     `body` for every entity that has one, so indexing it again would
--     double-weight the standfirst against the article.
--   * It is **not** in `content_hash`, which stays `md5(title || E'\n' ||
--     body)`. The embedding backlog is `indexed_content_hash IS DISTINCT FROM
--     content_hash`, so backfilling 1,000 summaries below queues exactly zero
--     embeddings — a change no embedding could see must not cost one.
--   * It is nullable and often null. Evidence has no standfirst (its excerpt is
--     its substance, not a description of it), and a record without one renders
--     nothing rather than a placeholder.

ALTER TABLE search_document ADD COLUMN IF NOT EXISTS summary text;
--> statement-breakpoint

-- Backfilled rather than left to the reindex, exactly as migration 0048 did for
-- the destination: reindexing runs through `recordVersion()`, which would
-- append a version row and a public correction entry per record for a change
-- that corrects nothing. The upsert's IS DISTINCT FROM guard now compares
-- `summary` too, so a record whose standfirst is later rewritten still updates.
UPDATE search_document sd
SET summary = i.summary
FROM information_item i
WHERE sd.entity_type = 'information_item' AND i.id = sd.entity_id;
--> statement-breakpoint

UPDATE search_document sd
SET summary = p.summary
FROM publication p
WHERE sd.entity_type::text = p.kind::text AND p.id = sd.entity_id;
--> statement-breakpoint

UPDATE search_document sd
SET summary = n.summary
FROM narrative n
WHERE sd.entity_type = 'narrative' AND n.id = sd.entity_id;
--> statement-breakpoint

-- `search_hybrid` gains one output column, so it is dropped and rebuilt rather
-- than replaced: `CREATE OR REPLACE FUNCTION` cannot change a return type. Both
-- bodies are rewritten together and stay signature-identical — the property
-- migration 0009 established and that the caller depends on, since it never
-- branches on whether pgvector exists. Neither body is `SECURITY DEFINER`, so
-- the RLS policy on `search_document` still decides what an anonymous reader
-- sees.
--
-- The bodies below are migration 0048's, with `d.summary` added to the final
-- projection and nothing else touched. The fusion arms, their LIMIT 100, the
-- RRF constant of 60 and the ordering are unchanged.
DROP FUNCTION IF EXISTS search_hybrid(text, text, int);
--> statement-breakpoint

DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'search_document' AND column_name = 'embedding'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION search_hybrid(
        q text,
        q_embedding text,
        max_results int DEFAULT 25
      ) RETURNS TABLE (
        document_id uuid,
        entity_type entity_type,
        entity_id uuid,
        public_id text,
        href text,
        title text,
        summary text,
        score double precision
      ) LANGUAGE sql STABLE AS $body$
        WITH
        simple_arm AS (
          SELECT id, row_number() OVER (
                   ORDER BY ts_rank_cd(ts_simple, plainto_tsquery('simple', q)) DESC, id
                 ) AS rank
          FROM search_document
          WHERE ts_simple @@ plainto_tsquery('simple', q)
          LIMIT 100
        ),
        english_arm AS (
          SELECT id, row_number() OVER (
                   ORDER BY ts_rank_cd(ts_english, plainto_tsquery('english', q)) DESC, id
                 ) AS rank
          FROM search_document
          WHERE ts_english @@ plainto_tsquery('english', q)
          LIMIT 100
        ),
        trigram_arm AS (
          SELECT id, row_number() OVER (ORDER BY similarity(title, q) DESC, id) AS rank
          FROM search_document
          WHERE title % q
          LIMIT 100
        ),
        vector_arm AS (
          SELECT id, row_number() OVER (ORDER BY embedding <=> q_embedding::vector, id) AS rank
          FROM search_document
          WHERE q_embedding IS NOT NULL AND embedding IS NOT NULL
          LIMIT 100
        ),
        fused AS (
          SELECT id, SUM(1.0 / (60 + rank)) AS score
          FROM (
            SELECT * FROM simple_arm
            UNION ALL SELECT * FROM english_arm
            UNION ALL SELECT * FROM trigram_arm
            UNION ALL SELECT * FROM vector_arm
          ) arms
          GROUP BY id
        )
        SELECT d.id, d.entity_type, d.entity_id, d.public_id, d.href, d.title, d.summary,
               f.score::double precision
        FROM fused f
        JOIN search_document d ON d.id = f.id
        ORDER BY f.score DESC, d.id
        LIMIT max_results;
      $body$;
    $fn$;

  ELSE
    EXECUTE $fn$
      CREATE FUNCTION search_hybrid(
        q text,
        q_embedding text,
        max_results int DEFAULT 25
      ) RETURNS TABLE (
        document_id uuid,
        entity_type entity_type,
        entity_id uuid,
        public_id text,
        href text,
        title text,
        summary text,
        score double precision
      ) LANGUAGE sql STABLE AS $body$
        WITH
        simple_arm AS (
          SELECT id, row_number() OVER (
                   ORDER BY ts_rank_cd(ts_simple, plainto_tsquery('simple', q)) DESC, id
                 ) AS rank
          FROM search_document
          WHERE ts_simple @@ plainto_tsquery('simple', q)
          LIMIT 100
        ),
        english_arm AS (
          SELECT id, row_number() OVER (
                   ORDER BY ts_rank_cd(ts_english, plainto_tsquery('english', q)) DESC, id
                 ) AS rank
          FROM search_document
          WHERE ts_english @@ plainto_tsquery('english', q)
          LIMIT 100
        ),
        trigram_arm AS (
          SELECT id, row_number() OVER (ORDER BY similarity(title, q) DESC, id) AS rank
          FROM search_document
          WHERE title % q
          LIMIT 100
        ),
        fused AS (
          SELECT id, SUM(1.0 / (60 + rank)) AS score
          FROM (
            SELECT * FROM simple_arm
            UNION ALL SELECT * FROM english_arm
            UNION ALL SELECT * FROM trigram_arm
          ) arms
          GROUP BY id
        )
        SELECT d.id, d.entity_type, d.entity_id, d.public_id, d.href, d.title, d.summary,
               f.score::double precision
        FROM fused f
        JOIN search_document d ON d.id = f.id
        ORDER BY f.score DESC, d.id
        LIMIT max_results;
      $body$;
    $fn$;
  END IF;
END
$do$;
