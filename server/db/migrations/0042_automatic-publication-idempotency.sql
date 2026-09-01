ALTER TABLE "publication" DROP CONSTRAINT "automatic_publication_has_quality_provenance";--> statement-breakpoint
ALTER TABLE "briefing_job_delivery" DROP CONSTRAINT "briefing_job_delivery_status_is_known";--> statement-breakpoint
ALTER TABLE "publication" ADD COLUMN "briefing_candidate_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "publication_automatic_candidate_once" ON "publication" USING btree ("briefing_run_id","briefing_candidate_key") WHERE "publication"."briefing_run_id" IS NOT NULL AND "publication"."briefing_candidate_key" IS NOT NULL;--> statement-breakpoint
-- Legacy automated publications predate the candidate-key contract. Keep their
-- public provenance intact while giving each one a deterministic idempotency key.
UPDATE "publication"
SET "briefing_candidate_key" = 'legacy:' || "public_id"
WHERE "auto_published_at" IS NOT NULL
  AND nullif(btrim(coalesce("briefing_candidate_key", '')), '') IS NULL;--> statement-breakpoint
ALTER TABLE "publication" ADD CONSTRAINT "automatic_publication_has_quality_provenance" CHECK ("publication"."auto_published_at" IS NULL OR (
        "publication"."quality_approved_at" IS NOT NULL
        AND "publication"."briefing_run_id" IS NOT NULL
        AND length(btrim(coalesce("publication"."briefing_candidate_key", ''))) > 0
        AND length(btrim(coalesce("publication"."machine_author", ''))) > 0
      ));--> statement-breakpoint
ALTER TABLE "briefing_job_delivery" ADD CONSTRAINT "briefing_job_delivery_status_is_known" CHECK ("briefing_job_delivery"."status" IN ('received', 'completed', 'failed', 'duplicate', 'quarantined', 'deferred'));
