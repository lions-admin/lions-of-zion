-- Narrative tables were created after the baseline role grants. Give the
-- application roles explicit access, then expose to anonymous readers only
-- narratives that are attached to a live publication. Internal monitoring
-- rows, observations, actors and item links remain private.

GRANT SELECT, INSERT, UPDATE, DELETE ON
  narrative, narrative_item, narrative_observation, actor
TO app_staff, app_service;
--> statement-breakpoint

GRANT SELECT ON narrative TO app_public;
--> statement-breakpoint

ALTER TABLE narrative ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY narrative_public_reads_published_links ON narrative
  FOR SELECT TO app_public
  USING (
    EXISTS (
      SELECT 1
      FROM publication_narrative pn
      JOIN publication p ON p.id = pn.publication_id
      WHERE pn.narrative_id = narrative.id
        AND p.status IN ('published', 'updated')
    )
  );
--> statement-breakpoint
CREATE POLICY narrative_staff_all ON narrative
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE narrative_item ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY narrative_item_staff_all ON narrative_item
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE narrative_observation ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY narrative_observation_staff_all ON narrative_observation
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE actor ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY actor_staff_all ON actor
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
