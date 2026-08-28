-- `recordEmbeddingRun` uses INSERT ... RETURNING so the service can retain
-- the ledger row id without opening a second write path.  INSERT policies do
-- not grant visibility to RETURNING rows; keep that visibility internal to
-- the service role and do not broaden public access to the AI ledger.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_run'
      AND policyname = 'ai_run_service_read'
  ) THEN
    CREATE POLICY ai_run_service_read ON ai_run
      FOR SELECT TO app_service
      USING (true);
  END IF;
END
$$;
--> statement-breakpoint
