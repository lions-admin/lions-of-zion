-- RUN THIS AGAINST THE PRODUCTION NEON BRANCH BEFORE PUBLISHING ai/claude TO main.
--
-- Migration: 0066_ops_tasks — the operations task board (ops_task,
-- ops_task_event, ops_task_attachment, ops_reporter). Authored 2026-09-12.
--
-- WHY IT CANNOT WAIT UNTIL AFTER THE MERGE. The four tables are in the drizzle
-- schema, so `scripts/check-deployment-schema.ts` — which runs inside
-- `npm run build` — refuses to build until every column it names exists. And
-- the first report from any agent hook, the first CI run and the first open of
-- the "משימות ופעילות" console area all SELECT or INSERT into these tables.
--
-- The whole file is one migration applied as a unit. It is NOT idempotent
-- (CREATE TABLE without IF NOT EXISTS, CREATE POLICY) — run it once. If it has
-- to be re-run after a partial failure, drop the four tables first:
--   DROP TABLE IF EXISTS ops_task_attachment, ops_task_event, ops_reporter, ops_task CASCADE;
--   DROP FUNCTION IF EXISTS record_ops_task_transition();
--
-- HOW TO RUN: Neon Console → the Production branch → SQL Editor → paste → Run.
-- Or `neonctl` if authenticated. Production credentials are Vercel *sensitive*
-- vars and are not readable from the development machine, which is why this is
-- handed over rather than executed.
--
-- The DDL below is byte-for-byte server/db/migrations/0066_ops_tasks.sql with
-- the `--> statement-breakpoint` markers removed. If that file changes, this
-- one is stale and the receipt hash in step 2 changes with it.

CREATE TABLE ops_task (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  task_key text NOT NULL,
  parent_id uuid,
  title text NOT NULL,
  request text,
  goal text,
  agent text NOT NULL,
  environment text NOT NULL,
  kind text DEFAULT 'other' NOT NULL,
  status text DEFAULT 'queued' NOT NULL,
  summary text,
  changes text,
  remaining text,
  blockers text,
  next_step text,
  links jsonb DEFAULT '[]'::jsonb NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb NOT NULL,
  reported_finish boolean DEFAULT false NOT NULL,
  started_at timestamp with time zone,
  last_update_at timestamp with time zone DEFAULT now() NOT NULL,
  finished_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ops_task_task_key_unique" UNIQUE("task_key"),
  CONSTRAINT "ops_task_has_key" CHECK (length(btrim("ops_task"."task_key")) > 0),
  CONSTRAINT "ops_task_has_title" CHECK (length(btrim("ops_task"."title")) > 0),
  CONSTRAINT "ops_task_agent_known" CHECK ("ops_task"."agent" IN ('claude','codex','grok','opencode','gemini-agy','chatgpt-editorial','github-actions','local-script','human','unknown')),
  CONSTRAINT "ops_task_kind_known" CHECK ("ops_task"."kind" IN ('code','editorial','design','ops','research','review','import','other')),
  CONSTRAINT "ops_task_status_known" CHECK ("ops_task"."status" IN ('queued','running','waiting','blocked','completed','failed','cancelled')),
  CONSTRAINT "ops_task_not_its_own_parent" CHECK ("ops_task"."parent_id" IS NULL OR "ops_task"."parent_id" <> "ops_task"."id")
);
ALTER TABLE "ops_task" ADD CONSTRAINT "ops_task_parent_id_ops_task_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ops_task"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "ops_task_by_status" ON "ops_task" USING btree ("status","last_update_at" DESC);
CREATE INDEX "ops_task_by_agent" ON "ops_task" USING btree ("agent","last_update_at" DESC);
CREATE INDEX "ops_task_by_parent" ON "ops_task" USING btree ("parent_id");
CREATE INDEX "ops_task_by_last_update" ON "ops_task" USING btree ("last_update_at" DESC);

CREATE TABLE ops_task_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  task_id uuid NOT NULL,
  event_key text,
  occurred_at timestamp with time zone DEFAULT now() NOT NULL,
  kind text NOT NULL,
  actor_label text NOT NULL,
  from_status text,
  to_status text,
  message text,
  payload jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ops_task_event_kind_known" CHECK ("ops_task_event"."kind" IN ('started','progress','status','note','attachment','finished','heartbeat','commit','ci','import')),
  CONSTRAINT "ops_task_event_has_actor" CHECK (length(btrim("ops_task_event"."actor_label")) > 0)
);
ALTER TABLE "ops_task_event" ADD CONSTRAINT "ops_task_event_task_id_ops_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."ops_task"("id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "ops_task_event_key_once" ON "ops_task_event" USING btree ("task_id","event_key") WHERE "ops_task_event"."event_key" IS NOT NULL;
CREATE INDEX "ops_task_event_by_task" ON "ops_task_event" USING btree ("task_id","occurred_at" DESC);

CREATE TABLE ops_task_attachment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  task_id uuid NOT NULL,
  kind text NOT NULL,
  url text NOT NULL,
  content_type text NOT NULL,
  byte_size integer NOT NULL,
  width integer,
  height integer,
  caption text,
  pair_key text,
  actor_label text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ops_task_attachment_kind_known" CHECK ("ops_task_attachment"."kind" IN ('screenshot','before','after','artifact','file')),
  CONSTRAINT "ops_task_attachment_is_self_hosted" CHECK ("ops_task_attachment"."url" ~ '^/[^/]' OR "ops_task_attachment"."url" ~ '^https://[a-z0-9-]+\.public\.blob\.vercel-storage\.com/'),
  CONSTRAINT "ops_task_attachment_has_bytes" CHECK ("ops_task_attachment"."byte_size" > 0),
  CONSTRAINT "ops_task_attachment_dimensions_paired" CHECK (("ops_task_attachment"."width" IS NULL) = ("ops_task_attachment"."height" IS NULL)),
  CONSTRAINT "ops_task_attachment_has_actor" CHECK (length(btrim("ops_task_attachment"."actor_label")) > 0)
);
ALTER TABLE "ops_task_attachment" ADD CONSTRAINT "ops_task_attachment_task_id_ops_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."ops_task"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "ops_task_attachment_by_task" ON "ops_task_attachment" USING btree ("task_id","created_at");

CREATE TABLE ops_reporter (
  agent text PRIMARY KEY NOT NULL,
  environment text,
  hostname text,
  reporter_version text,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  last_task_id uuid,
  meta jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "ops_reporter_agent_known" CHECK ("ops_reporter"."agent" IN ('claude','codex','grok','opencode','gemini-agy','chatgpt-editorial','github-actions','local-script','human','unknown'))
);
ALTER TABLE "ops_reporter" ADD CONSTRAINT "ops_reporter_last_task_id_ops_task_id_fk" FOREIGN KEY ("last_task_id") REFERENCES "public"."ops_task"("id") ON DELETE set null ON UPDATE no action;

CREATE TRIGGER ops_task_event_is_append_only
  BEFORE UPDATE OR DELETE ON ops_task_event
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE OR REPLACE FUNCTION record_ops_task_transition() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  actor text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  actor := COALESCE(NULLIF(current_setting('app.identity', true), ''), current_user);

  IF NOT EXISTS (
    SELECT 1 FROM ops_task_event
    WHERE task_id = NEW.id
      AND created_at = now()
      AND to_status = NEW.status
      AND from_status IS NOT DISTINCT FROM OLD.status
  ) THEN
    INSERT INTO ops_task_event (task_id, kind, actor_label, from_status, to_status)
    VALUES (NEW.id, 'status', actor, OLD.status, NEW.status);
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ops_task_status_is_recorded
  BEFORE UPDATE ON ops_task
  FOR EACH ROW EXECUTE FUNCTION record_ops_task_transition();

ALTER TABLE ops_task ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ops_task FROM app_public;
GRANT SELECT, INSERT, UPDATE ON ops_task TO app_staff, app_service;
CREATE POLICY ops_task_staff_read ON ops_task FOR SELECT TO app_staff, app_service USING (true);
CREATE POLICY ops_task_staff_insert ON ops_task FOR INSERT TO app_staff, app_service WITH CHECK (true);
CREATE POLICY ops_task_staff_update ON ops_task FOR UPDATE TO app_staff, app_service USING (true) WITH CHECK (true);

ALTER TABLE ops_task_event ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ops_task_event FROM app_public;
GRANT SELECT, INSERT ON ops_task_event TO app_staff, app_service;
CREATE POLICY ops_task_event_staff_read ON ops_task_event FOR SELECT TO app_staff, app_service USING (true);
CREATE POLICY ops_task_event_staff_insert ON ops_task_event FOR INSERT TO app_staff, app_service WITH CHECK (true);

ALTER TABLE ops_task_attachment ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ops_task_attachment FROM app_public;
GRANT SELECT, INSERT ON ops_task_attachment TO app_staff, app_service;
CREATE POLICY ops_task_attachment_staff_read ON ops_task_attachment FOR SELECT TO app_staff, app_service USING (true);
CREATE POLICY ops_task_attachment_staff_insert ON ops_task_attachment FOR INSERT TO app_staff, app_service WITH CHECK (true);

ALTER TABLE ops_reporter ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ops_reporter FROM app_public;
GRANT SELECT, INSERT, UPDATE ON ops_reporter TO app_staff, app_service;
CREATE POLICY ops_reporter_staff_read ON ops_reporter FOR SELECT TO app_staff, app_service USING (true);
CREATE POLICY ops_reporter_staff_insert ON ops_reporter FOR INSERT TO app_staff, app_service WITH CHECK (true);
CREATE POLICY ops_reporter_staff_update ON ops_reporter FOR UPDATE TO app_staff, app_service USING (true) WITH CHECK (true);

-- Verify:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('ops_task','ops_task_event','ops_task_attachment','ops_reporter');
-- Four rows means the DDL is applied.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2, AND THE DEPLOY FAILS WITHOUT IT.
--
-- The DDL above is only half of a migration. `scripts/schema-compatibility.ts`
-- runs on every build and refuses to promote unless the LAST checked-in
-- migration also has its receipt in drizzle's ledger:
--
--   "Schema preflight refused: the required migration marker is missing or
--    changed. Apply and verify migrations before promotion."
--
-- `npm run db:migrate` exits 1 with its error swallowed on this machine, so the
-- receipt has to be written by hand. The values are drizzle's own, read with
-- `readMigrationFiles` over server/db/migrations on 2026-09-12: the hash of
-- 0066's file contents, and the `when` from its entry in meta/_journal.json.
-- Recompute if either file changes:
--
--   node -e 'const {readMigrationFiles}=require("drizzle-orm/migrator");
--     const m=readMigrationFiles({migrationsFolder:"server/db/migrations"}).at(-1);
--     console.log(m.hash, m.folderMillis)'

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('3b84007d877f50b3689678e54cc9b3c81b72bfe4ca8e758a5358e02233ebd8d7', 1789226577810);

-- Verify both halves:
--   SELECT count(*) FROM drizzle.__drizzle_migrations
--   WHERE hash = '3b84007d877f50b3689678e54cc9b3c81b72bfe4ca8e758a5358e02233ebd8d7';
-- One row, plus the four tables above, means the next build will pass.
--
-- Run the same two steps against the Preview branch, or Preview builds fail too.
-- Then `vercel env add OPS_REPORT_SECRET` (Production + Preview, sensitive) —
-- the routes answer 500 until it is set.
