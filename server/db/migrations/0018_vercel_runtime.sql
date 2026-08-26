-- Production runtime hardening for Vercel + Neon.

-- The Neon project owner creates these NOLOGIN roles but does not necessarily
-- inherit them. Membership is required for SET ROLE on request connections.
DO $$
BEGIN
  EXECUTE format('GRANT app_public, app_staff, app_service TO %I', current_user);
END
$$;
--> statement-breakpoint

GRANT SELECT, INSERT ON chat_thread, chat_message, chat_tool_run, chat_citation, ai_run
  TO app_public;
--> statement-breakpoint
GRANT UPDATE ON chat_tool_run TO app_public;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_public;
--> statement-breakpoint

-- Public search is only the published information-item projection. Evidence,
-- narratives and unpublished item rows remain useful to staff, never public.
DROP POLICY search_document_read ON search_document;
--> statement-breakpoint
CREATE POLICY search_document_public_published_items ON search_document
  FOR SELECT TO app_public
  USING (
    (
      entity_type = 'information_item'
      AND EXISTS (
        SELECT 1 FROM information_item i
        WHERE i.id = search_document.entity_id
          AND i.status IN ('published', 'updated')
      )
    )
    OR (
      entity_type IN ('news_update', 'brief', 'geopolitical_analysis', 'scenario')
      AND EXISTS (
        SELECT 1 FROM publication p
        WHERE p.id = search_document.entity_id
          AND p.kind::text = search_document.entity_type::text
          AND p.status IN ('published', 'updated')
      )
    )
  );
--> statement-breakpoint
CREATE POLICY search_document_staff_read ON search_document
  FOR SELECT TO app_staff, app_service USING (true);
--> statement-breakpoint

-- Anonymous chat is private to the HMAC-derived identity attached to its
-- request connection. Guessing a UUID does not reveal another transcript.
CREATE POLICY chat_thread_public_own ON chat_thread
  FOR ALL TO app_public
  USING (created_by IS NULL AND created_by_label = current_setting('app.identity', true))
  WITH CHECK (created_by IS NULL AND created_by_label = current_setting('app.identity', true));
--> statement-breakpoint

CREATE POLICY chat_message_public_own ON chat_message
  FOR ALL TO app_public
  USING (
    EXISTS (
      SELECT 1 FROM chat_thread t
      WHERE t.id = chat_message.thread_id
        AND t.created_by IS NULL
        AND t.created_by_label = current_setting('app.identity', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_thread t
      WHERE t.id = chat_message.thread_id
        AND t.created_by IS NULL
        AND t.created_by_label = current_setting('app.identity', true)
    )
  );
--> statement-breakpoint

ALTER TABLE chat_tool_run ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY chat_tool_run_staff_all ON chat_tool_run
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY chat_tool_run_public_own ON chat_tool_run
  FOR ALL TO app_public
  USING (
    EXISTS (
      SELECT 1 FROM chat_thread t
      WHERE t.id = chat_tool_run.thread_id
        AND t.created_by_label = current_setting('app.identity', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_thread t
      WHERE t.id = chat_tool_run.thread_id
        AND t.created_by_label = current_setting('app.identity', true)
    )
  );
--> statement-breakpoint

ALTER TABLE chat_citation ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY chat_citation_staff_all ON chat_citation
  FOR ALL TO app_staff, app_service USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY chat_citation_public_own ON chat_citation
  FOR ALL TO app_public
  USING (
    EXISTS (
      SELECT 1 FROM chat_message m
      JOIN chat_thread t ON t.id = m.thread_id
      WHERE m.id = chat_citation.message_id
        AND t.created_by_label = current_setting('app.identity', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_message m
      JOIN chat_thread t ON t.id = m.thread_id
      WHERE m.id = chat_citation.message_id
        AND t.created_by_label = current_setting('app.identity', true)
    )
  );
--> statement-breakpoint

CREATE POLICY ai_run_public_chat_append ON ai_run
  FOR INSERT TO app_public
  WITH CHECK (
    kind IN ('chat', 'embed')
    AND input_data_class = 'public'
    AND actor_user_id IS NULL
    AND actor_label = current_setting('app.identity', true)
  );
--> statement-breakpoint

-- Functions called by RLS roles own their narrow table operation and expose
-- no raw rows. Harden the search path against object-shadowing attacks.
CREATE OR REPLACE FUNCTION bump_rate_limit(
  p_bucket text,
  p_window_seconds int
) RETURNS int
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  w timestamptz;
  n int;
BEGIN
  IF p_window_seconds < 1 THEN
    RAISE EXCEPTION 'window must be positive';
  END IF;
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
REVOKE ALL ON FUNCTION bump_rate_limit(text, int) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION bump_rate_limit(text, int) TO app_public, app_staff, app_service;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION ai_spend_since(since timestamptz) RETURNS numeric
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(cost_usd), 0)::numeric
  FROM ai_run
  WHERE created_at >= since AND status = 'ok';
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION ai_spend_since(timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION ai_spend_since(timestamptz) TO app_public, app_staff, app_service;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION prune_rate_limits(older_than interval DEFAULT '1 day')
  RETURNS int
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE removed int;
BEGIN
  DELETE FROM rate_limit WHERE window_start < now() - older_than;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION prune_expired_idempotency()
  RETURNS int
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE removed int;
BEGIN
  DELETE FROM idempotency_key WHERE expires_at < now();
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;
