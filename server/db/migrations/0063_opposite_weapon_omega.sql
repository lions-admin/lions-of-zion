ALTER TABLE "outbox" ADD COLUMN "consumer_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "consumer_last_error" text;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "consumed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "dead_lettered_at" timestamp with time zone;--> statement-breakpoint
UPDATE "outbox" SET "consumed_at" = "published_at" WHERE "published_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "outbox_consumer_unresolved" ON "outbox" USING btree ("created_at") WHERE "outbox"."consumer_last_error" IS NOT NULL AND "outbox"."consumed_at" IS NULL;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_consumer_attempts_nonnegative" CHECK ("outbox"."consumer_attempts" >= 0);--> statement-breakpoint
GRANT DELETE ON "search_document" TO app_staff, app_service;
