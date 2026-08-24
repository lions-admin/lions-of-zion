CREATE TABLE "ai_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "ai_run_kind" NOT NULL,
	"model" text NOT NULL,
	"model_profile" text NOT NULL,
	"prompt_id" uuid,
	"subject_type" "entity_type",
	"subject_id" uuid,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(12, 6),
	"latency_ms" integer,
	"status" text NOT NULL,
	"error_code" text,
	"input_hash" text,
	"input_data_class" "data_class" DEFAULT 'public' NOT NULL,
	"actor_label" text NOT NULL,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_run_names_a_model" CHECK (length(btrim("ai_run"."model")) > 0),
	CONSTRAINT "ai_run_has_a_status" CHECK (length(btrim("ai_run"."status")) > 0),
	CONSTRAINT "ai_run_names_an_actor" CHECK (length(btrim("ai_run"."actor_label")) > 0),
	CONSTRAINT "ai_run_input_hash_is_sha256" CHECK ("ai_run"."input_hash" IS NULL OR "ai_run"."input_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "ai_run_cost_is_not_negative" CHECK ("ai_run"."cost_usd" IS NULL OR "ai_run"."cost_usd" >= 0),
	CONSTRAINT "restricted_data_never_reaches_a_model" CHECK ("ai_run"."input_data_class" NOT IN ('restricted', 'secret'))
);
--> statement-breakpoint
CREATE TABLE "ai_suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_run_id" uuid NOT NULL,
	"subject_type" "entity_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"field" text NOT NULL,
	"proposed" jsonb NOT NULL,
	"baseline" jsonb,
	"rationale" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_suggestion_names_a_field" CHECK (length(btrim("ai_suggestion"."field")) > 0),
	CONSTRAINT "ai_suggestion_states_its_reasoning" CHECK (length(btrim("ai_suggestion"."rationale")) > 0),
	CONSTRAINT "ai_suggestion_status_is_known" CHECK ("ai_suggestion"."status" IN ('pending', 'accepted', 'rejected', 'superseded')),
	CONSTRAINT "human_decision_is_attributed" CHECK ("ai_suggestion"."status" NOT IN ('accepted', 'rejected')
          OR ("ai_suggestion"."decided_by" IS NOT NULL AND "ai_suggestion"."decided_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "prompt_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"version" integer NOT NULL,
	"kind" "ai_run_kind" NOT NULL,
	"template" text NOT NULL,
	"model_profile" text NOT NULL,
	"notes" text,
	"activated_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_registry_version_is_positive" CHECK ("prompt_registry"."version" >= 1),
	CONSTRAINT "prompt_registry_has_a_template" CHECK (length(btrim("prompt_registry"."template")) > 0),
	CONSTRAINT "prompt_registry_has_a_slug" CHECK (length(btrim("prompt_registry"."slug")) > 0)
);
--> statement-breakpoint
CREATE TABLE "translation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "entity_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"field" text NOT NULL,
	"language" text NOT NULL,
	"content" text NOT NULL,
	"source_content_hash" text NOT NULL,
	"ai_run_id" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "translation_has_content" CHECK (length(btrim("translation"."content")) > 0),
	CONSTRAINT "translation_records_its_source_hash" CHECK (length(btrim("translation"."source_content_hash")) > 0),
	CONSTRAINT "translation_language_is_a_tag" CHECK ("translation"."language" ~ '^[a-z]{2}(-[A-Za-z0-9-]+)*$'),
	CONSTRAINT "reviewed_translation_is_attributed" CHECK (("translation"."reviewed_by" IS NULL) = ("translation"."reviewed_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_prompt_id_prompt_registry_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompt_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_actor_user_id_app_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestion" ADD CONSTRAINT "ai_suggestion_ai_run_id_ai_run_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestion" ADD CONSTRAINT "ai_suggestion_decided_by_app_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_registry" ADD CONSTRAINT "prompt_registry_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation" ADD CONSTRAINT "translation_ai_run_id_ai_run_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation" ADD CONSTRAINT "translation_reviewed_by_app_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_run_by_subject" ON "ai_run" USING btree ("subject_type","subject_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_run_by_time" ON "ai_run" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_suggestion_by_subject" ON "ai_suggestion" USING btree ("subject_type","subject_id","status");--> statement-breakpoint
CREATE INDEX "ai_suggestion_pending" ON "ai_suggestion" USING btree ("created_at") WHERE "ai_suggestion"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_registry_version_is_unique" ON "prompt_registry" USING btree ("slug","version");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_registry_one_active_per_slug" ON "prompt_registry" USING btree ("slug") WHERE "prompt_registry"."activated_at" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "translation_is_one_per_field_and_language" ON "translation" USING btree ("subject_type","subject_id","field","language");--> statement-breakpoint
ALTER TABLE "entity_version" ADD CONSTRAINT "entity_version_ai_run_id_ai_run_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_run"("id") ON DELETE no action ON UPDATE no action;