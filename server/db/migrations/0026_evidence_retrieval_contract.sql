-- Evidence-level retrieval state, canonical identity and source health.

ALTER TABLE evidence
  ADD COLUMN discovery_url text,
  ADD COLUMN canonical_url text,
  ADD COLUMN publisher_domain text,
  ADD COLUMN normalized_content_hash text,
  ADD COLUMN usable_text_length integer DEFAULT 0 NOT NULL,
  ADD COLUMN retrieval_status text DEFAULT 'discovered' NOT NULL,
  ADD COLUMN access_state text DEFAULT 'open' NOT NULL,
  ADD COLUMN content_type text,
  ADD COLUMN discovery_metadata jsonb,
  ADD COLUMN retention_class text DEFAULT 'metadata_excerpt' NOT NULL;
--> statement-breakpoint

UPDATE evidence
SET canonical_url = url,
    discovery_url = url,
    usable_text_length = length(coalesce(excerpt, '')),
    retrieval_status = CASE WHEN url IS NULL THEN 'partial' ELSE 'discovered' END;
--> statement-breakpoint

-- Preserve every historical row while allowing a unique canonical identity
-- going forward. Duplicate legacy rows keep their discovery URL and are
-- repaired by the later merge workflow rather than deleted in a migration.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY canonical_url ORDER BY captured_at, id) AS position
  FROM evidence
  WHERE canonical_url IS NOT NULL
)
UPDATE evidence e
SET canonical_url = NULL
FROM ranked r
WHERE e.id = r.id AND r.position > 1;
--> statement-breakpoint

ALTER TABLE evidence
  ADD CONSTRAINT evidence_normalized_hash_is_sha256
    CHECK (normalized_content_hash IS NULL OR normalized_content_hash ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT evidence_usable_text_length_is_valid CHECK (usable_text_length >= 0),
  ADD CONSTRAINT evidence_retrieval_status_is_valid
    CHECK (retrieval_status IN ('discovered', 'fetched', 'partial', 'failed')),
  ADD CONSTRAINT evidence_access_state_is_valid
    CHECK (access_state IN ('open', 'blocked', 'login_required', 'paywalled', 'unavailable')),
  ADD CONSTRAINT evidence_retention_class_is_valid
    CHECK (retention_class IN ('metadata_only', 'metadata_excerpt', 'raw_permitted'));
--> statement-breakpoint

CREATE INDEX evidence_by_canonical_url ON evidence (canonical_url);
--> statement-breakpoint
CREATE UNIQUE INDEX evidence_canonical_url_is_unique ON evidence (canonical_url)
  WHERE canonical_url IS NOT NULL;
--> statement-breakpoint
CREATE INDEX evidence_by_normalized_content_hash ON evidence (normalized_content_hash);
--> statement-breakpoint
CREATE INDEX evidence_by_published_at ON evidence (published_at);
--> statement-breakpoint
CREATE INDEX evidence_by_retrieval_status ON evidence (retrieval_status);
--> statement-breakpoint

ALTER TABLE source
  ADD COLUMN consecutive_failures integer DEFAULT 0 NOT NULL,
  ADD COLUMN last_successful_fetch_at timestamptz,
  ADD COLUMN disabled_at timestamptz,
  ADD COLUMN disabled_reason text,
  ADD CONSTRAINT source_failure_count_is_valid CHECK (consecutive_failures >= 0);
--> statement-breakpoint

ALTER TABLE source_fetch ADD COLUMN raw_content_type text;
