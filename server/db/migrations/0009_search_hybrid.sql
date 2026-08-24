-- Phase 5: hybrid retrieval, fused in one function.
--
-- ── Why one SQL function ────────────────────────────────────────────────────
-- Every Neon round trip is most of the latency budget. Running three or four
-- retrieval arms as separate queries and fusing them in TypeScript would cost
-- one round trip per arm; fusing in SQL costs one for the whole search.
--
-- ── Why Reciprocal Rank Fusion, not score normalization ─────────────────────
-- `ts_rank_cd` and cosine similarity are not commensurable. Any mapping
-- between them is a calibration, and a calibration rots as the corpus grows —
-- silently, because nothing fails, results just get worse. RRF discards the
-- scores and keeps only the ordering each arm produced: an arm's contribution
-- is 1/(k + rank). It has no parameters to drift except k, which is
-- conventionally 60 and is not sensitive.
--
-- ── Why the vector arm is conditional ───────────────────────────────────────
-- PGlite ships no pgvector (spiked twice; see DECISIONS.md), and the test
-- suite runs entirely on PGlite. So the extension, the `embedding` column and
-- its HNSW index are created only where the extension is actually available,
-- and `search_hybrid` is created with one of two bodies to match.
--
-- Both bodies have the IDENTICAL signature, including the `q_embedding text`
-- parameter — the caller never branches, never inspects the environment, and
-- passes NULL when it has no embedding to offer. The lexical half of search is
-- therefore exercised by the normal test suite rather than being untestable
-- until a real Postgres is provisioned, which is the entire point.

DO $do$
DECLARE
  has_vector boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector')
    INTO has_vector;

  IF has_vector THEN
    CREATE EXTENSION IF NOT EXISTS vector;

    ALTER TABLE search_document ADD COLUMN IF NOT EXISTS embedding vector(1536);

    -- HNSW over cosine distance. The dimension is a full table rewrite to
    -- change, so a model swap must be additive (a second column), never an
    -- ALTER of this one.
    CREATE INDEX IF NOT EXISTS search_document_embedding
      ON search_document USING hnsw (embedding vector_cosine_ops);

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION search_hybrid(
        q text,
        q_embedding text,
        max_results int DEFAULT 25
      ) RETURNS TABLE (
        document_id uuid,
        entity_type entity_type,
        entity_id uuid,
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
        SELECT d.id, d.entity_type, d.entity_id, d.title, f.score::double precision
        FROM fused f
        JOIN search_document d ON d.id = f.id
        ORDER BY f.score DESC, d.id
        LIMIT max_results;
      $body$;
    $fn$;

  ELSE
    -- No pgvector here. Same signature; `q_embedding` is accepted and ignored,
    -- so calling code is identical in both environments and a test that passes
    -- an embedding still exercises the real fusion path over three arms.
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION search_hybrid(
        q text,
        q_embedding text,
        max_results int DEFAULT 25
      ) RETURNS TABLE (
        document_id uuid,
        entity_type entity_type,
        entity_id uuid,
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
        SELECT d.id, d.entity_type, d.entity_id, d.title, f.score::double precision
        FROM fused f
        JOIN search_document d ON d.id = f.id
        ORDER BY f.score DESC, d.id
        LIMIT max_results;
      $body$;
    $fn$;
  END IF;
END
$do$;
--> statement-breakpoint

-- Reports whether the semantic arm is actually live in this database, so a
-- health check or a test can say so out loud rather than inferring it from
-- results that merely look plausible.
CREATE OR REPLACE FUNCTION search_has_semantic_arm() RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'search_document' AND column_name = 'embedding'
  );
$$;
