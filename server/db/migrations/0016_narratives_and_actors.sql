CREATE TYPE "public"."narrative_status" AS ENUM('emerging', 'active', 'declining', 'dormant', 'retired');--> statement-breakpoint
ALTER TYPE "public"."entity_type" ADD VALUE 'narrative' BEFORE 'news_update';--> statement-breakpoint
CREATE TABLE "actor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"kind" "actor_kind" NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"country" text,
	"platform_handles" jsonb,
	"description" text,
	"data_class" "data_class" DEFAULT 'internal' NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actor_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "actor_is_named" CHECK (length(btrim("actor"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "narrative" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"language" text NOT NULL,
	"status" "narrative_status" DEFAULT 'emerging' NOT NULL,
	"primary_topic_id" uuid,
	"event_id" uuid,
	"first_seen_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"observation_count" integer DEFAULT 0 NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "narrative_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "narrative_is_titled" CHECK (length(btrim("narrative"."title")) > 0),
	CONSTRAINT "narrative_language_is_a_tag" CHECK ("narrative"."language" ~ '^[a-z]{2}(-[A-Za-z0-9-]+)*$'),
	CONSTRAINT "narrative_count_is_not_negative" CHECK ("narrative"."observation_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "narrative_item" (
	"narrative_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"rationale" text NOT NULL,
	"added_by" uuid,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "narrative_item_narrative_id_item_id_pk" PRIMARY KEY("narrative_id","item_id"),
	CONSTRAINT "narrative_item_states_why" CHECK (length(btrim("narrative_item"."rationale")) > 0),
	CONSTRAINT "narrative_item_confirmation_is_paired" CHECK (("narrative_item"."confirmed_by" IS NULL) = ("narrative_item"."confirmed_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "narrative_observation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"narrative_id" uuid NOT NULL,
	"actor_id" uuid,
	"evidence_id" uuid NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"platform" text,
	"reported_reach" integer,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "narrative_observation_confirmation_is_paired" CHECK (("narrative_observation"."confirmed_by" IS NULL) = ("narrative_observation"."confirmed_at" IS NULL)),
	CONSTRAINT "reported_reach_is_not_negative" CHECK ("narrative_observation"."reported_reach" IS NULL OR "narrative_observation"."reported_reach" >= 0)
);
--> statement-breakpoint
ALTER TABLE "actor" ADD CONSTRAINT "actor_current_version_id_entity_version_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."entity_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative" ADD CONSTRAINT "narrative_primary_topic_id_topic_id_fk" FOREIGN KEY ("primary_topic_id") REFERENCES "public"."topic"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative" ADD CONSTRAINT "narrative_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative" ADD CONSTRAINT "narrative_current_version_id_entity_version_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."entity_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_item" ADD CONSTRAINT "narrative_item_narrative_id_narrative_id_fk" FOREIGN KEY ("narrative_id") REFERENCES "public"."narrative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_item" ADD CONSTRAINT "narrative_item_item_id_information_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."information_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_item" ADD CONSTRAINT "narrative_item_added_by_app_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_item" ADD CONSTRAINT "narrative_item_confirmed_by_app_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_observation" ADD CONSTRAINT "narrative_observation_narrative_id_narrative_id_fk" FOREIGN KEY ("narrative_id") REFERENCES "public"."narrative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_observation" ADD CONSTRAINT "narrative_observation_actor_id_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_observation" ADD CONSTRAINT "narrative_observation_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narrative_observation" ADD CONSTRAINT "narrative_observation_confirmed_by_app_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actor_by_kind" ON "actor" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "actor_by_country" ON "actor" USING btree ("country");--> statement-breakpoint
CREATE INDEX "narrative_by_status" ON "narrative" USING btree ("status","last_seen_at");--> statement-breakpoint
CREATE INDEX "narrative_active" ON "narrative" USING btree ("last_seen_at") WHERE "narrative"."status" IN ('emerging','active');--> statement-breakpoint
CREATE INDEX "narrative_item_by_item" ON "narrative_item" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "narrative_observation_by_narrative" ON "narrative_observation" USING btree ("narrative_id","observed_at");--> statement-breakpoint
CREATE INDEX "narrative_observation_by_actor" ON "narrative_observation" USING btree ("actor_id","observed_at");