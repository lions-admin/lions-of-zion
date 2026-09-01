CREATE TABLE "evidence_discovery" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_fetch_id" uuid NOT NULL REFERENCES "source_fetch"("id") ON DELETE cascade,
  "discovery_source_id" uuid NOT NULL REFERENCES "source"("id"),
  "evidence_id" uuid NOT NULL REFERENCES "evidence"("id") ON DELETE cascade,
  "external_id" text,
  "discovery_url" text,
  "canonical_url" text,
  "publisher_domain" text,
  "title" text NOT NULL,
  "normalized_content_hash" text,
  "deduplication_method" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "evidence_discovery_method_is_known" CHECK ("deduplication_method" IN ('new', 'external_id', 'canonical_url', 'content_hash')),
  CONSTRAINT "evidence_discovery_has_title" CHECK (length(btrim("title")) > 0)
);
--> statement-breakpoint
CREATE INDEX "evidence_discovery_by_evidence" ON "evidence_discovery" ("evidence_id", "created_at");
--> statement-breakpoint
CREATE INDEX "evidence_discovery_by_fetch" ON "evidence_discovery" ("source_fetch_id");
--> statement-breakpoint
CREATE INDEX "evidence_discovery_by_hash" ON "evidence_discovery" ("normalized_content_hash");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON evidence_discovery TO app_staff, app_service;
--> statement-breakpoint
ALTER TABLE evidence_discovery ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY evidence_discovery_staff_all ON evidence_discovery
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
