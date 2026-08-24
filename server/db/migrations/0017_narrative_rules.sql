-- Phase 9 rules: observations are a record of sightings, derived columns
-- follow them, high-severity attribution needs a human, and the signal that
-- answers "spread or amplification" is computed in one place.

-- ── An observation is a sighting, not a draft ───────────────────────────────
-- If a sighting was recorded wrongly, the correction is a new row. Rewriting
-- what was observed is how a monitoring log stops being evidence.
CREATE TRIGGER narrative_observation_is_append_only
  BEFORE UPDATE OR DELETE ON narrative_observation
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint

-- ── Attribution to a state or a network must be confirmed by a human ────────
-- Naming an account as a sharer is an observation. Naming a STATE as the
-- author of a campaign is a claim of an entirely different order, and one an
-- automated pipeline must never be able to make on its own — least of all by
-- confirming its own finding.
--
-- The kind lives on `actor`, so this cannot be a single-row CHECK the way
-- `manipulated_requires_elevated_review` is. It is the same rule in the only
-- form available across tables.
--
-- The list mirrors ATTRIBUTION_NEEDS_REVIEW in server/contracts/enums.ts, and
-- a test asserts the two agree — the same deliberate duplication used for
-- NEVER_AUTOMATED_CAPABILITIES.
CREATE OR REPLACE FUNCTION enforce_attribution_review() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  k actor_kind;
  confirmer_is_automated boolean;
BEGIN
  IF NEW.actor_id IS NULL OR NEW.confirmed_by IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT kind INTO k FROM actor WHERE id = NEW.actor_id;
  IF k NOT IN ('state', 'network') THEN
    RETURN NEW;
  END IF;

  SELECT is_automated INTO confirmer_is_automated
    FROM app_user WHERE id = NEW.confirmed_by;

  IF COALESCE(confirmer_is_automated, true) THEN
    RAISE EXCEPTION
      'attributing a narrative to a % actor must be confirmed by a human reviewer', k
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER narrative_observation_attribution_is_reviewed
  BEFORE INSERT ON narrative_observation
  FOR EACH ROW EXECUTE FUNCTION enforce_attribution_review();
--> statement-breakpoint

-- ── The narrative's derived columns follow its observations ─────────────────
-- Same pattern and same sanctioned bypass as the derived columns on
-- information_item. A narrative whose last_seen_at disagrees with its
-- observations is a monitoring system reporting a live threat as quiet.
CREATE OR REPLACE FUNCTION sync_narrative_derived_columns() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.syncing_derived', 'on', true);

  UPDATE narrative n
  SET first_seen_at = agg.first_seen,
      last_seen_at  = agg.last_seen,
      observation_count = agg.n
  FROM (
    SELECT MIN(observed_at) AS first_seen,
           MAX(observed_at) AS last_seen,
           COUNT(*)         AS n
    FROM narrative_observation
    WHERE narrative_id = NEW.narrative_id
  ) agg
  WHERE n.id = NEW.narrative_id;

  PERFORM set_config('app.syncing_derived', 'off', true);
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER narrative_observation_syncs_derived
  AFTER INSERT ON narrative_observation
  FOR EACH ROW EXECUTE FUNCTION sync_narrative_derived_columns();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION reject_narrative_derived_write() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(current_setting('app.syncing_derived', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.first_seen_at IS DISTINCT FROM OLD.first_seen_at
     OR NEW.last_seen_at IS DISTINCT FROM OLD.last_seen_at
     OR NEW.observation_count IS DISTINCT FROM OLD.observation_count THEN
    RAISE EXCEPTION
      'narrative.first_seen_at, .last_seen_at and .observation_count are derived from narrative_observation and may not be written directly'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER narrative_derived_columns_are_readonly
  BEFORE UPDATE ON narrative
  FOR EACH ROW EXECUTE FUNCTION reject_narrative_derived_write();
--> statement-breakpoint

-- ── The signal: spread, or amplification? ───────────────────────────────────
-- This function is what Phase 9 is measured by.
--
-- The count that matters is NOT how many accounts pushed a narrative. It is
-- how many INDEPENDENT SOURCE FAMILIES did. Twenty accounts inside one family
-- is a megaphone; three accounts across three families is a story travelling.
-- A monitoring system that counts accounts reports the megaphone as consensus,
-- which is the precise failure `source_family` was introduced in Phase 3 to
-- prevent — and this is the first place it does that work.
--
-- Unconfirmed attributions to state/network actors are excluded from every
-- count. They remain in the table as leads; they simply do not drive a signal
-- until a human stands behind them.
CREATE OR REPLACE FUNCTION narrative_activity(since timestamptz)
RETURNS TABLE (
  narrative_id uuid,
  public_id text,
  title text,
  status narrative_status,
  observations bigint,
  distinct_actors bigint,
  distinct_families bigint,
  amplification numeric,
  reported_reach bigint,
  linked_items bigint,
  items_found_problematic bigint,
  last_seen timestamptz
) LANGUAGE sql STABLE AS $$
  WITH counted AS (
    SELECT o.narrative_id,
           COUNT(*)                                   AS observations,
           COUNT(DISTINCT o.actor_id)                 AS distinct_actors,
           COUNT(DISTINCT s.source_family_id)         AS distinct_families,
           COALESCE(SUM(o.reported_reach), 0)         AS reported_reach,
           MAX(o.observed_at)                         AS last_seen
    FROM narrative_observation o
    JOIN evidence e ON e.id = o.evidence_id
    JOIN source   s ON s.id = e.source_id
    LEFT JOIN actor a ON a.id = o.actor_id
    WHERE o.observed_at >= since
      AND (a.kind IS NULL
           OR a.kind NOT IN ('state', 'network')
           OR o.confirmed_by IS NOT NULL)
    GROUP BY o.narrative_id
  ),
  items AS (
    SELECT ni.narrative_id,
           COUNT(*) AS linked_items,
           COUNT(*) FILTER (
             WHERE i.assessment IN ('false','misleading','manipulated','out_of_context')
           ) AS problematic
    FROM narrative_item ni
    JOIN information_item i ON i.id = ni.item_id
    GROUP BY ni.narrative_id
  )
  SELECT n.id, n.public_id, n.title, n.status,
         c.observations,
         c.distinct_actors,
         c.distinct_families,
         /* Actors per independent family. Around 1 means each voice is its own
            origin. Climbing well above 1 means few origins, many mouths. */
         ROUND(c.distinct_actors::numeric / NULLIF(c.distinct_families, 0), 2),
         c.reported_reach,
         COALESCE(i.linked_items, 0),
         COALESCE(i.problematic, 0),
         c.last_seen
  FROM counted c
  JOIN narrative n ON n.id = c.narrative_id
  LEFT JOIN items i ON i.narrative_id = c.narrative_id
  WHERE n.status <> 'retired'
  ORDER BY c.observations DESC, c.last_seen DESC;
$$;
