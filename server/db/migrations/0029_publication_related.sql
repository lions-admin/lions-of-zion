CREATE TABLE "publication_related" (
  "publication_id" uuid NOT NULL REFERENCES "publication"("id") ON DELETE cascade,
  "related_publication_id" uuid NOT NULL REFERENCES "publication"("id") ON DELETE cascade,
  "position" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "publication_related_pk" PRIMARY KEY ("publication_id", "related_publication_id"),
  CONSTRAINT "publication_related_position_unique" UNIQUE ("publication_id", "position"),
  CONSTRAINT "publication_related_not_self" CHECK ("publication_id" <> "related_publication_id"),
  CONSTRAINT "publication_related_position_positive" CHECK ("position" >= 1)
);
--> statement-breakpoint
GRANT SELECT ON publication_related TO app_public;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON publication_related TO app_staff, app_service;
--> statement-breakpoint
ALTER TABLE publication_related ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY publication_related_public_reads_published ON publication_related
  FOR SELECT TO app_public
  USING (
    EXISTS (SELECT 1 FROM publication p WHERE p.id = publication_id AND p.status IN ('published', 'updated'))
    AND EXISTS (SELECT 1 FROM publication p WHERE p.id = related_publication_id AND p.status IN ('published', 'updated'))
  );
--> statement-breakpoint
CREATE POLICY publication_related_staff_all ON publication_related
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
