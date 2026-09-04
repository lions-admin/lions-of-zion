"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { StatusState, absenceStatus } from "@/components/ui/StatusState";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
import type { PublicationStatus } from "@/server/contracts/enums";
import { AuthRequired } from "./auth-required";
/* `SECTION_LABEL` and `STATUS_LABEL` are re-exported below without being read
   here, so they are not imported; `STAGE_LABEL` is, because `stageLabel()`
   falls back through it. */
import { ABSENCE, LOCALE, STAGE_LABEL, T } from "./lexicon";
import type { ReadState } from "./useConsoleRead";
import { RouteUnavailable } from "./useConsoleRead";
import styles from "./admin.module.css";

/* ── Words ─────────────────────────────────────────────────────────────── */

/* Enum values are the wire format, not operator chrome: `under_review` is
   what is in the column and in the audit log, "בבדיקה" is what the operator
   reads. The three maps live in `lexicon.ts` and are re-exported here rather
   than redeclared, because the failure mode of a console translated across a
   dozen files at once is not a mistranslation — it is two files disagreeing
   about what one status is called. Every panel already imports these three
   from this module, so the re-export keeps that call site while leaving one
   definition of each. */
export { SECTION_LABEL, STAGE_LABEL, STATUS_LABEL } from "./lexicon";

export function stageLabel(stage: string): string {
  return STAGE_LABEL[stage] ?? stage;
}

/* ── Formatting ────────────────────────────────────────────────────────── */

/* `he-IL` orders a date the way an Israeli reader expects and keeps the
   digits Latin, which is what lets a timestamp sit legibly next to the Latin
   identifier it belongs to. */
const dateTime = new Intl.DateTimeFormat(LOCALE, { dateStyle: "short", timeStyle: "short" });
const fullDate = new Intl.DateTimeFormat(LOCALE, { dateStyle: "full" });

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date);
}

export function today(): string {
  return fullDate.format(new Date());
}

/* The dollar sign stays: the budget is denominated in USD, the AI Gateway
   bills in USD, and rendering it as anything else would invent a conversion
   nobody performed. */
export function formatUsd(value: number | null | undefined, digits = 4): string {
  if (value === null || value === undefined) return T.notSet;
  return `$${value.toFixed(digits)}`;
}

/* `ms`, `s` and `min` are SI symbols, not English words — they are written
   this way in Hebrew technical text too, and they are what the same numbers
   are called in the logs these durations come from. Translating a unit
   symbol would make the console and its own log disagree. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

export function formatPercent(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined) return "—";
  return `${Math.round(fraction * 100)}%`;
}

/** How long ago, in the coarse units an operator scans a log by. Prose, so
 *  it is translated; the number inside it stays a Latin digit. */
export function formatAgo(value: string | null | undefined): string {
  if (!value) return T.never;
  const delta = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(delta)) return value;
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "הרגע";
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `לפני ${hours} שע׳`;
  return `לפני ${Math.round(hours / 24)} ימים`;
}

/* ── Cells ─────────────────────────────────────────────────────────────── */

export type PillTone = "ok" | "warn" | "danger" | "neutral" | "gold";

const TONE_CLASS: Record<PillTone, string> = {
  ok: styles.toneOk,
  warn: styles.toneWarn,
  danger: styles.toneDanger,
  neutral: styles.toneNeutral,
  gold: styles.toneGold,
};

export function Metric({ label, value, tone }: { label: string; value: string; tone?: PillTone }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={tone ? TONE_CLASS[tone] : undefined}>{value}</strong>
    </div>
  );
}

/** A status value is data: mono, tabular, coloured by the state ramp, and
 *  always carrying its word — colour is never the only cue. */
export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`${styles.pill} ${TONE_CLASS[tone]}`}>{children}</span>;
}

export function jobTone(state: string): PillTone {
  if (state === "completed") return "ok";
  if (state === "quarantined") return "danger";
  if (state === "running") return "gold";
  return "neutral";
}

export function publicationTone(status: PublicationStatus): PillTone {
  if (status === "published" || status === "updated") return "ok";
  if (status === "approved") return "gold";
  if (status === "archived") return "neutral";
  return "warn";
}

/* ── Operations: busy, notice, error ───────────────────────────────────── */

export type Notice = { kind: "ok" | "error"; text: string };

/**
 * The state every area shares for the operations it runs: one busy flag that
 * disables every control while a request is in flight, one notice line, and
 * one error line. `run()` wraps an operation so the three are always set in
 * the same order and the polite region is always told.
 */
export function useOperations(onAuthRequired?: () => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const fail = useCallback(
    (cause: unknown) => {
      if (cause instanceof AuthRequired) {
        onAuthRequired?.();
        setNotice({ kind: "error", text: "הסשן אינו מחובר עוד. יש להתחבר מחדש כדי להמשיך." });
        return;
      }
      if (cause instanceof RouteUnavailable) {
        setNotice({ kind: "error", text: cause.message });
        return;
      }
      setNotice({ kind: "error", text: cause instanceof Error ? cause.message : "הפעולה נכשלה." });
    },
    [onAuthRequired],
  );

  const run = useCallback(
    async (label: string, operation: () => Promise<string | null>) => {
      setBusy(label);
      setNotice(null);
      try {
        const text = await operation();
        if (text) setNotice({ kind: "ok", text });
      } catch (cause) {
        fail(cause);
      } finally {
        setBusy(null);
      }
    },
    [fail],
  );

  return { busy, disabled: busy !== null, notice, setNotice, run, fail };
}

/**
 * The area's three announcement lines. The pending region is mounted at all
 * times so the polite region exists before it speaks — a live region added
 * at the moment of the announcement is not read.
 */
export function ConsoleNotices({ busy, notice, idPrefix }: { busy: string | null; notice: Notice | null; idPrefix?: string }) {
  return (
    <>
      {notice?.kind === "error" ? (
        <p id={idPrefix ? `${idPrefix}-error` : undefined} className={styles.error} {...assertiveLive}>
          {notice.text}
        </p>
      ) : null}
      {notice?.kind === "ok" ? (
        <p id={idPrefix ? `${idPrefix}-notice` : undefined} className={styles.notice} {...politeLive}>
          {notice.text}
        </p>
      ) : null}
      <p className={styles.consolePending} {...politeLive}>
        {busy ? "פעולה רצה. הפקדים נשארים מושבתים עד שהיא מסתיימת." : ""}
      </p>
    </>
  );
}

/* ── Read gates ────────────────────────────────────────────────────────── */

/**
 * STATE-005, applied to one read. Renders the skeleton, the sign-in state,
 * the not-available state, or the failure — and hands a ready value to the
 * children. The three absences are named, never merged, and the
 * not-available one is worded as a fact about the deployment rather than as
 * a fault.
 */
export function ReadGate<T>({
  state,
  what,
  reload,
  skeleton,
  children,
}: {
  state: ReadState<T>;
  /** The noun the four sentences below complete: "התהליך", "טבלת המקורות".
   *  Definite, and without a leading "את" — `ABSENCE` supplies that. */
  what: string;
  reload: () => void;
  skeleton?: ReactNode;
  children: (value: T) => ReactNode;
}) {
  if (state.kind === "loading") {
    return (
      <SkeletonRegion label={ABSENCE.loading(what)} className={styles.consoleState}>
        {skeleton ?? (
          <>
            <Skeleton shape="block" height="5.5rem" />
            <div className={styles.skeletonGrid}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((cell) => (
                <Skeleton key={cell} shape="block" height="4rem" />
              ))}
            </div>
            <Skeleton shape="block" height="12rem" />
          </>
        )}
      </SkeletonRegion>
    );
  }
  if (state.kind === "auth-required") {
    return (
      <StatusState
        status={absenceStatus("auth-required")}
        className={styles.consoleState}
        eyebrow="סשן"
        title={ABSENCE.authTitle}
        description={ABSENCE.authBody}
        actionText={ABSENCE.authAction}
        actionHref="/admin/login"
      />
    );
  }
  if (state.kind === "unavailable") {
    return (
      <StatusState
        status={absenceStatus("unavailable")}
        className={styles.consoleState}
        eyebrow="לא זמין"
        title={ABSENCE.unavailableTitle(what)}
        description={ABSENCE.unavailableBody}
        actionText={ABSENCE.unavailableAction}
        onAction={reload}
      />
    );
  }
  if (state.kind === "failed") {
    return (
      <StatusState
        status={absenceStatus("unavailable")}
        className={styles.consoleState}
        title={ABSENCE.failedTitle(what)}
        description={state.message}
        actionText={ABSENCE.failedAction}
        onAction={reload}
      />
    );
  }
  return <>{children(state.value)}</>;
}

/** A compact not-available line for a sub-panel that sits inside a larger
 *  area, where the full-height state would push the rest of the area away. */
export function InlineAbsence({ state, what, reload }: { state: ReadState<unknown>; what: string; reload: () => void }) {
  if (state.kind === "loading") {
    return (
      <SkeletonRegion label={ABSENCE.loading(what)} className={styles.inlineSkeleton}>
        <Skeleton shape="text" width="60%" />
        <Skeleton shape="text" width="80%" />
        <Skeleton shape="text" width="45%" />
      </SkeletonRegion>
    );
  }
  if (state.kind === "unavailable") {
    return (
      <p className={styles.absence} {...politeLive}>
        לא זמין בפריסה הזו: המסלול של {what} החזיר 404. שום דבר לא נכשל.
      </p>
    );
  }
  if (state.kind === "auth-required") {
    return (
      <p className={styles.absence} {...politeLive}>
        יש להתחבר כדי לקרוא את {what}.
      </p>
    );
  }
  if (state.kind === "failed") {
    return (
      <p className={styles.error} {...assertiveLive}>
        לא ניתן לקרוא את {what}: {state.message}{" "}
        <button type="button" className={styles.linkButton} onClick={reload}>
          {T.tryAgain}
        </button>
      </p>
    );
  }
  return null;
}

/** The header of one console area: the label, the heading, and the controls
 *  that belong to the whole area rather than to one panel inside it. */
export function AreaHead({ id, label, title, note, children }: { id: string; label: string; title: string; note?: string; children?: ReactNode }) {
  return (
    <div className={styles.panelHead}>
      <div>
        <p className={styles.sectionLabel}>{label}</p>
        <h2 id={`${id}-heading`}>{title}</h2>
        {note ? <p className={styles.muted}>{note}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** A panel's own heading, one level under the area's. */
export function PanelTitle({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className={styles.panelTitle}>
      <h3>{children}</h3>
      {note ? <p className={styles.headNote}>{note}</p> : null}
    </div>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className={styles.muted}>{children}</p>;
}
