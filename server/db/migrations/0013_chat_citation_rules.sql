-- Phase 7 rules: a citation must name something retrieval actually returned.

-- ── The tool-run log is append-only ─────────────────────────────────────────
-- It is the evidence that a retrieval happened and what it returned, and the
-- citation check below reads it. A rewritable log would let a fabricated
-- citation be made legitimate after the fact by editing what "was retrieved".
--
-- `message_id` is the one exception: a tool run is written while the turn is
-- still generating, before the assistant message it belongs to exists, so it
-- is linked afterwards. `reject_tool_run_mutation` permits exactly that one
-- transition and nothing else.
CREATE OR REPLACE FUNCTION reject_tool_run_mutation() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.message_id IS NULL
     AND NEW.message_id IS NOT NULL
     AND NEW.id IS NOT DISTINCT FROM OLD.id
     AND NEW.thread_id IS NOT DISTINCT FROM OLD.thread_id
     AND NEW.tool IS NOT DISTINCT FROM OLD.tool
     AND NEW.input IS NOT DISTINCT FROM OLD.input
     AND NEW.output IS NOT DISTINCT FROM OLD.output
     AND NEW.result_document_ids IS NOT DISTINCT FROM OLD.result_document_ids
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'chat_tool_run is append-only; % is not permitted (message_id may be set once)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint

CREATE TRIGGER chat_tool_run_is_append_only
  BEFORE UPDATE OR DELETE ON chat_tool_run
  FOR EACH ROW EXECUTE FUNCTION reject_tool_run_mutation();
--> statement-breakpoint

-- ── A citation must have been retrieved ─────────────────────────────────────
-- This is the load-bearing rule of the whole phase.
--
-- A model asked to answer with sources will, given the chance, produce a
-- citation that looks entirely plausible and refers to something it never
-- saw. On a platform whose subject is fabricated information, shipping
-- fabricated citations is not an embarrassment, it is the product failing at
-- the exact thing it claims to do.
--
-- The foreign key already forces a citation to name a real `search_document`.
-- That is not enough: any real document could be named. What this adds is
-- that the document must appear in the `result_document_ids` of a tool run
-- *in the same thread* — so the model can only cite what retrieval actually
-- handed it during this conversation.
--
-- Checked in the database rather than the service because the service is
-- where a streaming loop, a retry, or a future second entry point could each
-- forget it, and every one of those failures is silent.
CREATE OR REPLACE FUNCTION enforce_citation_was_retrieved() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  msg_thread uuid;
  msg_role text;
  was_retrieved boolean;
BEGIN
  SELECT thread_id, role INTO msg_thread, msg_role
    FROM chat_message WHERE id = NEW.message_id;

  IF msg_thread IS NULL THEN
    RAISE EXCEPTION 'citation names a message that does not exist'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF msg_role <> 'assistant' THEN
    RAISE EXCEPTION 'only an assistant message may carry citations (this one is %)', msg_role
      USING ERRCODE = 'restrict_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM chat_tool_run
    WHERE thread_id = msg_thread
      AND status = 'ok'
      AND NEW.document_id = ANY (result_document_ids)
  ) INTO was_retrieved;

  IF NOT was_retrieved THEN
    RAISE EXCEPTION
      'document % was never returned by a retrieval in thread % and may not be cited',
      NEW.document_id, msg_thread
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER chat_citation_must_be_retrieved
  BEFORE INSERT OR UPDATE ON chat_citation
  FOR EACH ROW EXECUTE FUNCTION enforce_citation_was_retrieved();
--> statement-breakpoint

-- ── Message sequence numbers are allocated, not guessed ─────────────────────
-- Two concurrent writes to one thread would otherwise race for the same seq
-- and one would lose to the unique index. Allocating inside the insert, from
-- the current maximum, makes the ordering the database's problem rather than
-- the caller's.
CREATE OR REPLACE FUNCTION assign_chat_message_seq() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.seq IS NULL OR NEW.seq = 0 THEN
    SELECT COALESCE(MAX(seq), 0) + 1 INTO NEW.seq
      FROM chat_message WHERE thread_id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER chat_message_seq_is_assigned
  BEFORE INSERT ON chat_message
  FOR EACH ROW EXECUTE FUNCTION assign_chat_message_seq();
