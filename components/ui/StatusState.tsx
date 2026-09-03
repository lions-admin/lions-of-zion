import React from "react";
import styles from "./status-state.module.css";
import { Button, ButtonLink } from "./Button";

export type StatusKind =
  | "idle"
  | "loading"
  | "processing"
  | "success"
  | "warning"
  | "error"
  | "empty"
  | "disabled";

const STATUS_LABEL: Record<StatusKind, string> = {
  idle: "Idle",
  loading: "Loading",
  processing: "Processing",
  success: "Success",
  warning: "Warning",
  error: "Error",
  empty: "Empty",
  disabled: "Unavailable",
};

/**
 * STATE-005 — why there is nothing to show.
 *
 * "Nothing here" has five different causes on this site and they are not
 * interchangeable. The one that must never be dressed as the others is
 * `unavailable`: a failed read rendered as an empty record turns an outage
 * into a claim about the published body of work — on `/corrections` that
 * claim is "we have never been wrong", and on `/geopolitical-brief` it is
 * "no brief cleared its checks today". Both are false and both are damaging.
 *
 * So the cause is named at the call site and the visual kind is derived from
 * it here, rather than each surface picking a `status` by eye:
 *
 *  - `empty-record`      the read succeeded and the record genuinely holds
 *                        nothing. A real ledger with no rows in it.
 *  - `no-matches`        the record holds rows; this query or filter set
 *                        excluded all of them. Recoverable by the reader, and
 *                        the recovery is always offered.
 *  - `nothing-published` nothing has cleared the publish gate for this
 *                        section yet. Distinct from `empty-record` because
 *                        material exists upstream — it is not public.
 *  - `unavailable`       the read failed, or the service is not connected.
 *                        Not an absence of content. Rendered on the error
 *                        ramp with `role="alert"`.
 *  - `auth-required`     the content exists and this visitor may not see it.
 *                        A warning, not a failure: nothing is broken.
 *
 * The `unavailable → error` row is the load-bearing one; `tests/state-causes.test.ts`
 * pins it so a future edit cannot quietly make an outage look empty.
 */
export type AbsenceCause =
  | "empty-record"
  | "no-matches"
  | "nothing-published"
  | "unavailable"
  | "auth-required";

export const ABSENCE_STATUS: Record<AbsenceCause, StatusKind> = {
  "empty-record": "empty",
  "no-matches": "empty",
  "nothing-published": "empty",
  unavailable: "error",
  "auth-required": "warning",
};

/** The visual/ARIA kind for a stated cause. Never guess one; state the cause. */
export function absenceStatus(cause: AbsenceCause): StatusKind {
  return ABSENCE_STATUS[cause];
}

export interface StatusStateProps {
  status?: StatusKind;
  eyebrow?: string;
  title: string;
  /**
   * Where this state sits in the page's heading order. It defaults to `3`,
   * which is right when the state replaces content already under a section
   * heading — and wrong when it stands directly under the page title, which
   * is what left `/war-update` reading h1 -> h3. The caller knows its own
   * depth; the primitive cannot.
   */
  headingLevel?: 2 | 3 | 4;
  description?: string;
  icon?: React.ReactNode;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export function StatusState({
  status,
  eyebrow,
  title,
  headingLevel = 3,
  description,
  icon,
  actionText,
  actionHref,
  onAction,
  className = "",
}: StatusStateProps) {
  const kind = status ?? "empty";
  const blocking = kind === "error";
  const shownEyebrow = eyebrow ?? (status ? STATUS_LABEL[status] : "ARCHIVE STATUS");
  const busy = kind === "loading" || kind === "processing";
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";

  return (
    <div
      className={[styles.container, styles[kind], className].filter(Boolean).join(" ")}
      role={blocking ? "alert" : "status"}
      aria-busy={busy || undefined}
      data-status={kind}
    >
      <div className={styles.inner}>
        <div className={styles.mark} aria-hidden="true">
          {icon ?? <span className={styles.indicator} />}
        </div>
        {status ? <span className={styles.kind}>{STATUS_LABEL[status]}</span> : null}
        {shownEyebrow ? <span className={styles.eyebrow}>{shownEyebrow}</span> : null}
        <Heading className={styles.title}>{title}</Heading>
        {description ? <p className={styles.description}>{description}</p> : null}
        {actionText ? (
          <div className={styles.action}>
            {actionHref ? (
              <ButtonLink href={actionHref} variant="secondary" size="md">
                {actionText}
              </ButtonLink>
            ) : onAction ? (
              <Button onClick={onAction} variant="secondary" size="md">
                {actionText}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Alias for the async-state anatomy (SYS-010). */
export const AsyncState = StatusState;
export type AsyncStatus = StatusKind;
