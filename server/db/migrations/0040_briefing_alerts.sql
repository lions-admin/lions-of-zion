CREATE TABLE "briefing_alert" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fingerprint" text NOT NULL UNIQUE,
  "kind" text NOT NULL,
  "severity" text NOT NULL,
  "message" text NOT NULL,
  "details" jsonb,
  "notified_at" timestamptz,
  "resolved_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "briefing_alert_severity_is_known" CHECK ("severity" IN ('warning', 'critical')),
  CONSTRAINT "briefing_alert_has_kind" CHECK (length(btrim("kind")) > 0),
  CONSTRAINT "briefing_alert_has_message" CHECK (length(btrim("message")) > 0)
);
--> statement-breakpoint
CREATE INDEX "briefing_alert_open" ON "briefing_alert" ("severity", "created_at") WHERE "resolved_at" IS NULL;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "briefing_alert" TO app_staff, app_service;
--> statement-breakpoint
ALTER TABLE "briefing_alert" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "briefing_alert_staff_all" ON "briefing_alert"
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
