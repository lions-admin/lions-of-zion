-- Phase 3 rules: append-only for the two logs a service bug or a console
-- session must not be able to rewrite.

CREATE TRIGGER source_fetch_is_append_only
  BEFORE UPDATE OR DELETE ON source_fetch
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
--> statement-breakpoint

CREATE TRIGGER evidence_provenance_is_append_only
  BEFORE UPDATE OR DELETE ON evidence_provenance
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
