ALTER TABLE "publication" ADD COLUMN "canonical_story_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "publication_canonical_story_once" ON "publication" USING btree ("canonical_story_id") WHERE "publication"."canonical_story_id" IS NOT NULL;--> statement-breakpoint

CREATE TABLE "homepage_placement" (
  "area" text NOT NULL,
  "position" text NOT NULL,
  "publication_id" uuid NOT NULL UNIQUE REFERENCES "publication"("id") ON DELETE cascade,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "homepage_placement_pk" PRIMARY KEY("area", "position"),
  CONSTRAINT "homepage_placement_area_is_valid" CHECK ("homepage_placement"."area" IN ('news', 'fakeResistance', 'people')),
  CONSTRAINT "homepage_placement_position_is_valid" CHECK ("homepage_placement"."position" IN ('lead', 'secondary'))
);--> statement-breakpoint

/* Preserve the three old lead slots only where their publication still belongs
 * to the area. A mismatched historic pin intentionally becomes automatic. */
INSERT INTO "homepage_placement" ("area", "position", "publication_id")
SELECT CASE hf.slot
         WHEN 1 THEN 'news'
         WHEN 2 THEN 'fakeResistance'
         WHEN 3 THEN 'people'
       END,
       'lead',
       hf.publication_id
FROM "homepage_feature" hf
JOIN "publication" p ON p.id = hf.publication_id
WHERE (hf.slot = 1 AND p.section IN ('daily_brief', 'israel_update', 'news'))
   OR (hf.slot = 2 AND p.section IN ('narrative_watch', 'influence_investigation', 'antisemitism'))
   OR (hf.slot = 3 AND p.section IN ('people', 'courage_service', 'innovation', 'science_medicine', 'technology_ai', 'achievement', 'international_cooperation', 'history_context'));
--> statement-breakpoint

GRANT SELECT ON homepage_placement TO app_public;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON homepage_placement TO app_staff, app_service;--> statement-breakpoint
ALTER TABLE homepage_placement ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY homepage_placement_public_reads_published ON homepage_placement
  FOR SELECT TO app_public
  USING (EXISTS (SELECT 1 FROM publication p WHERE p.id = publication_id AND p.status IN ('published', 'updated')));--> statement-breakpoint
CREATE POLICY homepage_placement_staff_all ON homepage_placement
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);--> statement-breakpoint

DROP TABLE "homepage_feature";
