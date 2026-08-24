-- Phase 4 rules: an assessment cannot be rewritten, an item's cached verdict
-- cannot drift from the assessment that produced it, and publishing checks
-- the cross-table half of "reviewed by a human who is not the author".

-- ── item_assessment is immutable, except two fields settable once ───────────
-- `superseded_by_assessment_id` is set by the next assessment for the same
-- item; `approved_by` is set once, when this specific assessment is reviewed.
-- Both start null and may move to a value exactly once — an assessment whose
-- verdict, reasoning or confidence dimensions could change after the fact is
-- not a record of what was concluded, it is a record of what someone wishes
-- had been concluded.
CREATE OR REPLACE FUNCTION enforce_assessment_immutability() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.item_id IS DISTINCT FROM OLD.item_id
     OR NEW.value IS DISTINCT FROM OLD.value
     OR NEW.summary IS DISTINCT FROM OLD.summary
     OR NEW.known_gaps IS DISTINCT FROM OLD.known_gaps
     OR NEW.false_impression IS DISTINCT FROM OLD.false_impression
     OR NEW.confidence_evidence_coverage IS DISTINCT FROM OLD.confidence_evidence_coverage
     OR NEW.confidence_source_independence IS DISTINCT FROM OLD.confidence_source_independence
     OR NEW.confidence_source_authority IS DISTINCT FROM OLD.confidence_source_authority
     OR NEW.confidence_media_provenance IS DISTINCT FROM OLD.confidence_media_provenance
     OR NEW.confidence_temporal_consistency IS DISTINCT FROM OLD.confidence_temporal_consistency
     OR NEW.confidence_geographic_consistency IS DISTINCT FROM OLD.confidence_geographic_consistency
     OR NEW.confidence_contradiction_level IS DISTINCT FROM OLD.confidence_contradiction_level
     OR NEW.confidence_translation_certainty IS DISTINCT FROM OLD.confidence_translation_certainty
     OR NEW.confidence_human_review_state IS DISTINCT FROM OLD.confidence_human_review_state
     OR NEW.confidence_remaining_gaps IS DISTINCT FROM OLD.confidence_remaining_gaps
     OR NEW.confidence_summary IS DISTINCT FROM OLD.confidence_summary
     OR NEW.review_level IS DISTINCT FROM OLD.review_level
     OR NEW.eligibility IS DISTINCT FROM OLD.eligibility
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'item_assessment is immutable except for superseded_by_assessment_id and a one-time approved_by'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD.superseded_by_assessment_id IS NOT NULL
     AND NEW.superseded_by_assessment_id IS DISTINCT FROM OLD.superseded_by_assessment_id THEN
    RAISE EXCEPTION 'item_assessment.superseded_by_assessment_id may be set once, not changed again'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD.approved_by IS NOT NULL
     AND NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    RAISE EXCEPTION 'item_assessment.approved_by may be set once, not changed again'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER item_assessment_is_immutable
  BEFORE UPDATE ON item_assessment
  FOR EACH ROW EXECUTE FUNCTION enforce_assessment_immutability();
--> statement-breakpoint

-- ── The derived columns are maintained here, from the live assessment ───────
-- Phase 2 left `assessment`, `confidence_summary` and `current_assessment_id`
-- null-only, with application writes refused. Every new item_assessment row
-- is, by construction, the new live one for its item — the service is
-- responsible for marking the previous row superseded in the same
-- transaction, but this trigger does not need to know that order; it only
-- ever points the item at whichever assessment was just inserted.
CREATE OR REPLACE FUNCTION sync_item_derived_columns() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.syncing_derived', 'on', true);
  UPDATE information_item
    SET assessment = NEW.value,
        confidence_summary = NEW.confidence_summary,
        current_assessment_id = NEW.id
    WHERE id = NEW.item_id;
  PERFORM set_config('app.syncing_derived', 'off', true);
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER item_assessment_syncs_item_derived_columns
  AFTER INSERT ON item_assessment
  FOR EACH ROW EXECUTE FUNCTION sync_item_derived_columns();
--> statement-breakpoint

-- ── The publish gate: the cross-table half of "reviewed, by a human, not ────
-- the author" ─────────────────────────────────────────────────────────────
-- `published_has_timestamp_and_approver` (Phase 2) already refuses a null
-- `approved_by` or a missing assessment — a single-row CHECK owns that, and
-- this trigger deliberately does not repeat it: if it raised on the same
-- null it would win the race against the CHECK (triggers run before
-- constraint validation) and callers would see this trigger's SQLSTATE
-- instead of the CHECK's, for a condition the CHECK already names precisely.
--
-- What only a trigger can see is who `approved_by` and the assessment's own
-- `approved_by` actually ARE — human, and not the author of the thing they
-- approved — so that is all it checks, and only once the single-row half
-- already holds.
CREATE OR REPLACE FUNCTION enforce_publish_gate() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  approver_is_automated boolean;
  assessment_approved_by uuid;
  assessment_created_by uuid;
BEGIN
  IF NEW.status <> 'published' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.approved_by IS NOT NULL THEN
    IF NEW.approved_by = NEW.created_by THEN
      RAISE EXCEPTION 'information_item % cannot be approved by its own author', NEW.id
        USING ERRCODE = 'restrict_violation';
    END IF;

    SELECT is_automated INTO approver_is_automated FROM app_user WHERE id = NEW.approved_by;
    IF COALESCE(approver_is_automated, true) THEN
      RAISE EXCEPTION 'information_item % approver must be a human reviewer', NEW.id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  IF NEW.current_assessment_id IS NOT NULL THEN
    SELECT approved_by, created_by INTO assessment_approved_by, assessment_created_by
      FROM item_assessment WHERE id = NEW.current_assessment_id;

    IF assessment_approved_by IS NULL THEN
      RAISE EXCEPTION 'the current assessment for information_item % has not been reviewed', NEW.id
        USING ERRCODE = 'restrict_violation';
    END IF;

    IF assessment_approved_by = assessment_created_by THEN
      RAISE EXCEPTION
        'the current assessment for information_item % cannot be reviewed by its own author', NEW.id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER information_item_publish_gate
  BEFORE UPDATE ON information_item
  FOR EACH ROW EXECUTE FUNCTION enforce_publish_gate();
--> statement-breakpoint

-- ── The published view ───────────────────────────────────────────────────
-- What a reader outside the organisation may see: `PUBLIC_STATUSES` in
-- server/contracts/item.ts, joined to the assessment that justifies it.
CREATE VIEW published_item AS
SELECT
  i.id,
  i.public_id,
  i.type,
  i.title,
  i.canonical_text,
  i.summary,
  i.language,
  i.assessment,
  i.confidence_summary,
  i.published_at,
  i.event_id,
  i.primary_topic_id,
  a.summary AS assessment_summary,
  a.known_gaps AS assessment_known_gaps,
  a.false_impression AS assessment_false_impression
FROM information_item i
JOIN item_assessment a ON a.id = i.current_assessment_id
WHERE i.status IN ('published', 'updated');
