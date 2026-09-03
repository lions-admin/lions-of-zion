"use client";

/**
 * One conversation, held entirely in this browser.
 *
 * ## Why the thread id is stored locally and never listed
 *
 * `GET /api/v1/chat/threads` exists and this hook must not call it. It returns
 * threads without filtering by creator; what stands between an anonymous
 * caller and other people's transcripts is a row-level-security policy that
 * matches `created_by_label` against `app.identity` — and `app.identity` is an
 * HMAC of the caller's IP address. Everyone behind one household router, one
 * office NAT or one mobile carrier's CGNAT therefore shares an identity, and a
 * thread list would show them each other's questions. So the id is kept in
 * `thread-store.ts`, per browser, and the list endpoint is never touched.
 *
 * The same mechanism has a consequence the UI states rather than hides:
 * **a thread is reachable only from the network it was created on.** Move from
 * wi-fi to mobile data and the transcript 404s. That is the server's rule, not
 * something this hook can paper over, so a 404 clears the stored id and says
 * what happened.
 *
 * ## Why every turn ends in a re-GET
 *
 * `POST …/messages` returns the assistant's message and not the reader's own,
 * which the database persisted a moment earlier. Rendering the POST response
 * alone would drop the question from the transcript. One GET after the turn is
 * the whole reconciliation, and it also picks up the `seq` ordering the
 * database allocated rather than one this client guessed.
 *
 * ## Why `status` is derived and not stored
 *
 * Every phase here is a function of four facts — is there a stored thread, has
 * its transcript been fetched, is a turn in flight, did something fail — so
 * storing a fifth `status` alongside them is a chance for them to disagree.
 * It also removes the effect that would otherwise have to set it, which
 * `react-hooks/set-state-in-effect` correctly refuses.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChatMessageView } from "@/server/contracts/chat";
import { ApiProblem, isAbort, requestJson } from "@/components/search/http";
import { readThread, readThreadOnServer, subscribeToThread, writeThread } from "./thread-store";

export type AskStatus = "idle" | "restoring" | "asking" | "error";

export interface UseAskThread {
  messages: ChatMessageView[];
  status: AskStatus;
  problem: ApiProblem | null;
  /** The question this turn is about: in flight while `asking`, and kept on
   *  the error record so a failed question is still visible. Cleared on
   *  success, cancel, and reset. */
  pending: string | null;
  /** Seconds since the turn started. Real elapsed time, not a fake progress. */
  elapsed: number;
  ask: (question: string) => Promise<void>;
  /**
   * Send the failed question again, unchanged (STATE-003).
   *
   * The composer clears on submit, so after a failure the only surviving copy
   * of what was typed is `pending` — and before this existed, the sole way
   * back from a rate limit or a gateway error was to retype the question from
   * memory. Retry costs nothing typed. No-op unless a turn actually failed.
   */
  retry: () => void;
  /**
   * Take the failed question back out of the error record so it can be edited
   * (STATE-003, the "unless explicitly chosen" half). Clears the error and
   * returns the text for the composer to hold; the turn is not re-sent.
   */
  recall: () => string | null;
  /** Abort the in-flight turn. Not an error: the wait ends and the desk
   *  returns to idle. */
  cancel: () => void;
  /** True when a stored conversation could not be reopened. */
  lostThread: boolean;
  reset: () => void;
}

type ThreadRow = { id: string };
type Transcript = { messages: ChatMessageView[] };

export function useAskThread(): UseAskThread {
  const storedThread = useSyncExternalStore(subscribeToThread, readThread, readThreadOnServer);

  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  /** The thread whose transcript `messages` actually holds. */
  const [loadedThread, setLoadedThread] = useState<string | null>(null);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lostThread, setLostThread] = useState(false);

  const abort = useRef<AbortController | null>(null);
  /* A thread created for a turn that then failed. Kept so a retry reuses it
     rather than spending another of the ten thread creations a minute allows —
     and so the database does not collect an empty thread per failed attempt.
     Not stored: an empty thread is not worth restoring on the next visit. */
  const createdThread = useRef<string | null>(null);

  /* `pending` is also kept after a failed turn so the error record can show
     the question. Asking is the in-flight window only. */
  const asking = pending !== null && problem === null;
  const restoring = Boolean(storedThread) && loadedThread !== storedThread && !asking && !problem;
  const status: AskStatus = problem ? "error" : asking ? "asking" : restoring ? "restoring" : "idle";

  /* Restore. The effect starts work and touches no state synchronously — every
     `setState` below is inside a promise continuation. */
  useEffect(() => {
    if (!storedThread || loadedThread === storedThread) return;
    const controller = new AbortController();

    void (async () => {
      try {
        const transcript = await requestJson<Transcript>(
          `/api/v1/chat/threads/${encodeURIComponent(storedThread)}/messages`,
          { signal: controller.signal },
        );
        setMessages(transcript.messages);
        setLoadedThread(storedThread);
      } catch (cause) {
        if (isAbort(cause)) return;
        if (cause instanceof ApiProblem && cause.code === "NOT_FOUND") {
          writeThread(null);
          setLostThread(true);
          setLoadedThread(null);
          return;
        }
        setProblem(cause instanceof ApiProblem ? cause : null);
      }
    })();

    return () => controller.abort();
  }, [storedThread, loadedThread]);

  /* A real clock. The request reports no progress, so the only honest thing to
     show while it runs is how long it has been running. `elapsed` is zeroed by
     `ask()` rather than here, so this effect only ever writes from its own
     interval callback. */
  useEffect(() => {
    if (!asking) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [asking]);

  const ask = useCallback(
    async (question: string) => {
      const content = question.trim();
      if (!content || asking) return;

      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;

      setProblem(null);
      setLostThread(false);
      setElapsed(0);
      setPending(content);

      let id = storedThread ?? createdThread.current;
      try {
        if (!id) {
          /* Deliberately untitled. `POST /threads` accepts a title, and the
             list endpoint above would expose it to anyone sharing this IP — so
             the question is not put in it. */
          const thread = await requestJson<ThreadRow>("/api/v1/chat/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
            signal: controller.signal,
          });
          id = thread.id;
          createdThread.current = id;
        }

        const path = `/api/v1/chat/threads/${encodeURIComponent(id)}/messages`;
        await requestJson<ChatMessageView>(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
          signal: controller.signal,
        });

        const transcript = await requestJson<Transcript>(path, { signal: controller.signal });
        setMessages(transcript.messages);
        setLoadedThread(id);
        setPending(null);
        /* Stored only once the turn has actually succeeded: a thread whose
           first question failed is not worth restoring on the next visit. */
        writeThread(id);
      } catch (cause) {
        if (isAbort(cause)) {
          setPending(null);
          return;
        }
        /* Keep `pending` so the error record can name the question. Asking
           becomes false because `problem` is set. */
        setProblem(
          cause instanceof ApiProblem
            ? cause
            : new ApiProblem("UNKNOWN", 0, "The question could not be sent."),
        );
      }
    },
    [asking, storedThread],
  );

  /* `ask` refuses to start while `asking`, and `asking` is false the moment
     `problem` is set — so a retry from the error state runs, and a retry
     hammered during a live turn cannot queue a second one. */
  const retry = useCallback(() => {
    if (!pending) return;
    void ask(pending);
  }, [ask, pending]);

  const recall = useCallback(() => {
    const question = pending;
    setProblem(null);
    setPending(null);
    return question;
  }, [pending]);

  const cancel = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    setPending(null);
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    abort.current = null;
    createdThread.current = null;
    setMessages([]);
    setLoadedThread(null);
    setProblem(null);
    setPending(null);
    setLostThread(false);
    writeThread(null);
  }, []);

  return { messages, status, problem, pending, elapsed, ask, retry, recall, cancel, lostThread, reset };
}
