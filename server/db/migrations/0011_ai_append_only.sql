-- Phase 6 rules: the AI record cannot be rewritten after the fact.

-- ── prompt_registry and ai_run are append-only ──────────────────────────────
-- The two remaining tables from the plan's list of six. An editable prompt
-- version is the worse of the two: an assessment may cite `extract.claim v3`,
-- and if v3's template can change afterwards, the citation points at
-- something that is no longer what produced the result. That is worse than
-- not citing a prompt at all, because it reads as provenance.
--
-- `ai_run` is append-only for the same reason `audit_log` is: it is the
-- record of what was spent and what was sent, and a cost ledger that can be
-- edited is not a ledger.
CREATE TRIGGER prompt_registry_is_append_only
  BEFORE UPDATE OR DELETE ON prompt_registry
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint

CREATE TRIGGER ai_run_is_append_only
  BEFORE UPDATE OR DELETE ON ai_run
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint

-- ── Activating a prompt version is the one sanctioned mutation ──────────────
-- Append-only above would also block setting `activated_at`, so activation is
-- done by this function, which is the only thing permitted to touch it. It
-- deactivates the previous version and activates the new one in one
-- statement pair, inside the caller's transaction, so the partial unique
-- index `prompt_registry_one_active_per_slug` never sees two.
CREATE OR REPLACE FUNCTION activate_prompt(p_slug text, p_version int) RETURNS uuid
  LANGUAGE plpgsql AS $$
DECLARE
  target uuid;
BEGIN
  SELECT id INTO target FROM prompt_registry
    WHERE slug = p_slug AND version = p_version;
  IF target IS NULL THEN
    RAISE EXCEPTION 'no prompt % version %', p_slug, p_version
      USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM set_config('app.activating_prompt', 'on', true);
  UPDATE prompt_registry SET activated_at = NULL
    WHERE slug = p_slug AND activated_at IS NOT NULL;
  UPDATE prompt_registry SET activated_at = now() WHERE id = target;
  PERFORM set_config('app.activating_prompt', 'off', true);

  RETURN target;
END;
$$;
--> statement-breakpoint

-- The append-only trigger has to let that one function through. Same shape as
-- `app.syncing_derived` on information_item: one named, greppable bypass
-- rather than a general exemption for the column.
CREATE OR REPLACE FUNCTION reject_prompt_mutation() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(current_setting('app.activating_prompt', true), '') = 'on'
     AND NEW.id IS NOT DISTINCT FROM OLD.id
     AND NEW.slug IS NOT DISTINCT FROM OLD.slug
     AND NEW.version IS NOT DISTINCT FROM OLD.version
     AND NEW.template IS NOT DISTINCT FROM OLD.template
     AND NEW.kind IS NOT DISTINCT FROM OLD.kind
     AND NEW.model_profile IS NOT DISTINCT FROM OLD.model_profile THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'prompt_registry is append-only; % is not permitted (use activate_prompt to change which version is active)',
    TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint

DROP TRIGGER prompt_registry_is_append_only ON prompt_registry;
--> statement-breakpoint

CREATE TRIGGER prompt_registry_is_append_only
  BEFORE UPDATE OR DELETE ON prompt_registry
  FOR EACH ROW EXECUTE FUNCTION reject_prompt_mutation();
--> statement-breakpoint

-- ── Spend, per window ──────────────────────────────────────────────────────
-- The budget guard's only query, as a function so the window arithmetic lives
-- in one place rather than in whichever caller asked last. Returns 0 rather
-- than NULL for an empty window, so callers never have to coalesce a ceiling
-- comparison — `NULL > limit` is NULL, which is not false, and that is the
-- kind of subtlety that turns a spending cap off silently.
CREATE OR REPLACE FUNCTION ai_spend_since(since timestamptz) RETURNS numeric
  LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(cost_usd), 0)::numeric
  FROM ai_run
  WHERE created_at >= since AND status = 'ok';
$$;
