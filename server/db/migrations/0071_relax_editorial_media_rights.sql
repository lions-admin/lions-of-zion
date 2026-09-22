-- Unknown editorial-media rights are displayable by project policy.
-- Only explicitly withdrawn media is hidden from public readers.
ALTER TABLE editorial_media DROP CONSTRAINT IF EXISTS editorial_media_cleared_media_is_dated;--> statement-breakpoint
DROP POLICY IF EXISTS editorial_media_public_read ON editorial_media;--> statement-breakpoint
CREATE POLICY editorial_media_public_read ON editorial_media
  FOR SELECT TO app_public
  USING (rights_status <> 'withdrawn');
