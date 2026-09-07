-- RUN THIS AGAINST THE PRODUCTION NEON BRANCH BEFORE MERGING WAVE 2.
--
-- Branch: feat/production-ux-wave-2 (VA-49).
-- Applied to Preview already, 2026-09-08, and verified present there.
--
-- WHY IT CANNOT WAIT UNTIL AFTER THE MERGE. `media_disposition` is in the
-- drizzle schema, so every SELECT over `publication` names it. Merging the code
-- first makes every article page, every hub and the homepage fail with
-- `errorMissingColumn` until this runs. That is not a guess: it is exactly what
-- happened locally against the un-migrated Preview branch before this was
-- applied there — HTTP 500 on /articles/*.
--
-- All three statements are idempotent. Running it twice is safe.
--
-- HOW TO RUN: Neon Console → the Production branch → SQL Editor → paste → Run.
-- Or `neonctl` if authenticated. Production credentials are Vercel *sensitive*
-- vars and are not readable from the development machine, which is why this is
-- handed over rather than executed.

ALTER TABLE publication ADD COLUMN IF NOT EXISTS media_disposition text;

ALTER TABLE publication DROP CONSTRAINT IF EXISTS publication_media_disposition_known;

ALTER TABLE publication ADD CONSTRAINT publication_media_disposition_known
  CHECK (media_disposition IS NULL
         OR media_disposition IN ('illustrated', 'text_led', 'media_unavailable'));

-- Verify:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'publication' AND column_name = 'media_disposition';
-- One row means it is applied and wave 2 is safe to merge.

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
-- That is what failed the 2026-09-07 22:20 Production build after wave 2
-- merged. The column was applied by hand — because `npm run db:migrate` exits 1
-- with its error swallowed, independently of this migration — so no receipt was
-- written. The guard is correct and caught it; Production simply kept serving
-- the previous build.
--
-- The values are drizzle's own, read with `readMigrationFiles` over
-- server/db/migrations: the hash of 0064's file contents, and the `when` from
-- its entry in meta/_journal.json.

INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
VALUES ('d3c16ab0cd3399a495ac48ff46a22f58235c1d7d9ac6ba9a36366eb06aa015ea', 1788816799443);

-- Verify both halves:
--   SELECT count(*) FROM drizzle.__drizzle_migrations
--   WHERE hash = 'd3c16ab0cd3399a495ac48ff46a22f58235c1d7d9ac6ba9a36366eb06aa015ea';
-- One row, plus the column check above, means the next build will pass.
--
-- Run the same two steps against the Preview branch, or Preview builds fail too.
