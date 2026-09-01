ALTER TABLE "publication"
  ADD COLUMN IF NOT EXISTS "quality_approved_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "briefing_run_id" uuid,
  ADD COLUMN IF NOT EXISTS "machine_author" text;
--> statement-breakpoint

INSERT INTO briefing_run (local_date, stage, status, started_at, finished_at)
SELECT DISTINCT
  to_char((coalesce(p.auto_published_at, p.created_at) AT TIME ZONE 'Asia/Jerusalem')::date, 'YYYY-MM-DD'),
  'legacy-publication',
  'completed',
  min(coalesce(p.auto_published_at, p.created_at)) OVER (
    PARTITION BY (coalesce(p.auto_published_at, p.created_at) AT TIME ZONE 'Asia/Jerusalem')::date
  ),
  max(coalesce(p.auto_published_at, p.created_at)) OVER (
    PARTITION BY (coalesce(p.auto_published_at, p.created_at) AT TIME ZONE 'Asia/Jerusalem')::date
  )
FROM publication p
WHERE p.auto_published_at IS NOT NULL
ON CONFLICT (local_date, stage) DO NOTHING;
--> statement-breakpoint

UPDATE publication p
SET quality_approved_at = coalesce(p.quality_approved_at, p.auto_published_at),
    machine_author = coalesce(p.machine_author, 'legacy:automated-briefing'),
    briefing_run_id = coalesce(p.briefing_run_id, br.id)
FROM briefing_run br
WHERE p.auto_published_at IS NOT NULL
  AND br.local_date = to_char((coalesce(p.auto_published_at, p.created_at) AT TIME ZONE 'Asia/Jerusalem')::date, 'YYYY-MM-DD')
  AND br.stage = 'legacy-publication';
--> statement-breakpoint

ALTER TABLE "publication"
  ADD CONSTRAINT "publication_briefing_run_fk"
  FOREIGN KEY ("briefing_run_id") REFERENCES "briefing_run"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "publication"
  ADD CONSTRAINT "automatic_publication_has_quality_provenance"
  CHECK (
    "auto_published_at" IS NULL OR (
      "quality_approved_at" IS NOT NULL
      AND "briefing_run_id" IS NOT NULL
      AND length(btrim(coalesce("machine_author", ''))) > 0
    )
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "publication_by_briefing_run" ON "publication" ("briefing_run_id");
--> statement-breakpoint

CREATE TABLE "briefing_edition" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "local_date" text NOT NULL UNIQUE,
  "status" text DEFAULT 'collecting' NOT NULL,
  "contract_version" text NOT NULL,
  "prompt_version" text NOT NULL,
  "collection_opened_at" timestamp with time zone NOT NULL,
  "collection_closed_at" timestamp with time zone,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "briefing_edition_status_is_known" CHECK ("status" IN ('collecting', 'processing', 'quarantined', 'published', 'failed')),
  CONSTRAINT "briefing_edition_has_contract_version" CHECK (length(btrim("contract_version")) > 0),
  CONSTRAINT "briefing_edition_has_prompt_version" CHECK (length(btrim("prompt_version")) > 0)
);
--> statement-breakpoint
CREATE INDEX "briefing_edition_by_status_date" ON "briefing_edition" ("status", "local_date");
--> statement-breakpoint

CREATE TABLE "briefing_run_ai" (
  "briefing_run_id" uuid NOT NULL REFERENCES "briefing_run"("id") ON DELETE cascade,
  "ai_run_id" uuid NOT NULL REFERENCES "ai_run"("id"),
  "stage" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "briefing_run_ai_pk" PRIMARY KEY ("briefing_run_id", "ai_run_id"),
  CONSTRAINT "briefing_run_ai_has_stage" CHECK (length(btrim("stage")) > 0)
);
--> statement-breakpoint
CREATE INDEX "briefing_run_ai_by_stage" ON "briefing_run_ai" ("briefing_run_id", "stage");
--> statement-breakpoint

CREATE TABLE "briefing_claim" (
  "item_id" uuid PRIMARY KEY REFERENCES "information_item"("id") ON DELETE cascade,
  "layer" text NOT NULL,
  "machine_assessment" text NOT NULL,
  "attributed_to" text,
  "uncertainty" text,
  "ai_run_id" uuid REFERENCES "ai_run"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "briefing_claim_layer_is_known" CHECK ("layer" IN ('source_claim', 'observed_fact', 'model_inference', 'editorial_conclusion')),
  CONSTRAINT "briefing_claim_assessment_is_known" CHECK ("machine_assessment" IN ('verified', 'refuted', 'misleading', 'unsupported', 'disputed', 'unresolved'))
);
--> statement-breakpoint
CREATE INDEX "briefing_claim_by_assessment" ON "briefing_claim" ("machine_assessment", "created_at");
--> statement-breakpoint

CREATE TABLE "briefing_quality_check" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "briefing_run_id" uuid NOT NULL REFERENCES "briefing_run"("id") ON DELETE cascade,
  "candidate_key" text NOT NULL,
  "check_name" text NOT NULL,
  "status" text NOT NULL,
  "detail" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "briefing_quality_check_unique" UNIQUE ("briefing_run_id", "candidate_key", "check_name"),
  CONSTRAINT "briefing_quality_check_status_is_known" CHECK ("status" IN ('pass', 'fail')),
  CONSTRAINT "briefing_quality_check_has_candidate" CHECK (length(btrim("candidate_key")) > 0),
  CONSTRAINT "briefing_quality_check_has_name" CHECK (length(btrim("check_name")) > 0),
  CONSTRAINT "briefing_quality_check_has_detail" CHECK (length(btrim("detail")) > 0)
);
--> statement-breakpoint
CREATE INDEX "briefing_quality_check_failures" ON "briefing_quality_check" ("status", "created_at");
--> statement-breakpoint

CREATE TABLE "briefing_quarantine" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "briefing_run_id" uuid NOT NULL REFERENCES "briefing_run"("id") ON DELETE cascade,
  "candidate_key" text NOT NULL,
  "stage" text NOT NULL,
  "reason" text NOT NULL,
  "payload" jsonb,
  "status" text DEFAULT 'open' NOT NULL,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "briefing_quarantine_status_is_known" CHECK ("status" IN ('open', 'resolved', 'discarded')),
  CONSTRAINT "briefing_quarantine_has_stage" CHECK (length(btrim("stage")) > 0),
  CONSTRAINT "briefing_quarantine_has_reason" CHECK (length(btrim("reason")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "briefing_quarantine_open_candidate" ON "briefing_quarantine" ("briefing_run_id", "candidate_key") WHERE "status" = 'open';
--> statement-breakpoint
CREATE INDEX "briefing_quarantine_by_status" ON "briefing_quarantine" ("status", "created_at");
--> statement-breakpoint

CREATE TABLE "publication_passage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "publication_id" uuid NOT NULL REFERENCES "publication"("id") ON DELETE cascade,
  "position" integer NOT NULL,
  "text" text NOT NULL,
  "item_id" uuid REFERENCES "information_item"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "publication_passage_position_unique" UNIQUE ("publication_id", "position"),
  CONSTRAINT "publication_passage_position_is_positive" CHECK ("position" >= 1),
  CONSTRAINT "publication_passage_has_text" CHECK (length(btrim("text")) > 0)
);
--> statement-breakpoint
CREATE INDEX "publication_passage_by_item" ON "publication_passage" ("item_id");
--> statement-breakpoint

CREATE TABLE "publication_passage_evidence" (
  "passage_id" uuid NOT NULL REFERENCES "publication_passage"("id") ON DELETE cascade,
  "evidence_id" uuid NOT NULL REFERENCES "evidence"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "publication_passage_evidence_pk" PRIMARY KEY ("passage_id", "evidence_id")
);
--> statement-breakpoint
CREATE INDEX "publication_passage_evidence_by_evidence" ON "publication_passage_evidence" ("evidence_id");
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON briefing_edition, briefing_run_ai, briefing_claim,
  briefing_quality_check, briefing_quarantine TO app_staff, app_service;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON publication_passage, publication_passage_evidence TO app_staff, app_service;
--> statement-breakpoint
GRANT SELECT ON publication_passage, publication_passage_evidence TO app_public;
--> statement-breakpoint

ALTER TABLE briefing_edition ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY briefing_edition_staff_all ON briefing_edition FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE briefing_run_ai ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY briefing_run_ai_staff_all ON briefing_run_ai FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE briefing_claim ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY briefing_claim_staff_all ON briefing_claim FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE briefing_quality_check ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY briefing_quality_check_staff_all ON briefing_quality_check FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE briefing_quarantine ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY briefing_quarantine_staff_all ON briefing_quarantine FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE publication_passage ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY publication_passage_public_reads_published ON publication_passage
  FOR SELECT TO app_public
  USING (EXISTS (SELECT 1 FROM publication p WHERE p.id = publication_id AND p.status IN ('published', 'updated')));
--> statement-breakpoint
CREATE POLICY publication_passage_staff_all ON publication_passage FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE publication_passage_evidence ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY publication_passage_evidence_public_reads_published ON publication_passage_evidence
  FOR SELECT TO app_public
  USING (
    EXISTS (
      SELECT 1 FROM publication_passage pp
      JOIN publication p ON p.id = pp.publication_id
      WHERE pp.id = passage_id AND p.status IN ('published', 'updated')
    )
    AND EXISTS (SELECT 1 FROM evidence e WHERE e.id = evidence_id AND e.data_class = 'public')
  );
--> statement-breakpoint
CREATE POLICY publication_passage_evidence_staff_all ON publication_passage_evidence FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
