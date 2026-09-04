"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
  ConsoleChatThread,
  ConsoleChatThreads,
  ConsoleChatTranscript,
} from "@/server/contracts/admin-console";
import { ConfirmDialog, type ConfirmIntent } from "./ConfirmDialog";
import {
  ConsoleNotices,
  EmptyLine,
  PanelTitle,
  Pill,
  ReadGate,
  formatAgo,
  formatDate,
  formatDuration,
  formatUsd,
  useOperations,
} from "./console-primitives";
import { ABSENCE, SENTENCE, T } from "./lexicon";
import { RouteUnavailable, callConsole, readConsole, type ReadState } from "./useConsoleRead";
import { AuthRequired } from "./auth-required";
import styles from "./admin.module.css";

/**
 * Public-chat moderation — the threads the public chat holds, one expandable
 * transcript at a time, and the one decision a moderator makes: archiving.
 *
 * The list pages by keyset like the audit section does. Expanding a thread
 * holds its transcript read until it is asked for, the way the audit entry's
 * before/after read is held. Archiving is CONFIRMED and danger: it takes the
 * thread out of the public chat's active set for good — the transcript
 * survives, the conversation does not come back — so it goes through the
 * shared confirmation, and a refusal surfaces through `useOperations.fail`
 * like every other operation's.
 */
export function ChatThreadsSection({ signal }: { signal: number }) {
  const [threads, setThreads] = useState<ConsoleChatThread[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "auth-required" | "failed">("loading");
  const [failure, setFailure] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [tick, setTick] = useState(0);
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  /* STATE-004 — the focus fallback, on the section itself. */
  const areaRef = useRef<HTMLElement | null>(null);
  const ops = useOperations();

  useEffect(() => {
    let live = true;
    readConsole<ConsoleChatThreads>(threadsQuery(null))
      .then((page) => {
        if (!live) return;
        setThreads(page.threads);
        setNextCursor(page.nextCursor);
        setState("ready");
      })
      .catch((cause: unknown) => {
        if (!live) return;
        if (cause instanceof AuthRequired) setState("auth-required");
        else if (cause instanceof RouteUnavailable) setState("unavailable");
        else {
          setFailure(cause instanceof Error ? cause.message : `לא ניתן לקרוא את ${T.threadsWhat}.`);
          setState("failed");
        }
      });
    return () => {
      live = false;
    };
  }, [signal, tick]);

  async function loadOlder() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await readConsole<ConsoleChatThreads>(threadsQuery(nextCursor));
      setThreads((current) => [...current, ...page.threads]);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "לא ניתן לקרוא שיחות ישנות יותר.");
    } finally {
      setLoadingMore(false);
    }
  }

  /* Annotated rather than inferred — the same reason AuditSection annotates. */
  const readState: ReadState<ConsoleChatThread[]> =
    state === "loading"
      ? ({ kind: "loading" } as const)
      : state === "ready"
        ? ({ kind: "ready", value: threads } as const)
        : state === "failed"
          ? ({ kind: "failed", message: failure } as const)
          : ({ kind: state } as const);

  return (
    <section className={styles.subArea} aria-label={T.chatThreads} ref={areaRef} tabIndex={-1}>
      <ConsoleNotices busy={ops.busy} notice={ops.notice} idPrefix="threads" />
      <PanelTitle note={`${threads.length} ${T.threads}`}>{T.threadsWhat}</PanelTitle>

      <ReadGate state={readState} what={T.threadsWhat} reload={() => { setState("loading"); setTick((current) => current + 1); }} skeleton={<Skeleton shape="block" height="20rem" />}>
        {(rows) =>
          rows.length ? (
            <>
              <ul className={styles.logList}>
                {rows.map((thread) => (
                  <ThreadRow key={thread.id} thread={thread} disabled={ops.disabled} onArchive={requestArchive} />
                ))}
              </ul>
              <div className={styles.actionRow}>
                {nextCursor ? (
                  <Button variant="secondary" type="button" isLoading={loadingMore} onClick={loadOlder}>
                    {T.loadOlder}
                  </Button>
                ) : (
                  <p className={styles.muted}>זו השיחה הישנה ביותר שהרשימה מגיעה אליה.</p>
                )}
              </div>
            </>
          ) : (
            <EmptyLine>אין שיחות. הקריאה הצליחה והרשימה באמת ריקה.</EmptyLine>
          )
        }
      </ReadGate>

      <ConfirmDialog intent={confirmIntent} onClose={() => setConfirmIntent(null)} fallbackFocusRef={areaRef} />
    </section>
  );

  function threadsQuery(cursor: string | null): string {
    const params = new URLSearchParams();
    params.set("limit", "25");
    if (cursor) params.set("cursor", cursor);
    return `admin/console/chat/threads?${params.toString()}`;
  }

  function requestArchive(thread: ConsoleChatThread) {
    setConfirmIntent({
      action: T.archiveThread,
      target: thread.title ?? T.noTitle,
      targetDetail: `${T.threads} · ${formatDate(thread.createdAt)} · ${thread.messageCount} ${T.messages}`,
      consequence: T.archiveThreadConsequence,
      confirmLabel: T.archiveThread,
      tone: "danger",
      run: () => archiveThread(thread),
    });
  }

  async function archiveThread(thread: ConsoleChatThread) {
    await ops.run(`archive:${thread.id}`, async () => {
      await callConsole(`admin/console/chat/threads/${thread.id}/archive`, {
        method: "POST",
        failure: "לא ניתן לאצור את השיחה.",
      });
      setTick((current) => current + 1);
      return SENTENCE.threadArchived(thread.title ?? T.noTitle);
    });
  }
}

/** The transcript is a held read: fetched the first time a thread is
 *  expanded and kept after — the same seam `useAuditDetail` opens. */
function ThreadRow({
  thread,
  disabled,
  onArchive,
}: {
  thread: ConsoleChatThread;
  disabled: boolean;
  onArchive: (thread: ConsoleChatThread) => void;
}) {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ready"; value: ConsoleChatTranscript }
    | { kind: "failed"; message: string }
  >({ kind: "idle" });

  function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || transcript.kind === "ready" || transcript.kind === "loading") return;
    setTranscript({ kind: "loading" });
    readConsole<ConsoleChatTranscript>(`admin/console/chat/threads/${thread.id}/transcript`)
      .then((value) => setTranscript({ kind: "ready", value }))
      .catch((cause: unknown) =>
        setTranscript({ kind: "failed", message: cause instanceof Error ? cause.message : "לא ניתן לקרוא את התמליל." }),
      );
  }

  return (
    <li>
      <span>
        <Pill tone={thread.archivedAt ? "neutral" : "ok"}>{thread.archivedAt ? T.archived : T.active}</Pill>
      </span>
      <strong>{thread.title ?? T.noTitle}</strong>
      <small>
        {thread.createdByLabel} · {formatDate(thread.createdAt)} · {thread.messageCount} {T.messages} ·{" "}
        {thread.lastMessageAt ? formatAgo(thread.lastMessageAt) : T.none}
      </small>
      <div className={styles.cellActions}>
        <Button variant="ghost" size="sm" type="button" aria-expanded={open} aria-controls={`thread-${thread.id}`} onClick={toggle}>
          {open ? T.close : T.transcript}
        </Button>
        {!thread.archivedAt ? (
          <Button variant="danger" size="sm" type="button" disabled={disabled} onClick={() => onArchive(thread)}>
            {T.archiveThread}
          </Button>
        ) : null}
      </div>
      {/* The id stays mounted in every state so the expander's `aria-controls`
          always points at a live element. */}
      <div id={`thread-${thread.id}`}>
        {open ? (
          <>
            {transcript.kind === "loading" ? (
              <p className={styles.muted} aria-busy="true">
                {ABSENCE.loading(T.transcriptWhat)}…
              </p>
            ) : null}
            {transcript.kind === "failed" ? <p className={styles.error}>{transcript.message}</p> : null}
            {transcript.kind === "ready" ? <TranscriptBody transcript={transcript.value} /> : null}
          </>
        ) : null}
      </div>
    </li>
  );
}

function TranscriptBody({ transcript }: { transcript: ConsoleChatTranscript }) {
  return (
    <div className={styles.traceability}>
      <ol className={styles.plainList}>
        {transcript.messages.map((entry) => (
          <li key={entry.id}>
            <p>
              <strong>{entry.role}</strong> · {formatDate(entry.createdAt)}
            </p>
            <p className={styles.verdictBody}>{entry.content}</p>
            {entry.toolRuns.length ? (
              <div className={styles.chipRow}>
                {entry.toolRuns.map((toolRun, index) => (
                  <span key={`${toolRun.tool}-${index}`} className={styles.chipRow}>
                    <Pill tone={toolRun.status === "ok" ? "ok" : "warn"}>{toolRun.tool}</Pill>
                    <span className={styles.chipNote}>
                      {toolRun.resultCount} פריטים{toolRun.latencyMs === null ? "" : ` · ${formatDuration(toolRun.latencyMs)}`}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
            {entry.run ? (
              <p className={styles.chipNote}>
                {T.modelRun}: {entry.run.model} · {T.tokensIn} <bdi>{entry.run.inputTokens ?? "—"}</bdi> · {T.tokensOut}{" "}
                <bdi>{entry.run.outputTokens ?? "—"}</bdi> · {formatUsd(entry.run.costUsd)}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
