-- The operations task board: one ledger for every task, from every agent.
--
-- Five AI environments, the ChatGPT editorial run, GitHub Actions and local
-- scripts all work on this project, and until now "what is running, who did
-- it, what is left" had to be reconstructed from chats and terminals. These
-- four tables are that record, written through one internal API by many
-- reporters and read by the admin console.
--
-- Three decisions live here rather than in TypeScript, because every future
-- reporter would otherwise re-decide them:
--
--   * A task is never auto-completed. `completed` is a status a reporter
--     states with a `finish` report, or a human sets by hand; `reported_finish`
--     records which. A session that ends silently stays `running` and is
--     surfaced as unreported — that is the honest answer, not a tidy one.
--   * The timeline is append-only. `ops_task_event` rejects UPDATE and DELETE
--     through the same `reject_mutation()` as `audit_log`, so a reporter can
--     add to the story and never rewrite it.
--   * Status transitions are recorded by the database, not by whichever
--     caller remembered to. `record_ops_task_transition` writes a `status`
--     event on every change; a transaction that already recorded the same
--     transition itself (the service does, with the reporter's message) is
--     not recorded twice — `created_at = now()` is the same transaction
--     timestamp for both rows, which is what makes the check exact.
--
-- Attachments are objects in the public editorial Blob store under
-- `ops/attachments/`, so the URL check reuses the self-hosting regex of
-- `editorial_media_is_self_hosted` (0057): a screenshot is served from our
-- own store or from this site, never hotlinked.

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
--> statement-breakpoint
ALTER TABLE "ops_task" ADD CONSTRAINT "ops_task_parent_id_ops_task_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ops_task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ops_task_by_status" ON "ops_task" USING btree ("status","last_update_at" DESC);--> statement-breakpoint
CREATE INDEX "ops_task_by_agent" ON "ops_task" USING btree ("agent","last_update_at" DESC);--> statement-breakpoint
CREATE INDEX "ops_task_by_parent" ON "ops_task" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "ops_task_by_last_update" ON "ops_task" USING btree ("last_update_at" DESC);--> statement-breakpoint

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
--> statement-breakpoint
ALTER TABLE "ops_task_event" ADD CONSTRAINT "ops_task_event_task_id_ops_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."ops_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ops_task_event_key_once" ON "ops_task_event" USING btree ("task_id","event_key") WHERE "ops_task_event"."event_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ops_task_event_by_task" ON "ops_task_event" USING btree ("task_id","occurred_at" DESC);--> statement-breakpoint

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
--> statement-breakpoint
ALTER TABLE "ops_task_attachment" ADD CONSTRAINT "ops_task_attachment_task_id_ops_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."ops_task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ops_task_attachment_by_task" ON "ops_task_attachment" USING btree ("task_id","created_at");--> statement-breakpoint

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
--> statement-breakpoint
ALTER TABLE "ops_reporter" ADD CONSTRAINT "ops_reporter_last_task_id_ops_task_id_fk" FOREIGN KEY ("last_task_id") REFERENCES "public"."ops_task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- ── The timeline is append-only ──────────────────────────────────────────────
CREATE TRIGGER ops_task_event_is_append_only
  BEFORE UPDATE OR DELETE ON ops_task_event
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint

-- ── Status transitions are recorded by the database ──────────────────────────
-- Same shape as `record_report_transition` (0015): the actor is the request
-- identity when one is set, else the database user. The `NOT EXISTS` is the
-- dedupe described in the header: a `status`/`finished` event the service
-- already wrote in this transaction carries the same transition and the same
-- transaction timestamp, so the trigger leaves it alone.
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
--> statement-breakpoint

CREATE TRIGGER ops_task_status_is_recorded
  BEFORE UPDATE ON ops_task
  FOR EACH ROW EXECUTE FUNCTION record_ops_task_transition();
--> statement-breakpoint

-- ── Row-level security, as in 0059 ───────────────────────────────────────────
-- Operational records, never public. Events and attachments are readable and
-- appendable; the task and the reporter roster are updatable.
ALTER TABLE ops_task ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON ops_task FROM app_public;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON ops_task TO app_staff, app_service;--> statement-breakpoint
CREATE POLICY ops_task_staff_read ON ops_task FOR SELECT TO app_staff, app_service USING (true);--> statement-breakpoint
CREATE POLICY ops_task_staff_insert ON ops_task FOR INSERT TO app_staff, app_service WITH CHECK (true);--> statement-breakpoint
CREATE POLICY ops_task_staff_update ON ops_task FOR UPDATE TO app_staff, app_service USING (true) WITH CHECK (true);--> statement-breakpoint

ALTER TABLE ops_task_event ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON ops_task_event FROM app_public;--> statement-breakpoint
GRANT SELECT, INSERT ON ops_task_event TO app_staff, app_service;--> statement-breakpoint
CREATE POLICY ops_task_event_staff_read ON ops_task_event FOR SELECT TO app_staff, app_service USING (true);--> statement-breakpoint
CREATE POLICY ops_task_event_staff_insert ON ops_task_event FOR INSERT TO app_staff, app_service WITH CHECK (true);--> statement-breakpoint

ALTER TABLE ops_task_attachment ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON ops_task_attachment FROM app_public;--> statement-breakpoint
GRANT SELECT, INSERT ON ops_task_attachment TO app_staff, app_service;--> statement-breakpoint
CREATE POLICY ops_task_attachment_staff_read ON ops_task_attachment FOR SELECT TO app_staff, app_service USING (true);--> statement-breakpoint
CREATE POLICY ops_task_attachment_staff_insert ON ops_task_attachment FOR INSERT TO app_staff, app_service WITH CHECK (true);--> statement-breakpoint

ALTER TABLE ops_reporter ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON ops_reporter FROM app_public;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON ops_reporter TO app_staff, app_service;--> statement-breakpoint
CREATE POLICY ops_reporter_staff_read ON ops_reporter FOR SELECT TO app_staff, app_service USING (true);--> statement-breakpoint
CREATE POLICY ops_reporter_staff_insert ON ops_reporter FOR INSERT TO app_staff, app_service WITH CHECK (true);--> statement-breakpoint
CREATE POLICY ops_reporter_staff_update ON ops_reporter FOR UPDATE TO app_staff, app_service USING (true) WITH CHECK (true);
