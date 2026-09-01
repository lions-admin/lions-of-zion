-- The source health columns were introduced after initial RSS collection had
-- already begun. Preserve the actual last successful fetch for those sources
-- instead of showing a blank health field until their next collection run.
UPDATE source AS s
SET last_successful_fetch_at = historical.last_successful_fetch_at,
    consecutive_failures = 0,
    disabled_at = NULL,
    disabled_reason = NULL,
    updated_at = now()
FROM (
  SELECT source_id, max(finished_at) AS last_successful_fetch_at
  FROM source_fetch
  WHERE status IN ('success', 'partial')
  GROUP BY source_id
) AS historical
WHERE s.id = historical.source_id
  AND (
    s.last_successful_fetch_at IS NULL
    OR s.last_successful_fetch_at < historical.last_successful_fetch_at
  );
