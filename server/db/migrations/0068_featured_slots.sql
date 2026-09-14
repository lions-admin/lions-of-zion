-- Featured-slot rotation: durable state for the six evergreen homepage
-- positions that have no editorial placement mechanism today (October 7
-- testimony/documentation, Courage & service, Fallen, History & context
-- primary/secondary). See server/modules/featured-slots.
CREATE TABLE "featured_slot" (
	"slot" text PRIMARY KEY NOT NULL,
	"current_key" text,
	"selected_at" timestamp with time zone,
	"previous" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pin" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "featured_slot" ADD CONSTRAINT "featured_slot_slot_check" CHECK (
	"slot" IN ('october7.testimony','october7.documentation','heroes.courage','heroes.fallen','history.primary','history.secondary')
);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "featured_slot" TO app_staff, app_service;--> statement-breakpoint
ALTER TABLE "featured_slot" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "featured_slot_staff_all" ON "featured_slot"
	FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);--> statement-breakpoint
INSERT INTO "featured_slot" ("slot") VALUES
	('october7.testimony'),
	('october7.documentation'),
	('heroes.courage'),
	('heroes.fallen'),
	('history.primary'),
	('history.secondary');
