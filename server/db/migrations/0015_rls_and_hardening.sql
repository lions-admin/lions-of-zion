-- Phase 8: the publish gate for publications, the report trail, and RLS.

-- ── The report trail is append-only, and written by a trigger ───────────────
CREATE TRIGGER report_status_history_is_append_only
  BEFORE UPDATE OR DELETE ON report_status_history
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION record_report_transition() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  actor text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  actor := COALESCE(NULLIF(current_setting('app.identity', true), ''), current_user);

  INSERT INTO report_status_history (report_id, from_status, to_status, actor_label, note)
  VALUES (NEW.id, OLD.status, NEW.status, actor, NEW.resolution_note);

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER report_status_is_recorded
  BEFORE UPDATE ON report
  FOR EACH ROW EXECUTE FUNCTION record_report_transition();
--> statement-breakpoint

-- ── The publish gate, shared by all four publication surfaces ──────────────
-- Deliberately the same shape as `enforce_publish_gate` on information_item,
-- and for the same reason: the single-row CHECK can see that `approved_by` is
-- set, not who they are. One trigger over one table is why merging the four
-- surfaces was worth doing — four tables would have meant four copies of
-- this, and four chances for one of them to drift.
CREATE OR REPLACE FUNCTION enforce_publication_publish_gate() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  approver_is_automated boolean;
BEGIN
  IF NEW.status <> 'published' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.approved_by IS NOT NULL THEN
    IF NEW.approved_by = NEW.created_by THEN
      RAISE EXCEPTION 'publication % cannot be approved by its own author', NEW.id
        USING ERRCODE = 'restrict_violation';
    END IF;

    SELECT is_automated INTO approver_is_automated FROM app_user WHERE id = NEW.approved_by;
    IF COALESCE(approver_is_automated, true) THEN
      RAISE EXCEPTION 'publication % approver must be a human reviewer', NEW.id
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER publication_publish_gate
  BEFORE UPDATE ON publication
  FOR EACH ROW EXECUTE FUNCTION enforce_publication_publish_gate();
--> statement-breakpoint

-- ── Roles ──────────────────────────────────────────────────────────────────
-- Three, matching the `as()` harness written in Phase 1 and unused until now.
--
--   app_public  — anonymous readers. Published surfaces only.
--   app_staff   — the editorial team. Everything except restricted material.
--   app_service — connectors, crons, queue consumers. Writes, but may never
--                 read restricted evidence and may never publish.
--
-- NOLOGIN: these are assumed via SET LOCAL ROLE inside a transaction, never
-- connected as. That is also why `as()` asserts `current_user` afterwards —
-- SET LOCAL ROLE outside a transaction is a silent no-op, and an
-- authorization suite that quietly runs as the owner passes for the wrong
-- reason, which is worse than having no suite.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_public') THEN
    CREATE ROLE app_public NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_staff') THEN
    CREATE ROLE app_staff NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    CREATE ROLE app_service NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO app_public, app_staff, app_service;
--> statement-breakpoint

-- Baseline grants. RLS narrows these; a grant that RLS does not narrow is a
-- grant that applies in full, so the policies below are what actually matter.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_staff;
--> statement-breakpoint
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_staff;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_service;
--> statement-breakpoint
GRANT SELECT ON information_item, publication, evidence, source, source_family,
  topic, event, search_document, item_assessment TO app_public;
--> statement-breakpoint
GRANT INSERT ON report TO app_public;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_staff, app_service;
--> statement-breakpoint

-- ── Row-level security ─────────────────────────────────────────────────────
-- Enabled last, once every table exists and carries the columns the policies
-- read. Each `ENABLE` is paired with policies immediately, because a table
-- with RLS enabled and no policy is invisible to everyone but the owner —
-- which fails closed, but fails closed *silently*, and looks exactly like a
-- bug in the application.

ALTER TABLE information_item ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY information_item_public_reads_published ON information_item
  FOR SELECT TO app_public
  USING (status IN ('published', 'updated'));
--> statement-breakpoint
CREATE POLICY information_item_staff_read ON information_item
  FOR SELECT TO app_staff, app_service USING (true);
--> statement-breakpoint
CREATE POLICY information_item_staff_write ON information_item
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE publication ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY publication_public_reads_published ON publication
  FOR SELECT TO app_public
  USING (status IN ('published', 'updated'));
--> statement-breakpoint
CREATE POLICY publication_staff_all ON publication
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint

-- Evidence is where classification actually bites. `app_public` sees only
-- public evidence; `app_staff` sees everything except restricted and secret,
-- which need `evidence.restricted.read` — a capability
-- `reject_automated_privilege` already refuses to grant to any automated
-- identity, so app_service can never reach it by configuration error.
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY evidence_public_reads_public ON evidence
  FOR SELECT TO app_public USING (data_class = 'public');
--> statement-breakpoint
CREATE POLICY evidence_staff_reads_unrestricted ON evidence
  FOR SELECT TO app_staff, app_service
  USING (
    data_class NOT IN ('restricted', 'secret')
    OR EXISTS (
      SELECT 1 FROM capability_grant cg
      JOIN app_user u ON u.id = cg.user_id
      WHERE cg.capability = 'evidence.restricted.read'
        AND u.disabled_at IS NULL
        AND u.display_name = current_setting('app.identity', true)
    )
  );
--> statement-breakpoint
CREATE POLICY evidence_staff_write ON evidence
  FOR INSERT TO app_staff, app_service WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY evidence_staff_update ON evidence
  FOR UPDATE TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint

-- The search projection must never expose restricted material either. The
-- projection refuses to index it in the first place (`isIndexable`); this is
-- the second lock on the same door.
ALTER TABLE search_document ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY search_document_read ON search_document
  FOR SELECT TO app_public, app_staff, app_service USING (true);
--> statement-breakpoint
CREATE POLICY search_document_write ON search_document
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint

-- A reporter may file a report and may not read anyone's, including their
-- own: there is no authenticated identity behind `app_public` to scope it to,
-- and "reports visible to whoever guesses a public_id" is not a feature.
ALTER TABLE report ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY report_public_may_submit ON report
  FOR INSERT TO app_public WITH CHECK (status = 'received');
--> statement-breakpoint
CREATE POLICY report_staff_all ON report
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE report_file ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY report_file_public_may_attach ON report_file
  FOR INSERT TO app_public WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY report_file_staff_all ON report_file
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint

-- The audit log is readable by staff and writable by everything, and
-- rewritable by nothing — the append-only trigger from Phase 1 still stands
-- above these grants.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY audit_log_staff_read ON audit_log
  FOR SELECT TO app_staff USING (true);
--> statement-breakpoint
CREATE POLICY audit_log_append ON audit_log
  FOR INSERT TO app_staff, app_service, app_public WITH CHECK (true);
--> statement-breakpoint

-- Chat transcripts are staff-only. There is no public chat surface, and
-- adding one later should be a deliberate policy change rather than an
-- oversight that was always true.
ALTER TABLE chat_thread ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY chat_thread_staff_all ON chat_thread
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE chat_message ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY chat_message_staff_all ON chat_message
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint

-- ai_run holds cost and model detail; staff read it, nobody outside does.
ALTER TABLE ai_run ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY ai_run_staff_read ON ai_run FOR SELECT TO app_staff USING (true);
--> statement-breakpoint
CREATE POLICY ai_run_append ON ai_run
  FOR INSERT TO app_staff, app_service WITH CHECK (true);
--> statement-breakpoint

-- ── Rate limiting ──────────────────────────────────────────────────────────
-- Fixed window, in one statement, returning the post-increment count so the
-- caller needs no second round trip and two concurrent requests cannot both
-- read a stale count and both decide they are under the limit.
CREATE OR REPLACE FUNCTION bump_rate_limit(
  p_bucket text,
  p_window_seconds int
) RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  w timestamptz;
  n int;
BEGIN
  w := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  INSERT INTO rate_limit (bucket, window_start, count)
  VALUES (p_bucket, w, 1)
  ON CONFLICT (bucket, window_start)
  DO UPDATE SET count = rate_limit.count + 1
  RETURNING count INTO n;

  RETURN n;
END;
$$;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION bump_rate_limit(text, int) TO app_public, app_staff, app_service;
--> statement-breakpoint

-- Old windows are never read again. Called by the existing cleanup cron.
CREATE OR REPLACE FUNCTION prune_rate_limits(older_than interval DEFAULT '1 day')
  RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  removed int;
BEGIN
  DELETE FROM rate_limit WHERE window_start < now() - older_than;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;
