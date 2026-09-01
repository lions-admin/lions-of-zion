ALTER TABLE "publication" ADD COLUMN "narrative_watch_details" jsonb;
--> statement-breakpoint
UPDATE "publication"
SET "narrative_watch_details" = jsonb_build_object(
  'exactClaim', coalesce(summary, title),
  'propagators', '[]'::jsonb,
  'arenas', jsonb_build_array(coalesce(arena, 'unspecified')),
  'trendDirection', 'unclear',
  'israeliPosition', NULL,
  'securityContext', NULL,
  'supportingEvidenceIds', '[]'::jsonb,
  'contradictingEvidenceIds', '[]'::jsonb,
  'verificationState', 'unresolved',
  'knownUnknowns', jsonb_build_array('Legacy publication: structured monitoring fields were not captured at creation time.')
)
WHERE section = 'narrative_watch';
--> statement-breakpoint
ALTER TABLE "publication" ADD CONSTRAINT "narrative_watch_details_match_section"
  CHECK ((section = 'narrative_watch') = (narrative_watch_details IS NOT NULL));
