CREATE TYPE "public"."publication_kind" AS ENUM('news_update', 'brief', 'geopolitical_analysis', 'scenario');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('draft', 'under_review', 'approved', 'published', 'updated', 'archived');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('received', 'triaged', 'investigating', 'linked_to_existing_item', 'converted_to_item', 'closed', 'rejected');--> statement-breakpoint
CREATE TABLE "publication" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "publication_kind" NOT NULL,
	"public_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body" text NOT NULL,
	"language" text NOT NULL,
	"status" "publication_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"event_id" uuid,
	"primary_topic_id" uuid,
	"scenario_likelihood" "likelihood_band",
	"scenario_indicators" text,
	"created_by" uuid,
	"approved_by" uuid,
	"current_version_id" uuid,
	"content_hash" text GENERATED ALWAYS AS (md5(title || E'
' || body || E'
' || coalesce(summary, ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "publication_is_titled" CHECK (length(btrim("publication"."title")) > 0),
	CONSTRAINT "publication_has_a_body" CHECK (length(btrim("publication"."body")) > 0),
	CONSTRAINT "publication_language_is_a_tag" CHECK ("publication"."language" ~ '^[a-z]{2}(-[A-Za-z0-9-]+)*$'),
	CONSTRAINT "published_publication_has_timestamp_and_approver" CHECK ("publication"."status" NOT IN ('published', 'updated')
          OR ("publication"."approved_by" IS NOT NULL AND "publication"."published_at" IS NOT NULL)),
	CONSTRAINT "only_scenarios_state_a_likelihood" CHECK (("publication"."kind" = 'scenario') = ("publication"."scenario_likelihood" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "publication_item" (
	"publication_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"bucket" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_bucket_window_start_pk" PRIMARY KEY("bucket","window_start"),
	CONSTRAINT "rate_limit_has_a_bucket" CHECK (length(btrim("rate_limit"."bucket")) > 0)
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"url" text,
	"body" text,
	"reporter_email" text,
	"reporter_note" text,
	"status" "report_status" DEFAULT 'received' NOT NULL,
	"resolution_note" text,
	"item_id" uuid,
	"assigned_to" uuid,
	"data_class" "data_class" DEFAULT 'internal' NOT NULL,
	"submitted_from_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "report_submitter_hash_is_sha256" CHECK ("report"."submitted_from_hash" IS NULL OR "report"."submitted_from_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "report_says_something" CHECK ("report"."url" IS NOT NULL OR length(btrim(coalesce("report"."body", ''))) > 0),
	CONSTRAINT "resolved_report_states_why" CHECK ("report"."status" NOT IN ('closed', 'rejected')
          OR length(btrim(coalesce("report"."resolution_note", ''))) > 0),
	CONSTRAINT "converted_report_names_its_item" CHECK ("report"."status" NOT IN ('linked_to_existing_item', 'converted_to_item')
          OR "report"."item_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "report_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"blob_url" text NOT NULL,
	"declared_content_type" text,
	"byte_size" integer,
	"integrity_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_file_has_a_blob_url" CHECK (length(btrim("report_file"."blob_url")) > 0),
	CONSTRAINT "report_file_hash_is_sha256" CHECK ("report_file"."integrity_hash" IS NULL OR "report_file"."integrity_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "report_file_size_is_sane" CHECK ("report_file"."byte_size" IS NULL OR "report_file"."byte_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "report_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"from_status" "report_status",
	"to_status" "report_status" NOT NULL,
	"actor_user_id" uuid,
	"actor_label" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_status_history_names_an_actor" CHECK (length(btrim("report_status_history"."actor_label")) > 0)
);
--> statement-breakpoint
ALTER TABLE "publication" ADD CONSTRAINT "publication_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication" ADD CONSTRAINT "publication_primary_topic_id_topic_id_fk" FOREIGN KEY ("primary_topic_id") REFERENCES "public"."topic"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication" ADD CONSTRAINT "publication_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication" ADD CONSTRAINT "publication_approved_by_app_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication" ADD CONSTRAINT "publication_current_version_id_entity_version_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."entity_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_item" ADD CONSTRAINT "publication_item_publication_id_publication_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publication"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_item" ADD CONSTRAINT "publication_item_item_id_information_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."information_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_item_id_information_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."information_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_assigned_to_app_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_file" ADD CONSTRAINT "report_file_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_status_history" ADD CONSTRAINT "report_status_history_report_id_report_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."report"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_status_history" ADD CONSTRAINT "report_status_history_actor_user_id_app_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "publication_by_kind_status" ON "publication" USING btree ("kind","status","created_at");--> statement-breakpoint
CREATE INDEX "publication_live" ON "publication" USING btree ("published_at") WHERE "publication"."published_at" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "publication_item_is_unique" ON "publication_item" USING btree ("publication_id","item_id");--> statement-breakpoint
CREATE INDEX "publication_item_by_item" ON "publication_item" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "rate_limit_window" ON "rate_limit" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "report_by_status" ON "report" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "report_by_item" ON "report" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "report_file_by_report" ON "report_file" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "report_status_history_by_report" ON "report_status_history" USING btree ("report_id","created_at");