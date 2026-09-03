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

export interface StatusStateProps {
  status?: StatusKind;
  eyebrow?: string;
  title: string;
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
        <h3 className={styles.title}>{title}</h3>
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
