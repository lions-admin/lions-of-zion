CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"event_type" text,
	"occurred_at" timestamp with time zone,
	"occurred_until" timestamp with time zone,
	"location_text" text,
	"country" text,
	"lat" double precision,
	"lon" double precision,
	"parent_event_id" uuid,
	"language" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_slug_unique" UNIQUE("slug"),
	CONSTRAINT "event_is_titled" CHECK (length(btrim("event"."title")) > 0),
	CONSTRAINT "event_language_is_a_tag" CHECK ("event"."language" ~ '^[a-z]{2}(-[A-Za-z0-9-]+)*$')
);
--> statement-breakpoint
CREATE TABLE "topic" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"parent_topic_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_slug_unique" UNIQUE("slug"),
	CONSTRAINT "topic_is_labelled" CHECK (length(btrim("topic"."label")) > 0)
);
--> statement-breakpoint
CREATE TABLE "information_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text NOT NULL,
	"type" "information_item_type" NOT NULL,
	"title" text NOT NULL,
	"canonical_text" text NOT NULL,
	"summary" text,
	"language" text NOT NULL,
	"status" "item_status" DEFAULT 'detected' NOT NULL,
	"status_reason" text,
	"assessment" "assessment_value",
	"confidence_summary" "confidence_summary",
	"current_assessment_id" uuid,
	"current_version_id" uuid,
	"first_detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"event_id" uuid,
	"primary_topic_id" uuid,
	"created_by" uuid,
	"approved_by" uuid,
	"content_hash" text GENERATED ALWAYS AS (md5(title || E'
' || canonical_text || E'
' || coalesce(summary, ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "information_item_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "information_item_is_titled" CHECK (length(btrim("information_item"."title")) > 0),
	CONSTRAINT "information_item_has_canonical_text" CHECK (length(btrim("information_item"."canonical_text")) > 0),
	CONSTRAINT "information_item_language_is_a_tag" CHECK ("information_item"."language" ~ '^[a-z]{2}(-[A-Za-z0-9-]+)*$'),
	CONSTRAINT "published_has_timestamp_and_approver" CHECK ("information_item"."status" NOT IN ('published', 'updated')
          OR ("information_item"."approved_by" IS NOT NULL
              AND "information_item"."published_at" IS NOT NULL
              AND "information_item"."assessment" IS NOT NULL)),
	CONSTRAINT "rejected_states_why" CHECK ("information_item"."status" <> 'rejected' OR length(btrim(coalesce("information_item"."status_reason", ''))) > 0)
);
--> statement-breakpoint
CREATE TABLE "information_item_topic" (
	"item_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	CONSTRAINT "information_item_topic_item_id_topic_id_pk" PRIMARY KEY("item_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "item_status_transition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"from_status" "item_status",
	"to_status" "item_status" NOT NULL,
	"actor_user_id" uuid,
	"actor_label" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_status_transition_names_an_actor" CHECK (length(btrim("item_status_transition"."actor_label")) > 0)
);
--> statement-breakpoint
CREATE TABLE "status_transition" (
	"from_status" "item_status" NOT NULL,
	"to_status" "item_status" NOT NULL,
	"requires_capability" text,
	CONSTRAINT "status_transition_from_status_to_status_pk" PRIMARY KEY("from_status","to_status")
);
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_parent_event_id_event_id_fk" FOREIGN KEY ("parent_event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_parent_topic_id_topic_id_fk" FOREIGN KEY ("parent_topic_id") REFERENCES "public"."topic"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_item" ADD CONSTRAINT "information_item_current_version_id_entity_version_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."entity_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_item" ADD CONSTRAINT "information_item_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_item" ADD CONSTRAINT "information_item_primary_topic_id_topic_id_fk" FOREIGN KEY ("primary_topic_id") REFERENCES "public"."topic"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_item" ADD CONSTRAINT "information_item_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_item" ADD CONSTRAINT "information_item_approved_by_app_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_item_topic" ADD CONSTRAINT "information_item_topic_item_id_information_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."information_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "information_item_topic" ADD CONSTRAINT "information_item_topic_topic_id_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topic"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_status_transition" ADD CONSTRAINT "item_status_transition_item_id_information_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."information_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_status_transition" ADD CONSTRAINT "item_status_transition_actor_user_id_app_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_by_time" ON "event" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "event_by_country" ON "event" USING btree ("country");--> statement-breakpoint
CREATE INDEX "information_item_by_status" ON "information_item" USING btree ("status","first_detected_at");--> statement-breakpoint
CREATE INDEX "information_item_by_event" ON "information_item" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "information_item_published" ON "information_item" USING btree ("published_at") WHERE "information_item"."published_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "information_item_topic_by_topic" ON "information_item_topic" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "item_status_transition_by_item" ON "item_status_transition" USING btree ("item_id","created_at");