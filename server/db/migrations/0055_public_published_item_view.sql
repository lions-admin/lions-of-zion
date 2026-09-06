-- `published_item` is the deliberately narrow public projection created in
-- 0007. It is a default security-definer view (not `security_invoker`), so
-- the anonymous role needs SELECT on the view itself, not on additional base
-- tables. Without this grant, GET /api/v1/published-items fails once the
-- request wrapper assumes app_public.
GRANT SELECT ON published_item TO app_public;
