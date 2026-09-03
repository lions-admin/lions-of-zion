import React from "react";
import styles from "./badge.module.css";

/**
 * Shared status grammar for evidence, verification, and system chrome.
 * Colour is a ramp; the mark shape and the label are the cues. Content-layer
 * `VerificationBadge` / `EvidenceGrade` still own their copy — they should
 * consume `BADGE_GRAMMAR` when SYS-011 migrates them.
 */

export type BadgeRamp = "neutral" | "gold" | "ember" | "ok" | "warn" | "danger";

export type BadgeMark = "square" | "diamond" | "circle" | "hollow" | "dashed";

export type BadgeDomain = "system" | "evidence" | "verification";

export type BadgeStatus =
  | BadgeRamp
  | "verified"
  | "warning"
  | "idle"
  | "loading"
  | "processing"
  | "success"
  | "error"
  | "empty"
  | "disabled"
  | "false"
  | "misleading"
  | "manipulated"
  | "out_of_context"
  | "contested"
  | "unsupported"
  | "unverified"
  | "satire"
  | "refuted"
  | "disputed"
  | "unresolved"
  | "documented"
  | "observed"
  | "inferred"
  | "high"
  | "medium"
  | "limited"
  | "low";

export type BadgeTone = BadgeRamp;
/** @deprecated Use `BadgeStatus` / `BadgeTone`. */
export type BadgeVariant = BadgeStatus;

export type BadgeGrammar = {
  ramp: BadgeRamp;
  label: string;
  mark: BadgeMark;
  domain: BadgeDomain;
};

export const BADGE_GRAMMAR: Record<BadgeStatus, BadgeGrammar> = {
  neutral: { ramp: "neutral", label: "Note", mark: "hollow", domain: "system" },
  gold: { ramp: "gold", label: "Emphasis", mark: "circle", domain: "system" },
  ember: { ramp: "ember", label: "Contested", mark: "square", domain: "verification" },
  ok: { ramp: "ok", label: "OK", mark: "square", domain: "system" },
  warn: { ramp: "warn", label: "Warning", mark: "diamond", domain: "system" },
  danger: { ramp: "danger", label: "Alert", mark: "square", domain: "system" },
  verified: { ramp: "ok", label: "Verified", mark: "square", domain: "verification" },
  warning: { ramp: "warn", label: "Warning", mark: "diamond", domain: "system" },
  idle: { ramp: "neutral", label: "Idle", mark: "hollow", domain: "system" },
  loading: { ramp: "gold", label: "Loading", mark: "circle", domain: "system" },
  processing: { ramp: "gold", label: "Processing", mark: "circle", domain: "system" },
  success: { ramp: "ok", label: "Success", mark: "square", domain: "system" },
  error: { ramp: "danger", label: "Error", mark: "square", domain: "system" },
  empty: { ramp: "neutral", label: "Empty", mark: "hollow", domain: "system" },
  disabled: { ramp: "neutral", label: "Disabled", mark: "dashed", domain: "system" },
  false: { ramp: "danger", label: "False", mark: "square", domain: "verification" },
  misleading: { ramp: "danger", label: "Misleading", mark: "square", domain: "verification" },
  manipulated: { ramp: "danger", label: "Manipulated", mark: "square", domain: "verification" },
  out_of_context: { ramp: "ember", label: "Out of context", mark: "diamond", domain: "verification" },
  contested: { ramp: "ember", label: "Contested", mark: "diamond", domain: "verification" },
  unsupported: { ramp: "warn", label: "Unsupported", mark: "hollow", domain: "verification" },
  unverified: { ramp: "neutral", label: "Unverified", mark: "hollow", domain: "verification" },
  satire: { ramp: "neutral", label: "Satire", mark: "dashed", domain: "verification" },
  refuted: { ramp: "danger", label: "Refuted", mark: "square", domain: "verification" },
  disputed: { ramp: "warn", label: "Disputed", mark: "diamond", domain: "verification" },
  unresolved: { ramp: "neutral", label: "Unresolved", mark: "hollow", domain: "verification" },
  documented: { ramp: "ok", label: "Documented", mark: "square", domain: "evidence" },
  observed: { ramp: "gold", label: "Observed", mark: "circle", domain: "evidence" },
  inferred: { ramp: "warn", label: "Inferred", mark: "diamond", domain: "evidence" },
  high: { ramp: "ok", label: "High confidence", mark: "square", domain: "evidence" },
  medium: { ramp: "gold", label: "Medium confidence", mark: "circle", domain: "evidence" },
  limited: { ramp: "warn", label: "Limited confidence", mark: "diamond", domain: "evidence" },
  low: { ramp: "warn", label: "Low confidence", mark: "diamond", domain: "evidence" },
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  status?: BadgeStatus;
  domain?: BadgeDomain;
  /** Kept so existing callers compile. The mark is always shown. */
  dot?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function Badge({
  variant = "neutral",
  status,
  domain,
  dot = false,
  className = "",
  children,
  ...props
}: BadgeProps) {
  const key = status ?? variant;
  const grammar = BADGE_GRAMMAR[key] ?? BADGE_GRAMMAR.neutral;
  const ramp = grammar.ramp;
  const mark = grammar.mark;
  const label = children ?? grammar.label;
  const classes = [
    styles.badge,
    styles[ramp],
    styles[mark],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      data-status={key}
      data-domain={domain ?? grammar.domain}
      data-ramp={ramp}
      {...props}
    >
      <span className={styles.mark} data-dot={dot || undefined} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </span>
  );
}
