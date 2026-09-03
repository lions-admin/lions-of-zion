CREATE TABLE "external_briefing_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"local_date" text NOT NULL,
	"contract_version" text NOT NULL,
	"composer" text NOT NULL,
	"package_hash" text NOT NULL,
	"briefing_run_id" uuid,
	"status" text NOT NULL,
	"evidence_created" integer DEFAULT 0 NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_briefing_submission_run_id_unique" UNIQUE("run_id"),
	CONSTRAINT "external_briefing_submission_status_is_known" CHECK ("external_briefing_submission"."status" IN ('published', 'draft')),
	CONSTRAINT "external_briefing_submission_hash_is_sha256" CHECK ("external_briefing_submission"."package_hash" IS NULL OR "external_briefing_submission"."package_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "external_briefing_submission_has_run_id" CHECK (length(btrim("external_briefing_submission"."run_id")) > 0),
	CONSTRAINT "external_briefing_submission_has_local_date" CHECK (length(btrim("external_briefing_submission"."local_date")) > 0),
	CONSTRAINT "external_briefing_submission_has_contract_version" CHECK (length(btrim("external_briefing_submission"."contract_version")) > 0),
	CONSTRAINT "external_briefing_submission_has_composer" CHECK (length(btrim("external_briefing_submission"."composer")) > 0)
);
--> statement-breakpoint
ALTER TABLE "external_briefing_submission" ADD CONSTRAINT "external_briefing_submission_briefing_run_id_briefing_run_id_fk" FOREIGN KEY ("briefing_run_id") REFERENCES "public"."briefing_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "external_briefing_submission_by_date" ON "external_briefing_submission" USING btree ("local_date","created_at");