CREATE TYPE "public"."actor_kind" AS ENUM('person', 'organization', 'state', 'outlet', 'network', 'platform_account');--> statement-breakpoint
CREATE TYPE "public"."ai_run_kind" AS ENUM('extract', 'classify', 'suggest_relation', 'summarize', 'translate', 'embed', 'chat', 'rerank');--> statement-breakpoint
CREATE TYPE "public"."assessment_value" AS ENUM('false', 'misleading', 'manipulated', 'out_of_context', 'unsupported', 'unverified', 'contested', 'satire', 'verified');--> statement-breakpoint
CREATE TYPE "public"."change_source" AS ENUM('human_edit', 'ai_suggestion_accepted', 'import', 'correction', 'migration', 'workflow');--> statement-breakpoint
CREATE TYPE "public"."confidence_level" AS ENUM('high', 'medium', 'limited', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."confidence_summary" AS ENUM('high', 'medium', 'limited');--> statement-breakpoint
CREATE TYPE "public"."data_class" AS ENUM('public', 'internal', 'confidential', 'restricted', 'secret');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('information_item', 'item_assessment', 'evidence', 'source', 'event', 'actor', 'news_update', 'brief', 'geopolitical_analysis', 'scenario', 'translation', 'report');--> statement-breakpoint
CREATE TYPE "public"."evidence_kind" AS ENUM('document', 'article', 'image', 'video', 'audio', 'dataset', 'satellite', 'testimony', 'official_record', 'social_post');--> statement-breakpoint
CREATE TYPE "public"."evidence_relation" AS ENUM('supports', 'partially_supports', 'contradicts', 'contextualizes');--> statement-breakpoint
CREATE TYPE "public"."evidence_strength" AS ENUM('strong', 'adequate', 'weak', 'contextual');--> statement-breakpoint
CREATE TYPE "public"."information_item_type" AS ENUM('claim', 'narrative', 'media_asset', 'statement', 'incident_report', 'official_record', 'campaign');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('detected', 'under_review', 'reviewed', 'edited', 'approved', 'published', 'updated', 'archived', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."likelihood_band" AS ENUM('remote', 'unlikely', 'even', 'likely', 'near_certain');--> statement-breakpoint
CREATE TYPE "public"."queue_state" AS ENUM('open', 'claimed', 'blocked', 'done', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('rss', 'api', 'scraper', 'telegram', 'x', 'youtube', 'manual', 'partner', 'archive');--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"email" text,
	"display_name" text NOT NULL,
	"is_automated" boolean DEFAULT false NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "app_user_email_unique" UNIQUE("email"),
	CONSTRAINT "app_user_display_name_is_named" CHECK (length(btrim("app_user"."display_name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "capability_grant" (
	"user_id" uuid NOT NULL,
	"capability" text NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rationale" text NOT NULL,
	CONSTRAINT "capability_grant_user_id_capability_pk" PRIMARY KEY("user_id","capability"),
	CONSTRAINT "capability_grant_states_why" CHECK (length(btrim("capability_grant"."rationale")) > 0)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"actor_label" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid,
	"before_state" jsonb,
	"after_state" jsonb,
	"request_id" text,
	"ip" "inet",
	"user_agent" text,
	CONSTRAINT "audit_log_names_an_actor" CHECK (length(btrim("audit_log"."actor_label")) > 0),
	CONSTRAINT "audit_log_names_an_action" CHECK (length(btrim("audit_log"."action")) > 0)
);
--> statement-breakpoint
CREATE TABLE "entity_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"previous_version_id" uuid,
	"snapshot" jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"change_summary" text NOT NULL,
	"change_source" "change_source" NOT NULL,
	"changed_by" uuid,
	"changed_by_label" text NOT NULL,
	"ai_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" text NOT NULL,
	CONSTRAINT "entity_version_number_is_positive" CHECK ("entity_version"."version_number" >= 1),
	CONSTRAINT "entity_version_states_what_changed" CHECK (length(btrim("entity_version"."change_summary")) > 0),
	CONSTRAINT "entity_version_names_who_changed_it" CHECK (length(btrim("entity_version"."changed_by_label")) > 0),
	CONSTRAINT "ai_change_names_its_run" CHECK ("entity_version"."change_source" <> 'ai_suggestion_accepted' OR "entity_version"."ai_run_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "idempotency_key" (
	"key" text PRIMARY KEY NOT NULL,
	"route" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb,
	"status_code" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"topic" text NOT NULL,
	"payload" jsonb NOT NULL,
	"entity_type" "entity_type",
	"entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "outbox_names_a_topic" CHECK (length(btrim("outbox"."topic")) > 0)
);
--> statement-breakpoint
ALTER TABLE "capability_grant" ADD CONSTRAINT "capability_grant_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_grant" ADD CONSTRAINT "capability_grant_granted_by_app_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_app_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_version" ADD CONSTRAINT "entity_version_previous_version_id_entity_version_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "public"."entity_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_version" ADD CONSTRAINT "entity_version_changed_by_app_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capability_grant_by_capability" ON "capability_grant" USING btree ("capability");--> statement-breakpoint
CREATE INDEX "audit_log_by_entity" ON "audit_log" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_by_actor" ON "audit_log" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_version_is_sequential" ON "entity_version" USING btree ("entity_type","entity_id","version_number");--> statement-breakpoint
CREATE INDEX "entity_version_by_entity" ON "entity_version" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "idempotency_key_expiry" ON "idempotency_key" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "outbox_pending" ON "outbox" USING btree ("available_at") WHERE "outbox"."published_at" IS NULL;