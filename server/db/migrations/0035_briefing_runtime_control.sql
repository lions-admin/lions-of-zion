CREATE TABLE "briefing_control" (
  "id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
  "automatic_publication_paused" boolean DEFAULT true NOT NULL,
  "updated_by" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "briefing_control_singleton" CHECK ("id" = 'global')
);
--> statement-breakpoint
INSERT INTO "briefing_control" ("id", "automatic_publication_paused")
VALUES ('global', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "briefing_control" TO app_staff, app_service;
--> statement-breakpoint
ALTER TABLE "briefing_control" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY briefing_control_staff_all ON briefing_control
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
