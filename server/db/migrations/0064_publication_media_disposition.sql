-- VA-49. Why a record has no picture, recorded on the record.
--
-- `media = null` was produced by at least four different causes with no way to
-- tell them apart: no media was supplied, media was supplied and refused on
-- rights, the fetch failed, or the stored row failed projection. The only
-- signal that existed was `MediaWarning.publicationProceededWithoutNewMedia`,
-- which lives in the run report's JSON and is never written to the record — so
-- the moment the report scrolled past, the difference between "an editor chose
-- text" and "we tried and failed" was gone.
--
-- This is a *state*, not a gate. The owner ruled on 2026-09-07 that a picture
-- is not a condition of publishing or of a homepage slot ("remove the
-- homepage-safe restrictions"), and nothing here reintroduces one: a record
-- with any disposition still publishes, still reaches its hub, and still takes
-- a homepage slot. What changes is that a later run can tell which records are
-- worth retrying, and the report can say which are deliberate.
--
-- Nullable on purpose. Every row that predates this migration carries NULL,
-- which reads as "not recorded" and must never be read as "deliberate" — the
-- same strict-side rule `evidenceBasis` follows.

ALTER TABLE publication ADD COLUMN IF NOT EXISTS media_disposition text;
--> statement-breakpoint
ALTER TABLE publication DROP CONSTRAINT IF EXISTS publication_media_disposition_known;
--> statement-breakpoint
ALTER TABLE publication ADD CONSTRAINT publication_media_disposition_known
  CHECK (media_disposition IS NULL
         OR media_disposition IN ('illustrated', 'text_led', 'media_unavailable'));
