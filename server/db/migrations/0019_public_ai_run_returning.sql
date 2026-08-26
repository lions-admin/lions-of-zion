-- INSERT ... RETURNING is subject to SELECT RLS as well as INSERT RLS.
-- The public search/chat paths need the id of the cost row they just wrote,
-- but must never see another anonymous identity's ledger entries.
CREATE POLICY ai_run_public_own_read ON ai_run
  FOR SELECT TO app_public
  USING (
    actor_user_id IS NULL
    AND actor_label = current_setting('app.identity', true)
  );
