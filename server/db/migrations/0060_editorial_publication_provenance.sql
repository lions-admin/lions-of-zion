ALTER TABLE "publication" DROP CONSTRAINT "automatic_publication_has_machine_provenance";--> statement-breakpoint
ALTER TABLE "publication" ADD COLUMN "editorial_run_id" uuid;--> statement-breakpoint
ALTER TABLE "publication" ADD COLUMN "editorial_operation_key" text;--> statement-breakpoint
ALTER TABLE "publication" ADD CONSTRAINT "publication_editorial_run_id_editorial_run_id_fk" FOREIGN KEY ("editorial_run_id") REFERENCES "public"."editorial_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publication_editorial_operation_once" ON "publication" USING btree ("editorial_run_id","editorial_operation_key") WHERE "publication"."editorial_run_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "publication" ADD CONSTRAINT "automatic_publication_has_machine_provenance" CHECK ("publication"."auto_published_at" IS NULL OR (
        (("publication"."briefing_run_id" IS NOT NULL AND length(btrim(coalesce("publication"."briefing_candidate_key", ''))) > 0)
          OR ("publication"."editorial_run_id" IS NOT NULL AND length(btrim(coalesce("publication"."editorial_operation_key", ''))) > 0))
        AND length(btrim(coalesce("publication"."machine_author", ''))) > 0
      ));
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
    IF NOT (
         (NEW.briefing_run_id IS NOT NULL AND length(btrim(coalesce(NEW.briefing_candidate_key, ''))) > 0)
         OR (NEW.editorial_run_id IS NOT NULL AND length(btrim(coalesce(NEW.editorial_operation_key, ''))) > 0)
       ) OR length(btrim(coalesce(NEW.machine_author, ''))) = 0 THEN
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
CREATE OR REPLACE FUNCTION public_publication_corrections(p_publication_id uuid)
RETURNS TABLE(version integer, changed_at text, summary text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ev.version_number,
         ev.created_at::text,
         ev.change_summary
  FROM entity_version ev
  JOIN publication p ON p.id = ev.entity_id
  WHERE p.id = p_publication_id
    AND p.status IN ('published', 'updated')
    AND ev.version_number > 1
    AND (
      ev.change_source IN ('human_edit', 'correction')
      OR (
        ev.change_source = 'workflow'
        AND ev.snapshot ? 'editorialUpdateRunId'
      )
    )
$$;
