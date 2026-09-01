ALTER TABLE "briefing_job_delivery"
  DROP CONSTRAINT "briefing_job_delivery_status_is_known";
--> statement-breakpoint
ALTER TABLE "briefing_job_delivery"
  ADD CONSTRAINT "briefing_job_delivery_status_is_known"
  CHECK ("status" IN ('received', 'completed', 'failed', 'duplicate', 'quarantined', 'deferred'));
