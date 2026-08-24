-- Required by `search_document_title_trigram` below. Hand-added to the
-- generated file: drizzle-kit does not emit extension DDL, and the index
-- three statements down cannot be created without it. PGlite bundles
-- pg_trgm (confirmed by spike), so this succeeds in tests and in Neon alike.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "search_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"language" text NOT NULL,
	"ts_simple" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', title || ' ' || body)) STORED,
	"ts_english" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || body)) STORED,
	"content_hash" text GENERATED ALWAYS AS (md5(title || E'
' || body)) STORED,
	"indexed_content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_document_is_titled" CHECK (length(btrim("search_document"."title")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "search_document_identifies_one_entity" ON "search_document" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "search_document_simple" ON "search_document" USING gin ("ts_simple");--> statement-breakpoint
CREATE INDEX "search_document_english" ON "search_document" USING gin ("ts_english");--> statement-breakpoint
CREATE INDEX "search_document_title_trigram" ON "search_document" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "search_document_embedding_backlog" ON "search_document" USING btree ("updated_at") WHERE "search_document"."indexed_content_hash" IS DISTINCT FROM "search_document"."content_hash";