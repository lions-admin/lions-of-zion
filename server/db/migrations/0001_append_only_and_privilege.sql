-- Custom migration: the rules Drizzle cannot express.
--
-- These are triggers rather than application checks because they are safety
-- controls that must survive a bug in the service layer, a migration script,
-- or a console session. Append-only is a property, not a policy.

-- ── Append-only ──────────────────────────────────────────────────────────────
-- One function, reused by every append-only table. Reusing it means there is
-- exactly one place where "append-only" could ever be weakened, and weakening
-- it there is loud.
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint

CREATE TRIGGER audit_log_is_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint

CREATE TRIGGER entity_version_is_append_only
  BEFORE UPDATE OR DELETE ON entity_version
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint

-- ── Automation may never hold a publishing privilege ─────────────────────────
-- The capability list is duplicated from `NEVER_AUTOMATED_CAPABILITIES` in
-- server/contracts/enums.ts, and a test asserts the two lists match. That
-- duplication is deliberate: the application should refuse before the database
-- has to, and the database refuses anyway.
CREATE OR REPLACE FUNCTION reject_automated_privilege() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  automated boolean;
BEGIN
  SELECT is_automated INTO automated FROM app_user WHERE id = NEW.user_id;
  IF automated AND NEW.capability IN (
        'assessment.publish', 'approval.grant',
        'evidence.restricted.read', 'policy.manage') THEN
    RAISE EXCEPTION
      'capability % may never be granted to an automated identity (%)',
      NEW.capability, NEW.user_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER capability_grant_rejects_automation
  BEFORE INSERT OR UPDATE ON capability_grant
  FOR EACH ROW EXECUTE FUNCTION reject_automated_privilege();
--> statement-breakpoint

-- An identity that is already automated must not be able to acquire
-- privileges by being flipped to automated after the fact, either.
CREATE OR REPLACE FUNCTION reject_automation_flip() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  held text;
BEGIN
  IF NEW.is_automated AND NOT OLD.is_automated THEN
    SELECT capability INTO held FROM capability_grant
      WHERE user_id = NEW.id
        AND capability IN ('assessment.publish', 'approval.grant',
                           'evidence.restricted.read', 'policy.manage')
      LIMIT 1;
    IF held IS NOT NULL THEN
      RAISE EXCEPTION
        'cannot mark % automated while it holds %', NEW.id, held
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER app_user_automation_flip_is_checked
  BEFORE UPDATE ON app_user
  FOR EACH ROW EXECUTE FUNCTION reject_automation_flip();
