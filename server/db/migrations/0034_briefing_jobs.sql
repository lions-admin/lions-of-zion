CREATE TABLE "briefing_job" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_key" text NOT NULL UNIQUE,
  "contract_version" integer DEFAULT 1 NOT NULL,
  "stage" text NOT NULL,
  "local_date" text NOT NULL,
  "source_id" uuid REFERENCES "source"("id") ON DELETE cascade,
  "edition_id" uuid REFERENCES "briefing_edition"("id") ON DELETE cascade,
  "state" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "available_at" timestamp with time zone DEFAULT now() NOT NULL,
  "lease_until" timestamp with time zone,
  "heartbeat_at" timestamp with time zone,
  "checkpoint" jsonb,
  "last_error" text,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "briefing_job_stage_is_known" CHECK ("stage" IN ('collect', 'enrich', 'cluster', 'triage', 'draft', 'quality', 'publish')),
  CONSTRAINT "briefing_job_state_is_known" CHECK ("state" IN ('pending', 'running', 'completed', 'quarantined')),
  CONSTRAINT "briefing_job_attempts_are_valid" CHECK ("attempts" >= 0 AND "max_attempts" BETWEEN 1 AND 20),
  CONSTRAINT "briefing_job_has_key" CHECK (length(btrim("job_key")) > 0)
);
--> statement-breakpoint
CREATE INDEX "briefing_job_ready" ON "briefing_job" ("state", "available_at");
--> statement-breakpoint
CREATE INDEX "briefing_job_by_stage_date" ON "briefing_job" ("stage", "local_date", "state");
--> statement-breakpoint
CREATE INDEX "briefing_job_stale_lease" ON "briefing_job" ("lease_until") WHERE "state" = 'running';
--> statement-breakpoint
CREATE TABLE "briefing_job_delivery" (
  "message_id" text PRIMARY KEY,
  "job_id" uuid NOT NULL REFERENCES "briefing_job"("id") ON DELETE cascade,
  "delivery_count" integer NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "finished_at" timestamp with time zone,
  CONSTRAINT "briefing_job_delivery_status_is_known" CHECK ("status" IN ('received', 'completed', 'failed', 'duplicate', 'quarantined')),
  CONSTRAINT "briefing_job_delivery_count_positive" CHECK ("delivery_count" >= 1)
);
--> statement-breakpoint
CREATE INDEX "briefing_job_delivery_by_job" ON "briefing_job_delivery" ("job_id", "created_at");
--> statement-breakpoint
CREATE TABLE "briefing_stage_artifact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL REFERENCES "briefing_edition"("id") ON DELETE cascade,
  "stage" text NOT NULL,
  "artifact_version" integer DEFAULT 1 NOT NULL,
  "input_hash" text NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "briefing_stage_artifact_unique" UNIQUE ("edition_id", "stage", "artifact_version"),
  CONSTRAINT "briefing_stage_artifact_stage_is_known" CHECK ("stage" IN ('enrich', 'cluster', 'triage', 'draft', 'quality')),
  CONSTRAINT "briefing_stage_artifact_version_positive" CHECK ("artifact_version" >= 1),
  CONSTRAINT "briefing_stage_artifact_has_input_hash" CHECK (length(btrim("input_hash")) > 0)
);
--> statement-breakpoint
CREATE INDEX "briefing_stage_artifact_by_edition" ON "briefing_stage_artifact" ("edition_id", "created_at");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON briefing_job, briefing_job_delivery, briefing_stage_artifact TO app_staff, app_service;
--> statement-breakpoint
ALTER TABLE briefing_job ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY briefing_job_staff_all ON briefing_job FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE briefing_job_delivery ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY briefing_job_delivery_staff_all ON briefing_job_delivery FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE briefing_stage_artifact ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY briefing_stage_artifact_staff_all ON briefing_stage_artifact FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
