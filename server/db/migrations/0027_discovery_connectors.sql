ALTER TYPE "source_kind" ADD VALUE IF NOT EXISTS 'agent_search';
--> statement-breakpoint
ALTER TYPE "source_kind" ADD VALUE IF NOT EXISTS 'gdelt';
--> statement-breakpoint
ALTER TABLE "source" ADD COLUMN IF NOT EXISTS "logical_key" text;
--> statement-breakpoint
WITH candidates AS (
  SELECT id,
         kind::text || ':query:' || lower(regexp_replace(btrim(config->>'query'), '\s+', ' ', 'g')) AS logical_key,
         row_number() OVER (
           PARTITION BY kind, lower(regexp_replace(btrim(config->>'query'), '\s+', ' ', 'g'))
           ORDER BY created_at, id
         ) AS position
  FROM source
  WHERE config->>'query' IS NOT NULL AND btrim(config->>'query') <> ''
), feed_candidates AS (
  SELECT id,
         kind::text || ':url:' || lower(btrim(feed_url)) AS logical_key,
         row_number() OVER (
           PARTITION BY kind, lower(btrim(feed_url))
           ORDER BY created_at, id
         ) AS position
  FROM source
  WHERE feed_url IS NOT NULL AND btrim(feed_url) <> ''
)
UPDATE source s
SET logical_key = coalesce(
  (SELECT c.logical_key FROM candidates c WHERE c.id = s.id AND c.position = 1),
  (SELECT f.logical_key FROM feed_candidates f WHERE f.id = s.id AND f.position = 1)
)
WHERE EXISTS (SELECT 1 FROM candidates c WHERE c.id = s.id AND c.position = 1)
   OR EXISTS (SELECT 1 FROM feed_candidates f WHERE f.id = s.id AND f.position = 1);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "source_logical_key_unique" ON "source" ("logical_key") WHERE "logical_key" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_by_logical_key" ON "source" ("logical_key");
