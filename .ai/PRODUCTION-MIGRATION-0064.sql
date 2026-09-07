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
