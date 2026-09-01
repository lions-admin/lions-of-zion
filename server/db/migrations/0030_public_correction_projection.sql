CREATE OR REPLACE FUNCTION public_publication_corrections(p_publication_id uuid)
RETURNS TABLE(version integer, changed_at text, summary text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ev.version_number,
         ev.created_at::text,
         ev.change_summary
  FROM entity_version ev
  JOIN publication p ON p.id = ev.entity_id
  WHERE p.id = p_publication_id
    AND p.status IN ('published', 'updated')
    AND ev.version_number > 1
    AND ev.change_source IN ('human_edit', 'correction')
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public_publication_corrections(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public_publication_corrections(uuid) TO app_public, app_staff, app_service;
