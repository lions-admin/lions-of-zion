ALTER TABLE "publication"
  ADD COLUMN "editorial_topic" text,
  ADD COLUMN "primary_actor" text,
  ADD COLUMN "arena" text,
  ADD COLUMN "featured_israel_story" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX "publication_by_editorial_filters"
  ON "publication" ("editorial_topic", "primary_actor", "arena", "published_at");
