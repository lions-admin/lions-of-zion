-- A search hit that cannot be opened is not a search result.
--
-- `search_document` carried `entity_type` + `entity_id` and nothing else that
-- addresses a page. Nothing public resolves either one: `published-items` has
-- no id filter, `published-publications/[publicId]` takes a `public_id` the
-- index does not store, and there is no route at all that maps an internal
-- uuid to a URL. So every hit the API returned was a title with no destination,
-- and a reader could search this corpus and reach none of it.
--
-- The fix belongs in the projection rather than in a resolver, for the same
-- reason the projection exists at all: one table, one shape, one index set. A
-- resolver would mean a second round trip per result set and a UNION over
-- differently-shaped tables — exactly what `search_document` was denormalised
-- to avoid. Two columns, written by the same reindex that writes the text.
--
-- `href` is deliberately nullable, and the null cases are the honest half of
-- this change:
--
--   * `information_item` has a `public_id` and **no public page** — the site
--     has `/articles/[publicId]` for publications and nothing equivalent for
--     items. Its `public_id` is stored so the day that route exists is a
--     backfill and not a schema change; until then the destination is null.
--   * a publication is addressable at `/articles/[publicId]` only when it has
--     a `briefing_run_id`. That is the same gate `getBriefingPublicDetail()`
--     applies and the same one `app/sitemap.ts` warns about by hand: the
--     historic site-reference publications share the table and 404 on that
--     route. Feeding them a href would manufacture dead links.
--   * evidence and narratives are never visible to an anonymous reader at all
--     (`search_document_public_published_items`, migration 0018), so their
--     destination is moot rather than missing.
--
-- The UI therefore has to distinguish "indexed" from "reachable", and can.

ALTER TABLE search_document ADD COLUMN IF NOT EXISTS public_id text;
--> statement-breakpoint
ALTER TABLE search_document ADD COLUMN IF NOT EXISTS href text;
--> statement-breakpoint

-- Backfill, so the existing index becomes navigable without waiting for every
-- entity to be reindexed by an unrelated write.
UPDATE search_document sd
SET public_id = i.public_id
FROM information_item i
WHERE sd.entity_type = 'information_item' AND i.id = sd.entity_id;
--> statement-breakpoint

UPDATE search_document sd
SET public_id = p.public_id,
    href = CASE WHEN p.briefing_run_id IS NOT NULL THEN '/articles/' || p.public_id END
FROM publication p
WHERE sd.entity_type::text = p.kind::text AND p.id = sd.entity_id;
--> statement-breakpoint

-- `search_hybrid` gains two output columns, so it is dropped rather than
-- replaced: `CREATE OR REPLACE FUNCTION` cannot change a return type. Both
-- bodies are rewritten together and stay signature-identical, which is the
-- property migration 0009 established and that the caller depends on — it
-- never branches on whether pgvector exists. The function is not
-- `SECURITY DEFINER`, so it runs as the caller and the RLS policy on
-- `search_document` still decides what an anonymous reader sees.
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
        SELECT d.id, d.entity_type, d.entity_id, d.public_id, d.href, d.title,
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
        SELECT d.id, d.entity_type, d.entity_id, d.public_id, d.href, d.title,
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
