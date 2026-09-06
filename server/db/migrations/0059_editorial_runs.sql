CREATE TABLE "editorial_operation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"operation_key" text NOT NULL,
	"position" integer NOT NULL,
	"input_hash" text NOT NULL,
	"input" jsonb NOT NULL,
	"stage" text DEFAULT 'media' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"artifact" jsonb,
	"result" jsonb,
	"failure" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorial_operation_position_positive" CHECK ("editorial_operation"."position" >= 0),
	CONSTRAINT "editorial_operation_status_known" CHECK ("editorial_operation"."status" IN ('pending','running','completed','failed')),
	CONSTRAINT "editorial_operation_stage_known" CHECK ("editorial_operation"."stage" IN ('research','classification','media','publication','homepage','report')),
	CONSTRAINT "editorial_operation_hash_valid" CHECK ("editorial_operation"."input_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "editorial_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"mode" text NOT NULL,
	"local_date" date NOT NULL,
	"requested_by" text NOT NULL,
	"request" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"stage" text DEFAULT 'research' NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"failure" jsonb,
	"report" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editorial_run_run_key_unique" UNIQUE("run_key"),
	CONSTRAINT "editorial_run_has_key" CHECK (length(btrim("editorial_run"."run_key")) > 0),
	CONSTRAINT "editorial_run_has_actor" CHECK (length(btrim("editorial_run"."requested_by")) > 0),
	CONSTRAINT "editorial_run_mode_known" CHECK ("editorial_run"."mode" IN ('daily','operations')),
	CONSTRAINT "editorial_run_status_known" CHECK ("editorial_run"."status" IN ('queued','running','completed','partial','failed')),
	CONSTRAINT "editorial_run_stage_known" CHECK ("editorial_run"."stage" IN ('research','classification','media','publication','homepage','report')),
	CONSTRAINT "editorial_run_hash_valid" CHECK ("editorial_run"."request_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "editorial_run_lease_paired" CHECK (("editorial_run"."lease_token" IS NULL) = ("editorial_run"."lease_until" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "editorial_operation" ADD CONSTRAINT "editorial_operation_run_id_editorial_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."editorial_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_operation_once" ON "editorial_operation" USING btree ("run_id","operation_key");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_operation_order" ON "editorial_operation" USING btree ("run_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_daily_date_once" ON "editorial_run" USING btree ("local_date") WHERE "editorial_run"."mode" = 'daily';--> statement-breakpoint
CREATE INDEX "editorial_run_pending" ON "editorial_run" USING btree ("status","lease_until");
--> statement-breakpoint
ALTER TABLE editorial_run ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON editorial_run FROM app_public;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON editorial_run TO app_staff, app_service;--> statement-breakpoint
CREATE POLICY editorial_run_staff_read ON editorial_run FOR SELECT TO app_staff, app_service USING (true);--> statement-breakpoint
CREATE POLICY editorial_run_staff_insert ON editorial_run FOR INSERT TO app_staff, app_service WITH CHECK (true);--> statement-breakpoint
CREATE POLICY editorial_run_staff_update ON editorial_run FOR UPDATE TO app_staff, app_service USING (true) WITH CHECK (true);--> statement-breakpoint
ALTER TABLE editorial_operation ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON editorial_operation FROM app_public;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON editorial_operation TO app_staff, app_service;--> statement-breakpoint
CREATE POLICY editorial_operation_staff_read ON editorial_operation FOR SELECT TO app_staff, app_service USING (true);--> statement-breakpoint
CREATE POLICY editorial_operation_staff_insert ON editorial_operation FOR INSERT TO app_staff, app_service WITH CHECK (true);--> statement-breakpoint
CREATE POLICY editorial_operation_staff_update ON editorial_operation FOR UPDATE TO app_staff, app_service USING (true) WITH CHECK (true);--> statement-breakpoint
