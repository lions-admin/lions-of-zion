# Post-autonomy production stabilization audit

Status: in progress. No production data changed by this engineering audit.

## Baseline, 2026-09-07

- Autonomy PR #27 merged into main at `63fb24d8d63787db19b1e171e3d54899e268327d`.
- Production target `dpl_6FCeY9jkAAbrMPbncorqvXphNFDZ` is READY at that SHA.
- Live crons remain ingest twice hourly, embed twice hourly, outbox drain every 15 minutes, maintenance daily.
- `CHATGPT_AUTOMATION_SECRET` is present in Production. Configuration values were not printed.
- Active deployment still logs `briefing.job.failed` after RSS collection: 10:00:50 UTC, job `620bd378-48c3-4679-bd52-5fb8c57d07e8`, 30 items seen. Cause is not exposed by the existing event; persisted job error remains to inspect.
- Latest expected migration: `0062_whole_site_editorial_delivery`. Actual production ledger and schema are not yet verified. Matching deployment SHA is not database proof.

## Migration safety implementation

Production builds now run a read-only migration-receipt and application-column check before Next.js. Migration scripts use the repository's npm package manager and run compatibility verification after migration. Missing target label, connection, migration receipt/hash, or required column fails closed.

Verified locally on Node 24.20.0:

- Five behavior tests cover matching schema, missing latest migration, changed migration hash, dropped `publication.editorial_run_id` with complete ledger, and environment/credential targeting.
- These tests plus existing migration tests: 2 files, 10 tests passed.
- Typecheck passed after fixing the script's environment parameter type.
- Changed test lint and diff whitespace checks passed.
- Local database-free build passed. Existing homepage catalog dynamic-path tracing warning remains; local DB projection fallbacks are expected without credentials.
- Production-mode build without a connection exits 1 at schema preflight, before Next.js.

Still required: target DB verification, enforce compatibility on promotion of an already-built Preview/rollback, and review trigger/policy drift. Build gating alone does not close the promotion bypass. This stage has not been deployed.

## Remaining audit and implementation

All original task requirements remain in scope: legacy authorship retirement and collection root cause; search/outbox reliability; canonical duplicate prevention and reconciliation; developing-story tests; public copy; People legacy routes and taxonomy; safe media/OG; full responsive/interaction review and repeatable commands; focused performance checks; canonical documentation; full verification and PR delivery. No completion claim is made by this interim report.

## Legacy CLI retirement

The legacy compose entrypoint now refuses all non-fixture execution before discovery, model calls or submission. Fixture output remains contract-valid. Three subprocess tests verify normal refusal, dry-run refusal and fixture compatibility. This is only the CLI boundary: the external-publish API, retained service implementation and old delivery workflow registrations still require separate retirement/isolation. Public-copy subagent stopped due to account usage limits; no changes were integrated from it.

## Legacy external-publish route

The authenticated legacy route now returns 412 PRECONDITION_FAILED without parsing or invoking publication/homepage services. Existing public URLs and stored records are unchanged. Six route cases and three CLI cases pass; missing/wrong credentials still return 401. The retained historical service and the separate Codex import path still need classification and retirement review before claiming single-path authorship.

The separate `/api/internal/codex/briefing-import` route is also now an authenticated refusal, with tests covering wrong/missing authorization and rejection before body consumption. Combined route/CLI tests: 11 passed. Retained import/service code is historical; remaining internal call sites and manual publishing actions still need audit. No changes to ChatGPT authentication or whole-site contracts.
