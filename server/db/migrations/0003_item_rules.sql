-- Phase 2 rules: status legality, the append-only transition trail, and the
-- guard over the derived columns.

-- ── The transition trail is append-only ──────────────────────────────────────
CREATE TRIGGER item_status_transition_is_append_only
  BEFORE UPDATE OR DELETE ON item_status_transition
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint

-- ── Only legal status moves, and the trail is written here ───────────────────
-- In the trigger rather than the service so the audit trail cannot be skipped
-- by forgetting to call something, and so a console session is held to the same
-- rules as the API. Legality is read from `status_transition`, so opening a new
-- path is an INSERT rather than a migration and a redeploy.
CREATE OR REPLACE FUNCTION enforce_status_transition() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  is_legal boolean;
  actor text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT true INTO is_legal FROM status_transition
    WHERE from_status = OLD.status AND to_status = NEW.status;

  IF NOT COALESCE(is_legal, false) THEN
    RAISE EXCEPTION 'information_item % may not move from % to %',
      NEW.id, OLD.status, NEW.status
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- `app.identity` is set per transaction by the service layer. Falling back to
  -- the database user keeps the trail honest for migrations and console work
  -- rather than leaving it null and unattributable.
  actor := COALESCE(NULLIF(current_setting('app.identity', true), ''), current_user);

  INSERT INTO item_status_transition (item_id, from_status, to_status, actor_label, reason)
  VALUES (NEW.id, OLD.status, NEW.status, actor, NEW.status_reason);

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER information_item_status_is_legal
  BEFORE UPDATE ON information_item
  FOR EACH ROW EXECUTE FUNCTION enforce_status_transition();
--> statement-breakpoint

-- ── The derived columns belong to the database ───────────────────────────────
-- `assessment`, `confidence_summary` and `current_assessment_id` are caches of
-- what `item_assessment` says. On a platform that publishes verdicts, an item
-- reading `verified` while its live assessment says `contested` is not a stale
-- cache — it is a false publication.
--
-- So application writes are refused outright. Phase 4 adds the trigger that
-- MAINTAINS them from the live assessment; until that table exists they stay
-- null, which is correct: an item with no assessment has no assessment.
--
-- The maintaining trigger will set `app.syncing_derived` to bypass this guard,
-- which is the one sanctioned path.
CREATE OR REPLACE FUNCTION reject_derived_column_write() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(current_setting('app.syncing_derived', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.assessment IS DISTINCT FROM OLD.assessment
     OR NEW.confidence_summary IS DISTINCT FROM OLD.confidence_summary
     OR NEW.current_assessment_id IS DISTINCT FROM OLD.current_assessment_id THEN
    RAISE EXCEPTION
      'information_item.assessment, .confidence_summary and .current_assessment_id are derived from item_assessment and may not be written directly'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER information_item_derived_columns_are_readonly
  BEFORE UPDATE ON information_item
  FOR EACH ROW EXECUTE FUNCTION reject_derived_column_write();
--> statement-breakpoint

-- ── The legal transition table ───────────────────────────────────────────────
-- Mirrored by LEGAL_TRANSITIONS in server/contracts/item.ts, which exists only
-- so the API can explain a refusal instead of surfacing a constraint violation.
-- A test asserts the two agree.
INSERT INTO status_transition (from_status, to_status, requires_capability) VALUES
  ('detected',     'under_review', NULL),
  ('detected',     'rejected',     NULL),
  ('detected',     'archived',     NULL),
  ('under_review', 'reviewed',     NULL),
  ('under_review', 'rejected',     NULL),
  ('under_review', 'archived',     NULL),
  ('under_review', 'edited',       NULL),
  ('reviewed',     'approved',     'assessment.approve'),
  ('reviewed',     'under_review', NULL),
  ('reviewed',     'edited',       NULL),
  ('reviewed',     'rejected',     NULL),
  ('reviewed',     'archived',     NULL),
  ('edited',       'under_review', NULL),
  ('edited',       'reviewed',     NULL),
  ('edited',       'approved',     'assessment.approve'),
  ('approved',     'published',    'assessment.publish'),
  ('approved',     'under_review', NULL),
  ('approved',     'edited',       NULL),
  ('approved',     'archived',     NULL),
  ('published',    'updated',      'assessment.publish'),
  ('published',    'under_review', NULL),
  ('published',    'archived',     NULL),
  ('updated',      'published',    'assessment.publish'),
  ('updated',      'under_review', NULL),
  ('updated',      'archived',     NULL),
  ('archived',     'under_review', NULL),
  ('rejected',     'under_review', NULL);
