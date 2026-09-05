ALTER TABLE "publication" DROP CONSTRAINT "narrative_watch_details_match_section";--> statement-breakpoint
ALTER TABLE "publication" ALTER COLUMN "section" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "publication" ALTER COLUMN "section" SET DEFAULT 'israel_update'::text;--> statement-breakpoint
DROP TYPE "public"."publication_section";--> statement-breakpoint
CREATE TYPE "public"."publication_section" AS ENUM('daily_brief', 'israel_update', 'narrative_watch');--> statement-breakpoint
ALTER TABLE "publication" ALTER COLUMN "section" SET DEFAULT 'israel_update'::"public"."publication_section";--> statement-breakpoint
ALTER TABLE "publication" ALTER COLUMN "section" SET DATA TYPE "public"."publication_section" USING "section"::"public"."publication_section";--> statement-breakpoint
ALTER TABLE "publication" ADD CONSTRAINT "narrative_watch_details_match_section" CHECK ((section = 'narrative_watch'::publication_section) = (narrative_watch_details IS NOT NULL));
