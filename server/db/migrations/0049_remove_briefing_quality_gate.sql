ALTER TABLE "publication" DROP CONSTRAINT IF EXISTS "automatic_publication_has_quality_provenance";
--> statement-breakpoint
ALTER TABLE "publication" ADD CONSTRAINT "automatic_publication_has_machine_provenance" CHECK (
  "publication"."auto_published_at" IS NULL OR (
    "publication"."briefing_run_id" IS NOT NULL
    AND length(btrim(coalesce("publication"."briefing_candidate_key", ''))) > 0
    AND length(btrim(coalesce("publication"."machine_author", ''))) > 0
  )
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_publication_publish_gate() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  approver_is_automated boolean;
BEGIN
  IF NEW.status <> 'published'
     OR (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  IF current_user = 'app_service' AND NEW.auto_published_at IS NULL THEN
    RAISE EXCEPTION 'service identities may publish only through the automatic publication path'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW.auto_published_at IS NOT NULL THEN
    IF NEW.approved_by IS NOT NULL THEN
      RAISE EXCEPTION 'publication % cannot be both automatically and human approved', NEW.id
        USING ERRCODE = 'restrict_violation';
    END IF;
    IF NEW.briefing_run_id IS NULL
       OR length(btrim(coalesce(NEW.briefing_candidate_key, ''))) = 0
       OR length(btrim(coalesce(NEW.machine_author, ''))) = 0 THEN
      RAISE EXCEPTION 'automatic publication % lacks machine provenance', NEW.id
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
UPDATE briefing_job
SET state = 'completed', finished_at = coalesce(finished_at, now()), updated_at = now(),
    last_error = 'Quality-review stage retired by owner instruction'
WHERE stage = 'quality' AND state IN ('pending', 'running', 'quarantined');
--> statement-breakpoint
INSERT INTO briefing_job (
  job_key, contract_version, stage, local_date, edition_id, state, available_at
)
SELECT
  'publish:' || be.local_date::text || ':v1', 1, 'publish', be.local_date, be.id, 'pending', now()
FROM briefing_edition be
WHERE be.status IN ('processing', 'failed', 'quarantined')
  AND EXISTS (
    SELECT 1 FROM briefing_stage_artifact a
    WHERE a.edition_id = be.id AND a.stage = 'draft'
  )
ON CONFLICT (job_key) DO UPDATE
SET state = CASE WHEN briefing_job.state = 'completed' THEN briefing_job.state ELSE 'pending' END,
    available_at = now(), lease_until = NULL, updated_at = now();
