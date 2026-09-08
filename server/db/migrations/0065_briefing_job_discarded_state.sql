-- Production recovery, 2026-09-08. A terminal state for work the retired
-- pipeline can never run.
--
-- `briefing_job` knew four states: pending, running, completed, quarantined.
-- Every stage except `collect` belongs to the internal briefing initiator,
-- which the owner retired on 2026-09-06: no cron, queue trigger, admin action
-- or operations tool creates or dispatches a draft, triage or publish job any
-- more, and every recovery path in `briefing/jobs.ts` is `stage = 'collect'`.
--
-- Three legacy rows were left behind in states that read as live work —
-- `draft:2026-09-02:v1` and `draft:2026-09-03:v1` quarantined, and
-- `publish:2026-09-01:v1` pending with its attempt budget exhausted, which
-- nothing could ever claim. Together they held `quarantined_jobs` critical
-- and drove `queue_age` past 9,600 minutes, so the console reported the
-- system degraded for a pipeline that does not exist.
--
-- `discarded` is where such a row goes: history preserved, `last_error` and
-- `checkpoint` intact, and no longer counted as pending or quarantined by
-- the alert evaluator or the console. `retireLegacyStageJobs()` in
-- `briefing/jobs.ts` is the only writer. Widening the CHECK is compatible
-- with the running build, which never writes the new value.

ALTER TABLE briefing_job DROP CONSTRAINT IF EXISTS briefing_job_state_is_known;
--> statement-breakpoint
ALTER TABLE briefing_job ADD CONSTRAINT briefing_job_state_is_known
  CHECK (state IN ('pending', 'running', 'completed', 'quarantined', 'discarded'));
