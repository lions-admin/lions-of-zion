CREATE TYPE "public"."fetch_status" AS ENUM('success', 'partial', 'failed');--> statement-breakpoint
CREATE TABLE "source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_family_id" uuid NOT NULL,
	"kind" "source_kind" NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"homepage_url" text,
	"feed_url" text,
	"language" text NOT NULL,
	"country" text,
	"active" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_slug_unique" UNIQUE("slug"),
	CONSTRAINT "source_is_named" CHECK (length(btrim("source"."name")) > 0),
	CONSTRAINT "source_language_is_a_tag" CHECK ("source"."language" ~ '^[a-z]{2}(-[A-Za-z0-9-]+)*$'),
	CONSTRAINT "polled_sources_have_a_feed_url" CHECK ("source"."kind" NOT IN ('rss', 'api') OR "source"."feed_url" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "source_family" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_family_slug_unique" UNIQUE("slug"),
	CONSTRAINT "source_family_is_labelled" CHECK (length(btrim("source_family"."label")) > 0)
);
--> statement-breakpoint
CREATE TABLE "source_fetch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "fetch_status" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"http_status" integer,
	"items_seen" integer DEFAULT 0 NOT NULL,
	"items_new" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"raw_blob_url" text,
	"raw_content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_fetch_raw_hash_is_sha256" CHECK ("source_fetch"."raw_content_hash" IS NULL OR "source_fetch"."raw_content_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "failed_fetch_states_why" CHECK ("source_fetch"."status" <> 'failed' OR length(btrim(coalesce("source_fetch"."error_message", ''))) > 0)
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"source_fetch_id" uuid,
	"kind" "evidence_kind" NOT NULL,
	"data_class" "data_class" DEFAULT 'public' NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"external_id" text,
	"url" text,
	"blob_url" text,
	"language" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"integrity_hash" text,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_is_titled" CHECK (length(btrim("evidence"."title")) > 0),
	CONSTRAINT "evidence_language_is_a_tag" CHECK ("evidence"."language" ~ '^[a-z]{2}(-[A-Za-z0-9-]+)*$'),
	CONSTRAINT "evidence_integrity_hash_is_sha256" CHECK ("evidence"."integrity_hash" IS NULL OR "evidence"."integrity_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "restricted_material_is_not_linked" CHECK ("evidence"."data_class" NOT IN ('restricted', 'secret')
          OR ("evidence"."url" IS NULL AND "evidence"."blob_url" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "evidence_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"actor_user_id" uuid,
	"actor_label" text NOT NULL,
	"detail" jsonb,
	"integrity_hash" text,
	CONSTRAINT "evidence_provenance_names_an_action" CHECK (length(btrim("evidence_provenance"."action")) > 0),
	CONSTRAINT "evidence_provenance_names_an_actor" CHECK (length(btrim("evidence_provenance"."actor_label")) > 0),
	CONSTRAINT "evidence_provenance_hash_is_sha256" CHECK ("evidence_provenance"."integrity_hash" IS NULL OR "evidence_provenance"."integrity_hash" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_source_family_id_source_family_id_fk" FOREIGN KEY ("source_family_id") REFERENCES "public"."source_family"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_current_version_id_entity_version_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."entity_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_fetch" ADD CONSTRAINT "source_fetch_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_source_fetch_id_source_fetch_id_fk" FOREIGN KEY ("source_fetch_id") REFERENCES "public"."source_fetch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_current_version_id_entity_version_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."entity_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_provenance" ADD CONSTRAINT "evidence_provenance_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_provenance" ADD CONSTRAINT "evidence_provenance_actor_user_id_app_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_by_family" ON "source" USING btree ("source_family_id");--> statement-breakpoint
CREATE INDEX "source_by_kind_active" ON "source" USING btree ("kind","active");--> statement-breakpoint
CREATE INDEX "source_fetch_by_source" ON "source_fetch" USING btree ("source_id","started_at");--> statement-breakpoint
CREATE INDEX "evidence_by_source" ON "evidence" USING btree ("source_id","captured_at");--> statement-breakpoint
CREATE INDEX "evidence_by_captured_at" ON "evidence" USING btree ("captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_dedup_by_source" ON "evidence" USING btree ("source_id","external_id") WHERE "evidence"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "evidence_provenance_by_evidence" ON "evidence_provenance" USING btree ("evidence_id","created_at");