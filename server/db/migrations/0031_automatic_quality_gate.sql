CREATE OR REPLACE FUNCTION enforce_publication_publish_gate() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  approver_is_automated boolean;
  quality_passes integer;
BEGIN
  IF NEW.status <> 'published'
     OR (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  IF current_user = 'app_service' AND NEW.auto_published_at IS NULL THEN
    RAISE EXCEPTION 'service identities may publish only through the automatic quality path'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW.auto_published_at IS NOT NULL THEN
    IF NEW.approved_by IS NOT NULL THEN
      RAISE EXCEPTION 'publication % cannot be both automatically and human approved', NEW.id
        USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.briefing_run_id IS NULL OR NEW.quality_approved_at IS NULL
       OR length(btrim(coalesce(NEW.machine_author, ''))) = 0 THEN
      RAISE EXCEPTION 'automatic publication % lacks run and quality provenance', NEW.id
        USING ERRCODE = 'restrict_violation';
    END IF;

    SELECT count(*) INTO quality_passes
    FROM briefing_quality_check bqc
    WHERE bqc.briefing_run_id = NEW.briefing_run_id
      AND bqc.candidate_key = current_setting('app.quality_candidate', true)
      AND bqc.status = 'pass'
      AND bqc.check_name IN (
        'known_evidence',
        'direct_publishers',
        'processable_source_text',
        'source_independence',
        'specific_title',
        'substantive_body',
        'non_placeholder_body',
        'title_source_alignment',
        'claim_evidence_matrix',
        'claim_source_independence',
        'paragraph_traceability',
        'exact_fact_fidelity'
      );
    IF quality_passes <> 12 THEN
      RAISE EXCEPTION 'automatic publication % has not passed every quality check', NEW.id
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.approved_by IS NOT NULL THEN
    IF NEW.approved_by = NEW.created_by THEN
      RAISE EXCEPTION 'publication % cannot be approved by its own author', NEW.id
        USING ERRCODE = 'restrict_violation';
    END IF;

    SELECT is_automated INTO approver_is_automated FROM app_user WHERE id = NEW.approved_by;
    IF COALESCE(approver_is_automated, true) THEN
      RAISE EXCEPTION 'publication % approver must be a human reviewer', NEW.id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS publication_publish_gate ON publication;
--> statement-breakpoint
CREATE TRIGGER publication_publish_gate
  BEFORE INSERT OR UPDATE ON publication
  FOR EACH ROW EXECUTE FUNCTION enforce_publication_publish_gate();
