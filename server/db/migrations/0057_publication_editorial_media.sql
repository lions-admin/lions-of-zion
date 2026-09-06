-- Editorial media as rows, so a dynamically published article can carry a
-- picture without a hand-written mapping in content-packages/homepage/media.json.
--
-- See server/db/schema/media.ts for why this is two tables rather than a dozen
-- image columns on `publication`. The three rules that live here rather than in
-- TypeScript are the ones a future write path would otherwise re-decide:
--   * a cleared asset records the date it was cleared,
--   * we serve our own copy — a publisher's CDN is never the image host,
--   * a generated image may not wear a documentary role.
CREATE TABLE editorial_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  src text NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  alt text NOT NULL,
  caption text,
  credit text NOT NULL,
  source_url text,
  origin_url text,
  disclosure text,
  role text NOT NULL,
  focal_x integer DEFAULT 50 NOT NULL,
  focal_y integer DEFAULT 50 NOT NULL,
  sensitivity text DEFAULT 'unknown' NOT NULL,
  rights_status text DEFAULT 'unknown' NOT NULL,
  rights_basis text NOT NULL,
  rights_reference text NOT NULL,
  rights_cleared_at date,
  rights_surfaces text[] DEFAULT '{}'::text[] NOT NULL,
  content_hash text,
  byte_size integer,
  content_type text,
  generated boolean DEFAULT false NOT NULL,
  provenance jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "editorial_media_has_alt_text" CHECK (length(btrim("editorial_media"."alt")) > 0),
  CONSTRAINT "editorial_media_has_credit" CHECK (length(btrim("editorial_media"."credit")) > 0),
  CONSTRAINT "editorial_media_has_rights_basis" CHECK (length(btrim("editorial_media"."rights_basis")) > 0),
  CONSTRAINT "editorial_media_has_rights_reference" CHECK (length(btrim("editorial_media"."rights_reference")) > 0),
  CONSTRAINT "editorial_media_has_positive_dimensions" CHECK ("editorial_media"."width" > 0 AND "editorial_media"."height" > 0),
  CONSTRAINT "editorial_media_focal_point_is_a_percentage" CHECK ("editorial_media"."focal_x" BETWEEN 0 AND 100 AND "editorial_media"."focal_y" BETWEEN 0 AND 100),
  CONSTRAINT "editorial_media_role_is_known" CHECK ("editorial_media"."role" IN ('documentation', 'portrait', 'archival-context', 'editorial-illustration', 'safe-cover')),
  CONSTRAINT "editorial_media_sensitivity_is_known" CHECK ("editorial_media"."sensitivity" IN ('safe', 'sensitive', 'unknown')),
  CONSTRAINT "editorial_media_rights_status_is_known" CHECK ("editorial_media"."rights_status" IN ('cleared', 'unknown', 'withdrawn')),
  CONSTRAINT "editorial_media_surfaces_are_known" CHECK ("editorial_media"."rights_surfaces" <@ ARRAY['homepage', 'article']::text[]),
  CONSTRAINT "editorial_media_cleared_media_is_dated" CHECK ("editorial_media"."rights_status" <> 'cleared' OR "editorial_media"."rights_cleared_at" IS NOT NULL),
  CONSTRAINT "editorial_media_is_self_hosted" CHECK ("editorial_media"."src" ~ '^/[^/]' OR "editorial_media"."src" ~ '^https://[a-z0-9-]+\.public\.blob\.vercel-storage\.com/'),
  CONSTRAINT "editorial_media_generated_is_an_illustration" CHECK ("editorial_media"."generated" = false OR "editorial_media"."role" = 'editorial-illustration')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "editorial_media_content_is_unique" ON "editorial_media" USING btree ("content_hash") WHERE "editorial_media"."content_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "editorial_media_by_rights" ON "editorial_media" USING btree ("rights_status","created_at");--> statement-breakpoint

CREATE TABLE publication_media (
  publication_id uuid NOT NULL,
  media_id uuid NOT NULL,
  placement text DEFAULT 'hero' NOT NULL,
  position integer DEFAULT 1 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "publication_media_pk" PRIMARY KEY ("publication_id","placement","position"),
  CONSTRAINT "publication_media_placement_is_known" CHECK ("publication_media"."placement" IN ('hero', 'inline')),
  CONSTRAINT "publication_media_position_is_positive" CHECK ("publication_media"."position" >= 1),
  CONSTRAINT "publication_media_hero_is_singular" CHECK ("publication_media"."placement" <> 'hero' OR "publication_media"."position" = 1)
);
--> statement-breakpoint
ALTER TABLE "publication_media" ADD CONSTRAINT "publication_media_publication_id_publication_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publication"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_media" ADD CONSTRAINT "publication_media_media_id_editorial_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."editorial_media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "publication_media_by_media" ON "publication_media" USING btree ("media_id");--> statement-breakpoint

-- An asset's rights are not a display preference: a withdrawn image must stop
-- being reachable on the public read path, not merely stop being rendered.
-- `app_public` therefore sees cleared rows only, and the projection filters
-- again on surface. Staff and the service see everything so a withdrawal can
-- be recorded and audited.
ALTER TABLE editorial_media ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE publication_media ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT ON editorial_media TO app_public, app_staff, app_service;--> statement-breakpoint
GRANT INSERT, UPDATE ON editorial_media TO app_staff, app_service;--> statement-breakpoint
GRANT SELECT ON publication_media TO app_public, app_staff, app_service;--> statement-breakpoint
GRANT INSERT, DELETE ON publication_media TO app_staff, app_service;--> statement-breakpoint
CREATE POLICY editorial_media_public_read ON editorial_media FOR SELECT TO app_public USING (rights_status = 'cleared');--> statement-breakpoint
CREATE POLICY editorial_media_staff_read ON editorial_media FOR SELECT TO app_staff, app_service USING (true);--> statement-breakpoint
CREATE POLICY editorial_media_write ON editorial_media FOR INSERT TO app_staff, app_service WITH CHECK (true);--> statement-breakpoint
CREATE POLICY editorial_media_amend ON editorial_media FOR UPDATE TO app_staff, app_service USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY publication_media_read ON publication_media FOR SELECT TO app_public, app_staff, app_service USING (true);--> statement-breakpoint
CREATE POLICY publication_media_write ON publication_media FOR INSERT TO app_staff, app_service WITH CHECK (true);--> statement-breakpoint
CREATE POLICY publication_media_detach ON publication_media FOR DELETE TO app_staff, app_service USING (true);
