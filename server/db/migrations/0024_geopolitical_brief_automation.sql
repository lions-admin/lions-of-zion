-- Automated geopolitical briefing: public sections, evidence joins, homepage
-- placement, idempotent runs, and transparent automatic-publication provenance.

ALTER TYPE "source_kind" ADD VALUE IF NOT EXISTS 'google_search';
--> statement-breakpoint
CREATE TYPE "publication_section" AS ENUM ('daily_brief', 'israel_update', 'war_update', 'narrative_watch');
--> statement-breakpoint

ALTER TABLE "publication"
  ADD COLUMN "section" "publication_section" DEFAULT 'israel_update' NOT NULL,
  ADD COLUMN "auto_published_at" timestamp with time zone;
--> statement-breakpoint

ALTER TABLE "source_fetch" ADD COLUMN "search_query" text;
--> statement-breakpoint
CREATE INDEX "publication_by_section_status" ON "publication" USING btree ("section", "status", "published_at");
--> statement-breakpoint

ALTER TABLE "publication" DROP CONSTRAINT "published_publication_has_timestamp_and_approver";
--> statement-breakpoint
ALTER TABLE "publication" ADD CONSTRAINT "published_publication_has_timestamp_and_approver"
  CHECK ("publication"."status" NOT IN ('published', 'updated')
    OR (
      "publication"."published_at" IS NOT NULL
      AND ("publication"."approved_by" IS NOT NULL OR "publication"."auto_published_at" IS NOT NULL)
    ));
--> statement-breakpoint

CREATE TABLE "publication_narrative" (
  "publication_id" uuid NOT NULL REFERENCES "publication"("id") ON DELETE cascade,
  "narrative_id" uuid NOT NULL REFERENCES "narrative"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "publication_narrative_pk" PRIMARY KEY("publication_id", "narrative_id")
);
--> statement-breakpoint
CREATE INDEX "publication_narrative_by_narrative" ON "publication_narrative" USING btree ("narrative_id");
--> statement-breakpoint

CREATE TABLE "publication_evidence" (
  "publication_id" uuid NOT NULL REFERENCES "publication"("id") ON DELETE cascade,
  "evidence_id" uuid NOT NULL REFERENCES "evidence"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "publication_evidence_pk" PRIMARY KEY("publication_id", "evidence_id")
);
--> statement-breakpoint
CREATE INDEX "publication_evidence_by_evidence" ON "publication_evidence" USING btree ("evidence_id");
--> statement-breakpoint

CREATE TABLE "homepage_feature" (
  "slot" integer PRIMARY KEY,
  "publication_id" uuid NOT NULL UNIQUE REFERENCES "publication"("id") ON DELETE cascade,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "homepage_feature_slot_is_valid" CHECK ("homepage_feature"."slot" BETWEEN 1 AND 3)
);
--> statement-breakpoint

CREATE TABLE "briefing_run" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "local_date" text NOT NULL,
  "stage" text NOT NULL,
  "status" text NOT NULL,
  "input_count" integer DEFAULT 0 NOT NULL,
  "output_count" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "started_at" timestamp with time zone NOT NULL,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "briefing_run_has_stage" CHECK (length(btrim("briefing_run"."stage")) > 0),
  CONSTRAINT "briefing_run_has_status" CHECK (length(btrim("briefing_run"."status")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "briefing_run_once_per_stage_day" ON "briefing_run" USING btree ("local_date", "stage");
--> statement-breakpoint
CREATE INDEX "briefing_run_by_date" ON "briefing_run" USING btree ("local_date", "created_at");
--> statement-breakpoint

-- A scheduled publication is allowed only when it carries explicit automatic
-- provenance. A human approval path remains unchanged and still rejects an
-- automated approver or self-approval.
CREATE OR REPLACE FUNCTION enforce_publication_publish_gate() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  approver_is_automated boolean;
BEGIN
  IF NEW.status <> 'published' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.auto_published_at IS NOT NULL THEN
    IF NEW.approved_by IS NOT NULL THEN
      RAISE EXCEPTION 'publication % cannot be both automatically and human approved', NEW.id
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

GRANT SELECT ON homepage_feature, publication_narrative, publication_evidence TO app_public;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON homepage_feature, publication_narrative, publication_evidence, briefing_run TO app_staff, app_service;
--> statement-breakpoint

ALTER TABLE homepage_feature ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY homepage_feature_public_reads_published ON homepage_feature
  FOR SELECT TO app_public
  USING (EXISTS (SELECT 1 FROM publication p WHERE p.id = publication_id AND p.status IN ('published', 'updated')));
--> statement-breakpoint
CREATE POLICY homepage_feature_staff_all ON homepage_feature
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE publication_narrative ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY publication_narrative_public_reads_published ON publication_narrative
  FOR SELECT TO app_public
  USING (EXISTS (SELECT 1 FROM publication p WHERE p.id = publication_id AND p.status IN ('published', 'updated')));
--> statement-breakpoint
CREATE POLICY publication_narrative_staff_all ON publication_narrative
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE publication_evidence ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY publication_evidence_public_reads_published ON publication_evidence
  FOR SELECT TO app_public
  USING (
    EXISTS (SELECT 1 FROM publication p WHERE p.id = publication_id AND p.status IN ('published', 'updated'))
    AND EXISTS (SELECT 1 FROM evidence e WHERE e.id = evidence_id AND e.data_class = 'public')
  );
--> statement-breakpoint
CREATE POLICY publication_evidence_staff_all ON publication_evidence
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE briefing_run ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY briefing_run_staff_all ON briefing_run
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
