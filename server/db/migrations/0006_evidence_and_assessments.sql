CREATE TABLE "item_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"value" "assessment_value" NOT NULL,
	"summary" text NOT NULL,
	"known_gaps" text NOT NULL,
	"false_impression" text,
	"confidence_evidence_coverage" "confidence_level" NOT NULL,
	"confidence_source_independence" "confidence_level" NOT NULL,
	"confidence_source_authority" "confidence_level" NOT NULL,
	"confidence_media_provenance" "confidence_level" NOT NULL,
	"confidence_temporal_consistency" "confidence_level" NOT NULL,
	"confidence_geographic_consistency" "confidence_level" NOT NULL,
	"confidence_contradiction_level" "confidence_level" NOT NULL,
	"confidence_translation_certainty" "confidence_level" NOT NULL,
	"confidence_human_review_state" "confidence_level" NOT NULL,
	"confidence_remaining_gaps" "confidence_level" NOT NULL,
	"confidence_summary" "confidence_summary" NOT NULL,
	"review_level" integer DEFAULT 1 NOT NULL,
	"eligibility" jsonb NOT NULL,
	"superseded_by_assessment_id" uuid,
	"created_by" uuid,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_assessment_has_a_summary" CHECK (length(btrim("item_assessment"."summary")) > 0),
	CONSTRAINT "item_assessment_states_its_gaps" CHECK (length(btrim("item_assessment"."known_gaps")) > 0),
	CONSTRAINT "item_assessment_review_level_is_1_or_2" CHECK ("item_assessment"."review_level" IN (1, 2)),
	CONSTRAINT "manipulated_requires_elevated_review" CHECK ("item_assessment"."value" <> 'manipulated' OR "item_assessment"."review_level" >= 2),
	CONSTRAINT "misleading_states_the_false_impression" CHECK ("item_assessment"."value" <> 'misleading'
          OR length(btrim(coalesce("item_assessment"."false_impression", ''))) > 0)
);
--> statement-breakpoint
CREATE TABLE "item_evidence" (
	"item_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"relation" "evidence_relation" NOT NULL,
	"ai_relation" "evidence_relation",
	"strength" "evidence_strength" NOT NULL,
	"rationale" text NOT NULL,
	"added_by" uuid,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_evidence_item_id_evidence_id_pk" PRIMARY KEY("item_id","evidence_id"),
	CONSTRAINT "item_evidence_states_why" CHECK (length(btrim("item_evidence"."rationale")) > 0),
	CONSTRAINT "item_evidence_confirmation_is_paired" CHECK (("item_evidence"."confirmed_by" IS NULL) = ("item_evidence"."confirmed_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "review_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"state" "queue_state" DEFAULT 'open' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"claimed_by" uuid,
	"claimed_at" timestamp with time zone,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_queue_names_a_kind" CHECK (length(btrim("review_queue"."kind")) > 0),
	CONSTRAINT "claimed_queue_entry_has_a_claimant" CHECK ("review_queue"."state" <> 'claimed' OR "review_queue"."claimed_by" IS NOT NULL),
	CONSTRAINT "resolved_queue_entry_is_attributed" CHECK ("review_queue"."state" NOT IN ('done', 'dropped')
          OR ("review_queue"."completed_by" IS NOT NULL AND "review_queue"."completed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "item_assessment" ADD CONSTRAINT "item_assessment_item_id_information_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."information_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_assessment" ADD CONSTRAINT "item_assessment_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_assessment" ADD CONSTRAINT "item_assessment_approved_by_app_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_evidence" ADD CONSTRAINT "item_evidence_item_id_information_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."information_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_evidence" ADD CONSTRAINT "item_evidence_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_evidence" ADD CONSTRAINT "item_evidence_added_by_app_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_evidence" ADD CONSTRAINT "item_evidence_confirmed_by_app_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_item_id_information_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."information_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_claimed_by_app_user_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_completed_by_app_user_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_assessment_by_item" ON "item_assessment" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "item_assessment_one_current_per_item" ON "item_assessment" USING btree ("item_id") WHERE "item_assessment"."superseded_by_assessment_id" IS NULL;--> statement-breakpoint
CREATE INDEX "item_evidence_by_evidence" ON "item_evidence" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "review_queue_by_state" ON "review_queue" USING btree ("state","priority","created_at");--> statement-breakpoint
CREATE INDEX "review_queue_by_item" ON "review_queue" USING btree ("item_id");--> statement-breakpoint
ALTER TABLE "information_item" ADD CONSTRAINT "information_item_current_assessment_id_item_assessment_id_fk" FOREIGN KEY ("current_assessment_id") REFERENCES "public"."item_assessment"("id") ON DELETE no action ON UPDATE no action;