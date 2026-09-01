-- Migration 0027 introduced a normalized logical key but deliberately left
-- historical duplicate query rows without one, so its unique index could be
-- created without deleting evidence or fetch history. Retire those duplicate
-- collectors now rather than deleting them: their audit rows remain intact,
-- while only one canonical collector per normalized Agent Search query can
-- ever run again.
WITH ranked AS (
  SELECT s.id,
         first_value(s.id) OVER (
           PARTITION BY lower(regexp_replace(btrim(s.config->>'query'), '\s+', ' ', 'g'))
           ORDER BY s.active DESC,
                    s.last_successful_fetch_at DESC NULLS LAST,
                    s.created_at ASC,
                    s.id ASC
         ) AS canonical_id,
         row_number() OVER (
           PARTITION BY lower(regexp_replace(btrim(s.config->>'query'), '\s+', ' ', 'g'))
           ORDER BY s.active DESC,
                    s.last_successful_fetch_at DESC NULLS LAST,
                    s.created_at ASC,
                    s.id ASC
         ) AS position
  FROM source AS s
  WHERE s.kind = 'agent_search'
    AND nullif(btrim(s.config->>'query'), '') IS NOT NULL
)
UPDATE source AS s
SET active = false,
    logical_key = NULL,
    config = jsonb_set(
      jsonb_set(coalesce(s.config, '{}'::jsonb), '{verificationState}', '"retired_duplicate"'::jsonb, true),
      '{duplicateOf}', to_jsonb(r.canonical_id::text), true
    ),
    disabled_at = coalesce(s.disabled_at, now()),
    disabled_reason = 'Retired duplicate Agent Search query; historical fetch and evidence records retained.',
    updated_at = now()
FROM ranked AS r
WHERE s.id = r.id
  AND r.position > 1;
