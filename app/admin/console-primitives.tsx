"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { StatusState, absenceStatus } from "@/components/ui/StatusState";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
import type { PublicationSection, PublicationStatus } from "@/server/contracts/enums";
import { AuthRequired } from "./auth-required";
import type { ReadState } from "./useConsoleRead";
import { RouteUnavailable } from "./useConsoleRead";
import styles from "./admin.module.css";

/* ── Words ─────────────────────────────────────────────────────────────── */

/* Enum values are the wire format, not operator chrome. The console reads in
   English words everywhere a status or a section is shown. */
export const STATUS_LABEL: Record<PublicationStatus, string> = {
  draft: "Draft",
  under_review: "In review",
  approved: "Approved",
  published: "Published",
  updated: "Updated",
  archived: "Archived",
};

export const SECTION_LABEL: Record<PublicationSection, string> = {
  daily_brief: "Daily Brief",
  israel_update: "Israel Update",
  war_update: "War Update",
  narrative_watch: "Narrative Watch",
};

export const STAGE_LABEL: Record<string, string> = {
  collect: "Collect",
  enrich: "Enrich",
  cluster: "Cluster",
  triage: "Triage",
  draft: "Draft",
  quality: "Quality",
  publish: "Publish",
};

export function stageLabel(stage: string): string {
  return STAGE_LABEL[stage] ?? stage;
}

/* ── Formatting ────────────────────────────────────────────────────────── */

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" });
const fullDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "full" });

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date);
}

export function today(): string {
  return fullDate.format(new Date());
}

export function formatUsd(value: number | null | undefined, digits = 4): string {
  if (value === null || value === undefined) return "Not set";
  return `$${value.toFixed(digits)}`;
}

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

/** How long ago, in the coarse units an operator scans a log by. */
export function formatAgo(value: string | null | undefined): string {
  if (!value) return "never";
  const delta = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(delta)) return value;
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
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
        setNotice({ kind: "error", text: "This session is no longer signed in. Sign in again to continue." });
        return;
      }
      if (cause instanceof RouteUnavailable) {
        setNotice({ kind: "error", text: cause.message });
        return;
      }
      setNotice({ kind: "error", text: cause instanceof Error ? cause.message : "The operation failed." });
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
        {busy ? "Running an operation. Controls stay disabled until it finishes." : ""}
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
  /** "the pipeline", "the source table" — completes the sentences below. */
  what: string;
  reload: () => void;
  skeleton?: ReactNode;
  children: (value: T) => ReactNode;
}) {
  if (state.kind === "loading") {
    return (
      <SkeletonRegion label={`Loading ${what}`} className={styles.consoleState}>
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
        eyebrow="SESSION"
        title="Sign in to open the console"
        description="This session is not signed in, or it has expired. Nothing is wrong with the console — it refuses to answer an unauthenticated read, which is what it is supposed to do."
        actionText="Go to sign-in"
        actionHref="/admin/login"
      />
    );
  }
  if (state.kind === "unavailable") {
    return (
      <StatusState
        status={absenceStatus("unavailable")}
        className={styles.consoleState}
        eyebrow="NOT AVAILABLE"
        title={`This deployment does not serve ${what} yet`}
        description="The route answered 404. The console is built against the shared contract ahead of every endpoint; the rest of the console keeps working. Nothing has failed."
        actionText="Check again"
        onAction={reload}
      />
    );
  }
  if (state.kind === "failed") {
    return (
      <StatusState
        status={absenceStatus("unavailable")}
        className={styles.consoleState}
        title={`Could not read ${what}`}
        description={state.message}
        actionText="Try again"
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
      <SkeletonRegion label={`Loading ${what}`} className={styles.inlineSkeleton}>
        <Skeleton shape="text" width="60%" />
        <Skeleton shape="text" width="80%" />
        <Skeleton shape="text" width="45%" />
      </SkeletonRegion>
    );
  }
  if (state.kind === "unavailable") {
    return (
      <p className={styles.absence} {...politeLive}>
        Not available in this deployment: the route for {what} answered 404. Nothing has failed.
      </p>
    );
  }
  if (state.kind === "auth-required") {
    return (
      <p className={styles.absence} {...politeLive}>
        Sign in to read {what}.
      </p>
    );
  }
  if (state.kind === "failed") {
    return (
      <p className={styles.error} {...assertiveLive}>
        Could not read {what}: {state.message}{" "}
        <button type="button" className={styles.linkButton} onClick={reload}>
          Try again
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
