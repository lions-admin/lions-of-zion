-- Close the PUBLIC EXECUTE grant on the two `SECURITY DEFINER` prune functions.
--
-- Postgres grants EXECUTE to PUBLIC on every new function by default. A
-- `SECURITY DEFINER` function runs as its owner, so leaving that default in
-- place hands every role a way to run owner-privileged code.
--
-- `0018` closed it correctly for `bump_rate_limit` and `ai_spend_since` — each
-- got a REVOKE and a narrow GRANT — and then did not for the two functions
-- immediately below them. Same file, same pattern, two of four. It reads as an
-- omission rather than a decision.
--
-- Both DELETE: one clears rate-limit windows, the other expired idempotency
-- keys. An anonymous caller able to run `prune_rate_limits()` would reset the
-- counter that limits them. There is no route that executes arbitrary SQL, so
-- this was never reachable — it is defence in depth, and the depth is the
-- point: the next person to copy this pattern should copy the closed one.
--
-- The grant goes to `app_service` alone, verified rather than assumed:
-- `server/core/maintenance.ts` is the only caller, it is reached only from
-- `/api/internal/cron/maintenance`, and `server/http/handler.ts` classifies
-- every `/api/internal/cron/` path as `app_service`. `app_public` and
-- `app_staff` have no reason to prune and no path that does.

REVOKE ALL ON FUNCTION prune_rate_limits(interval) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION prune_rate_limits(interval) TO app_service;
--> statement-breakpoint
REVOKE ALL ON FUNCTION prune_expired_idempotency() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION prune_expired_idempotency() TO app_service;
