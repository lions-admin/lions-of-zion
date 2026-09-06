CREATE TABLE homepage_edition (
  edition_date date NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  generated_at timestamptz NOT NULL DEFAULT now(),
  catalog_revision text NOT NULL CHECK (length(catalog_revision) > 0),
  override_revision text NOT NULL,
  reason text NOT NULL CHECK (length(reason) > 0),
  selection jsonb NOT NULL CHECK (jsonb_typeof(selection) = 'object'),
  PRIMARY KEY (edition_date, revision)
);
--> statement-breakpoint
CREATE FUNCTION homepage_edition_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Homepage editions are append-only; create a revision'; END;
$$;
--> statement-breakpoint
CREATE TRIGGER homepage_edition_no_change BEFORE UPDATE OR DELETE ON homepage_edition
FOR EACH ROW EXECUTE FUNCTION homepage_edition_immutable();
--> statement-breakpoint
ALTER TABLE homepage_edition ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON homepage_edition TO app_public, app_staff, app_service;
GRANT INSERT ON homepage_edition TO app_service;
CREATE POLICY homepage_edition_read ON homepage_edition FOR SELECT TO app_public, app_staff, app_service USING (true);
CREATE POLICY homepage_edition_write ON homepage_edition FOR INSERT TO app_service WITH CHECK (true);
