"use client";

/**
 * The operations chat.
 *
 * An assistant that can read every console screen and operate the system, in
 * a panel docked beside the areas it acts on. Three things about this surface
 * are load-bearing rather than decorative:
 *
 *  - **A proposal is not an action.** The server never executes an
 *    irreversible tool in the turn the model asks for it; it returns a
 *    pending confirmation. This component turns each one into the same
 *    `ConfirmDialog` every other destructive control on the console uses, so
 *    "the assistant wants to archive this" reads exactly like "you clicked
 *    archive" — same words, same three facts, same deliberate second step.
 *    Approving sends the signed token back; declining sends it back refused,
 *    which is recorded too.
 *  - **The transcript is a record, not the truth.** What actually ran is in
 *    `audit_log`. The tool chips here are a convenience; the System area's
 *    audit panel is the account.
 *  - **A missing endpoint is an ordinary state.** If the deployment does not
 *    serve `ops/capabilities`, the panel says so rather than offering a
 *    composer that cannot send.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusState, absenceStatus } from "@/components/ui/StatusState";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
import { AuthRequired, refusedForAuth } from "./auth-required";
import { ConfirmDialog, type ConfirmIntent } from "./ConfirmDialog";
import { Pill, formatAgo } from "./console-primitives";
import { RouteUnavailable, api, readConsole } from "./useConsoleRead";
import styles from "./admin.module.css";
import type {
  OpsCapabilities,
  OpsChatResponse,
  OpsConfirmation,
  OpsMessage,
} from "@/server/contracts/admin-console";

/** Kept per browser so a reload does not lose the thread. The server holds
 *  no conversation state — the transcript travels with each request. */
const STORAGE_KEY = "loz-ops-chat";
/** What the model is sent as history. Older turns are still shown. */
const HISTORY_TURNS = 24;

type Decision = { id: string; token: string; approved: boolean };

/** Every access guarded: a private window, cleared site data, or a browser
 *  set to block storage all throw rather than return null. */
function readStored(): OpsMessage[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OpsMessage[]) : [];
  } catch {
    return [];
  }
}

function writeStored(messages: OpsMessage[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
  } catch {
    /* A transcript that cannot be cached is still a working chat. */
  }
}

export function OpsChat({ onStateChanged }: { onStateChanged: () => void }) {
  const [capabilities, setCapabilities] = useState<OpsCapabilities | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [messages, setMessages] = useState<OpsMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  /* Proposals from the last turn, answered one at a time. */
  const queue = useRef<OpsConfirmation[]>([]);
  /** Whether the open proposal has already been answered, so a dialog that
   *  closes after "Approve" does not also send a decline. */
  const decided = useRef(false);
  const onDismiss = useRef<() => void>(() => {});
  /* `send` opens the next confirmation and a confirmation's answer is itself
     a `send`, so the two are mutually recursive. The ref is the seam: each
     is declared once and reaches the other through it, rather than one being
     redeclared inside the other on every render. */
  const askNextRef = useRef<(history: OpsMessage[]) => void>(() => {});
  const transcriptEnd = useRef<HTMLDivElement | null>(null);
  /* Where focus lands when a confirmation closes. Unlike every other
     confirmation on the console, this one is not opened by a control the
     operator pressed — it appears when a turn comes back — so there is no
     opener to return to and the panel itself has to be able to take focus. */
  const panelRef = useRef<HTMLElement | null>(null);
  const composer = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    /* Deferred a tick, like every other read on the console: a synchronous
       setState inside an effect cascades a second render before paint, and
       the stored transcript is not worth one. */
    const timer = window.setTimeout(() => {
      setMessages(readStored());
      void readConsole<OpsCapabilities>("admin/ops/capabilities")
        .then(setCapabilities)
        .catch((cause: unknown) => {
          if (cause instanceof RouteUnavailable) setUnavailable(true);
          else if (cause instanceof AuthRequired) setAuthRequired(true);
          else setError(cause instanceof Error ? cause.message : "The operations chat could not be reached.");
        });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (messages.length) writeStored(messages);
    transcriptEnd.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  /**
   * One turn. `history` is what the model is shown; `confirmations` are the
   * operator's decisions on what it proposed last time.
   */
  const send = useCallback(async (text: string, decisions: Decision[], history: OpsMessage[]) => {
    setSending(true);
    setError(null);
    try {
      const response = await fetch(api("admin/ops/chat"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          history: history.slice(-HISTORY_TURNS).map(({ id, role, content, createdAt }) => ({ id, role, content, createdAt })),
          message: text,
          confirmations: decisions,
        }),
      });
      if (refusedForAuth([response])) throw new AuthRequired();
      if (!response.ok) throw new Error("The assistant could not complete that turn.");
      const payload = await response.json() as OpsChatResponse;

      setMessages((current) => [...current, ...payload.messages]);
      if (payload.stateChanged) onStateChanged();

      queue.current = [...queue.current, ...payload.pendingConfirmations];
      askNextRef.current(history.concat(payload.messages));
    } catch (cause) {
      if (cause instanceof AuthRequired) setAuthRequired(true);
      else setError(cause instanceof Error ? cause.message : "The assistant could not complete that turn.");
    } finally {
      setSending(false);
      composer.current?.focus();
    }
  }, [onStateChanged]);

  /**
   * Opens the dialog for the next proposal, if there is one.
   *
   * Whether the operator approves or dismisses, an answer goes back to the
   * server. Cancelling is a decision — a proposal left unanswered would sit
   * signed and valid for ten minutes, and the audit log would record that
   * the assistant asked and nothing happened, which is not the same as
   * recording that a person said no.
   */
  const askNext = useCallback((history: OpsMessage[]) => {
    const next = queue.current.shift();
    if (!next) return;
    decided.current = false;
    const decide = (approved: boolean) => {
      if (decided.current) return;
      decided.current = true;
      void send(approved ? "Confirmed." : "Declined.", [{ id: next.id, token: next.token, approved }], history);
    };
    setConfirmIntent({
      action: next.tool.replaceAll("_", " "),
      target: next.target,
      targetDetail: "Proposed by the operations assistant",
      consequence: next.consequence,
      confirmLabel: "Approve and run",
      tone: "danger",
      run: () => decide(true),
    });
    /* Every close path unmounts the panel, so one handler covers Escape, the
       backdrop, Cancel and a completed run. */
    onDismiss.current = () => decide(false);
  }, [send]);

  useEffect(() => {
    askNextRef.current = askNext;
  }, [askNext]);

  if (authRequired) {
    return (
      <section className={styles.panel} aria-labelledby="ops-chat-heading">
        <p className={styles.sectionLabel} id="ops-chat-heading">Operations chat</p>
        <StatusState
          status={absenceStatus("auth-required")}
          title="Sign in to use the assistant"
          description="The session is not signed in, or it has expired."
          actionText="Go to sign-in"
          actionHref="/admin/login"
        />
      </section>
    );
  }

  if (unavailable) {
    return (
      <section className={styles.panel} aria-labelledby="ops-chat-heading">
        <p className={styles.sectionLabel} id="ops-chat-heading">Operations chat</p>
        <StatusState
          status={absenceStatus("unavailable")}
          title="The operations chat is not available in this deployment"
          description="No assistant endpoint answered. Every other area of the console works without it."
        />
      </section>
    );
  }

  return (
    <section
      className={styles.panel}
      id="console-chat"
      aria-labelledby="ops-chat-heading"
      ref={panelRef}
      tabIndex={-1}
    >
      <div className={styles.panelHead}>
        <div>
          <p className={styles.sectionLabel} id="ops-chat-heading">Operations chat</p>
          <p className={styles.muted}>
            {capabilities
              ? <>Runs on <strong>{capabilities.model}</strong>. Irreversible actions are proposed, never taken.</>
              : "Connecting to the assistant."}
          </p>
        </div>
        <div className={styles.actionRow}>
          {capabilities ? (
            <button
              type="button"
              className={styles.linkButton}
              aria-expanded={toolsOpen}
              onClick={() => setToolsOpen((open) => !open)}
            >
              {toolsOpen ? "Hide" : "Show"} what it can do ({capabilities.tools.length})
            </button>
          ) : null}
          {messages.length ? (
            <Button variant="secondary" size="sm" type="button" onClick={clear}>Clear</Button>
          ) : null}
        </div>
      </div>

      {toolsOpen && capabilities ? (
        <ul className={styles.plainList}>
          {capabilities.tools.map((tool) => (
            <li key={tool.name} className={styles.chipRow}>
              <Pill tone={tool.requiresConfirmation ? "warn" : "neutral"}>{tool.name}</Pill>
              <span className={styles.chipNote}>
                {tool.requiresConfirmation ? "asks first · " : ""}{tool.description}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className={styles.error} {...assertiveLive}>{error}</p> : null}

      <div className={styles.logList} role="log" aria-labelledby="ops-chat-heading">
        {messages.length === 0 && !sending ? (
          <p className={styles.absence}>
            Ask about the pipeline, the sources, today&apos;s queue or the spend. The assistant reads the
            system before it answers, and asks you before it changes anything.
          </p>
        ) : null}

        {messages.map((entry) => (
          <article key={entry.id} className={styles.panel} data-role={entry.role}>
            <p className={styles.sectionLabel}>
              {entry.role === "assistant" ? "Assistant" : entry.role === "tool" ? "Operation" : "You"}
              <span className={styles.chipNote}> · {formatAgo(entry.createdAt)}</span>
            </p>
            <p className={styles.verdictBody}>{entry.content}</p>
            {entry.toolCalls?.length ? (
              <div className={styles.chipRow}>
                {entry.toolCalls.map((call) => (
                  <span key={call.id} className={styles.chipRow}>
                    <Pill tone={call.ok ? "ok" : "danger"}>{call.tool}</Pill>
                    {call.resultSummary ? <span className={styles.chipNote}>{call.resultSummary}</span> : null}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}

        {sending ? <Skeleton shape="block" height="3rem" /> : null}
        <div ref={transcriptEnd} />
      </div>

      <p className={styles.consolePending} {...politeLive}>
        {sending ? "The assistant is working." : ""}
      </p>

      <form className={styles.form} onSubmit={submit}>
        <label className={styles.editorField}>
          <span className={styles.sectionLabel}>Ask the assistant</span>
          <textarea
            ref={composer}
            value={draft}
            rows={3}
            disabled={sending || !capabilities}
            placeholder="Why did today's edition not publish?"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              /* Enter sends; Shift+Enter is a newline. A composer that needs
                 a mouse to send is a composer nobody uses twice. */
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(event);
              }
            }}
          />
        </label>
        <div className={styles.actionRow}>
          <Button variant="primary" type="submit" disabled={sending || !draft.trim() || !capabilities}>
            Send
          </Button>
        </div>
      </form>

      <ConfirmDialog
        intent={confirmIntent}
        fallbackFocusRef={panelRef}
        onClose={() => {
          onDismiss.current();
          setConfirmIntent(null);
        }}
      />
    </section>
  );

  function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || !capabilities) return;
    const entry: OpsMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const history = [...messages, entry];
    setMessages(history);
    setDraft("");
    void send(text, [], history);
  }

  function clear() {
    setMessages([]);
    queue.current = [];
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Nothing to clear if nothing could be stored. */
    }
  }
}
