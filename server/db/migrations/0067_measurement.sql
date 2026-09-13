-- First-party browsing measurement (visitor warehouse).
--
-- Append-only event facts for public browsing. Not a legal identity store:
-- visitor_id is a stable client-generated opaque id (localStorage), never an
-- email or account. Unknown traffic source stays "unknown" — never coerced to
-- "direct". Geo comes only from Vercel request headers when present.
--
-- Active presence = heartbeat within 60 seconds while the page was visible
-- (documented in docs/measurement.md).

CREATE TABLE measurement_visitors (
  visitor_id text PRIMARY KEY NOT NULL,
  first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  visit_count integer DEFAULT 1 NOT NULL,
  CONSTRAINT "measurement_visitors_has_id" CHECK (length(btrim("measurement_visitors"."visitor_id")) > 0),
  CONSTRAINT "measurement_visitors_visit_count_nonnegative" CHECK ("measurement_visitors"."visit_count" >= 0)
);
--> statement-breakpoint
COMMENT ON TABLE measurement_visitors IS 'Opaque client visitor ids for measurement — not a legal identity.';
--> statement-breakpoint

CREATE TABLE measurement_visits (
  visit_id text PRIMARY KEY NOT NULL,
  visitor_id text NOT NULL REFERENCES measurement_visitors(visitor_id) ON DELETE cascade,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  ended_at timestamp with time zone,
  entry_path text,
  last_path text,
  referrer text,
  source text NOT NULL DEFAULT 'unknown',
  medium text,
  campaign text,
  content_link text,
  device text,
  os text,
  browser text,
  locale text,
  viewport text,
  country text,
  region text,
  city text,
  is_staff boolean NOT NULL DEFAULT false,
  is_bot boolean NOT NULL DEFAULT false,
  source_unknown boolean NOT NULL DEFAULT true,
  CONSTRAINT "measurement_visits_has_id" CHECK (length(btrim("measurement_visits"."visit_id")) > 0)
);
--> statement-breakpoint
CREATE INDEX "measurement_visits_by_visitor" ON "measurement_visits" USING btree ("visitor_id","started_at" DESC);
--> statement-breakpoint
CREATE INDEX "measurement_visits_by_started" ON "measurement_visits" USING btree ("started_at" DESC);
--> statement-breakpoint
CREATE INDEX "measurement_visits_by_source" ON "measurement_visits" USING btree ("source","started_at" DESC);
--> statement-breakpoint

CREATE TABLE measurement_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  occurred_at timestamp with time zone DEFAULT now() NOT NULL,
  visit_id text NOT NULL REFERENCES measurement_visits(visit_id) ON DELETE cascade,
  visitor_id text NOT NULL REFERENCES measurement_visitors(visitor_id) ON DELETE cascade,
  name text NOT NULL,
  page_path text,
  content_id text,
  content_type text,
  section text,
  component_id text,
  placement text,
  source text,
  campaign text,
  device text,
  site_revision text,
  client_or_server text NOT NULL DEFAULT 'browser',
  headline_version text,
  image_id text,
  placement_version text,
  query_redacted text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  x double precision,
  y double precision,
  scroll_pct integer,
  CONSTRAINT "measurement_events_name_known" CHECK ("measurement_events"."name" IN (
    'page_view','page_hide','scroll','presence','exposure','click_card','click_nav','click_button','click_link','click_other',
    'rage_click','dead_click','copy_content','share_click','share_copy','open','close',
    'estimated_read','claim_exposure','evidence_open','verdict_reached','sources_open',
    'search_query','search_zero_results','search_result_click','search_refine','search_abandon',
    'ask_open','ask_source_click','ask_copy_answer','ask_feedback','ask_follow_up',
    'ask_success','ask_fail','ask_latency','ask_cost',
    'media_play','media_pause','media_resume','media_progress','media_complete','media_seek','media_mute','media_captions','media_fullscreen','media_error',
    'image_expand','image_gallery','document_open','document_download',
    'web_vital','resource_error','page_error','not_found'
  )),
  CONSTRAINT "measurement_events_client_or_server_known" CHECK ("measurement_events"."client_or_server" IN ('browser','server')),
  CONSTRAINT "measurement_events_scroll_pct_range" CHECK ("measurement_events"."scroll_pct" IS NULL OR ("measurement_events"."scroll_pct" >= 0 AND "measurement_events"."scroll_pct" <= 100))
);
--> statement-breakpoint
CREATE INDEX "measurement_events_by_time" ON "measurement_events" USING btree ("occurred_at" DESC);
--> statement-breakpoint
CREATE INDEX "measurement_events_by_visit" ON "measurement_events" USING btree ("visit_id","occurred_at");
--> statement-breakpoint
CREATE INDEX "measurement_events_by_name" ON "measurement_events" USING btree ("name","occurred_at" DESC);
--> statement-breakpoint
CREATE INDEX "measurement_events_by_content" ON "measurement_events" USING btree ("content_id","occurred_at" DESC);
--> statement-breakpoint
CREATE INDEX "measurement_events_by_section" ON "measurement_events" USING btree ("section","occurred_at" DESC);
--> statement-breakpoint
CREATE INDEX "measurement_events_by_path" ON "measurement_events" USING btree ("page_path","occurred_at" DESC);
--> statement-breakpoint

CREATE TABLE measurement_presence (
  visit_id text PRIMARY KEY NOT NULL REFERENCES measurement_visits(visit_id) ON DELETE cascade,
  visitor_id text NOT NULL REFERENCES measurement_visitors(visitor_id) ON DELETE cascade,
  path text NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  visible boolean NOT NULL DEFAULT true
);
--> statement-breakpoint
CREATE INDEX "measurement_presence_by_seen" ON "measurement_presence" USING btree ("last_seen_at" DESC);
--> statement-breakpoint

-- Append-only events
CREATE TRIGGER measurement_events_is_append_only
  BEFORE UPDATE OR DELETE ON measurement_events
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint

-- Retention prune: events older than 90 days; presence older than 1 day.
CREATE OR REPLACE FUNCTION prune_measurement(event_retention interval DEFAULT interval '90 days', presence_retention interval DEFAULT interval '1 day')
RETURNS TABLE(events_deleted bigint, presence_deleted bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  e bigint;
  p bigint;
BEGIN
  DELETE FROM measurement_events WHERE occurred_at < now() - event_retention;
  GET DIAGNOSTICS e = ROW_COUNT;
  DELETE FROM measurement_presence WHERE last_seen_at < now() - presence_retention;
  GET DIAGNOSTICS p = ROW_COUNT;
  RETURN QUERY SELECT e, p;
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION prune_measurement(interval, interval) TO app_service;
--> statement-breakpoint

-- RLS: public may insert/upsert measurement rows; staff/service read all.
ALTER TABLE measurement_visitors ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE measurement_visits ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE measurement_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE measurement_presence ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

REVOKE ALL ON measurement_visitors FROM app_public;--> statement-breakpoint
REVOKE ALL ON measurement_visits FROM app_public;--> statement-breakpoint
REVOKE ALL ON measurement_events FROM app_public;--> statement-breakpoint
REVOKE ALL ON measurement_presence FROM app_public;--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE ON measurement_visitors TO app_public, app_staff, app_service;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON measurement_visits TO app_public, app_staff, app_service;--> statement-breakpoint
GRANT SELECT, INSERT ON measurement_events TO app_public, app_staff, app_service;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON measurement_presence TO app_public, app_staff, app_service;--> statement-breakpoint

CREATE POLICY measurement_visitors_public_write ON measurement_visitors FOR INSERT TO app_public WITH CHECK (true);--> statement-breakpoint
CREATE POLICY measurement_visitors_public_update ON measurement_visitors FOR UPDATE TO app_public USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY measurement_visitors_staff_all ON measurement_visitors FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);--> statement-breakpoint

CREATE POLICY measurement_visits_public_write ON measurement_visits FOR INSERT TO app_public WITH CHECK (true);--> statement-breakpoint
CREATE POLICY measurement_visits_public_update ON measurement_visits FOR UPDATE TO app_public USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY measurement_visits_staff_all ON measurement_visits FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);--> statement-breakpoint

CREATE POLICY measurement_events_public_insert ON measurement_events FOR INSERT TO app_public WITH CHECK (true);--> statement-breakpoint
CREATE POLICY measurement_events_staff_all ON measurement_events FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);--> statement-breakpoint

CREATE POLICY measurement_presence_public_write ON measurement_presence FOR INSERT TO app_public WITH CHECK (true);--> statement-breakpoint
CREATE POLICY measurement_presence_public_update ON measurement_presence FOR UPDATE TO app_public USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY measurement_presence_public_delete ON measurement_presence FOR DELETE TO app_public USING (true);--> statement-breakpoint
CREATE POLICY measurement_presence_staff_all ON measurement_presence FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
