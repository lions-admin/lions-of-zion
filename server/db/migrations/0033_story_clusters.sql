CREATE TABLE "briefing_story_cluster" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "edition_id" uuid NOT NULL REFERENCES "briefing_edition"("id") ON DELETE cascade,
  "story_key" text NOT NULL,
  "title" text NOT NULL,
  "primary_evidence_id" uuid NOT NULL REFERENCES "evidence"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "briefing_story_cluster_unique" UNIQUE ("edition_id", "story_key"),
  CONSTRAINT "briefing_story_cluster_has_key" CHECK (length(btrim("story_key")) > 0),
  CONSTRAINT "briefing_story_cluster_has_title" CHECK (length(btrim("title")) > 0)
);
--> statement-breakpoint
CREATE INDEX "briefing_story_cluster_by_edition" ON "briefing_story_cluster" ("edition_id", "created_at");
--> statement-breakpoint
CREATE TABLE "briefing_story_evidence" (
  "cluster_id" uuid NOT NULL REFERENCES "briefing_story_cluster"("id") ON DELETE cascade,
  "evidence_id" uuid NOT NULL REFERENCES "evidence"("id"),
  "role" text NOT NULL,
  "source_family_id" uuid NOT NULL REFERENCES "source_family"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "briefing_story_evidence_pk" PRIMARY KEY ("cluster_id", "evidence_id"),
  CONSTRAINT "briefing_story_evidence_role_is_known" CHECK ("role" IN ('primary', 'independent', 'syndicated'))
);
--> statement-breakpoint
CREATE INDEX "briefing_story_evidence_by_evidence" ON "briefing_story_evidence" ("evidence_id");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON briefing_story_cluster, briefing_story_evidence TO app_staff, app_service;
--> statement-breakpoint
ALTER TABLE briefing_story_cluster ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY briefing_story_cluster_staff_all ON briefing_story_cluster
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE briefing_story_evidence ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY briefing_story_evidence_staff_all ON briefing_story_evidence
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
