-- The external briefing ingest route is wrapped by `handler()` as app_service.
-- Migration 0050 created the idempotency ledger after the original role grants,
-- so app_service never received privileges on this table. The route therefore
-- failed on its first INSERT even though the package itself validated.
--
-- Keep this narrow: the service needs to reserve/read/update its own submission
-- ledger rows; no public or staff role needs direct access.
GRANT SELECT, INSERT, UPDATE ON external_briefing_submission TO app_service;
