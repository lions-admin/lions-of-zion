import React from "react";
import styles from "./badge.module.css";

/**
 * Shared status grammar for evidence, verification, and system chrome.
 *
 * One renderer, one grammar (SYS-011). `VerificationBadge`, `EvidenceGrade`
 * and the roster's identity chip in `components/content` own the copy the
 * reader sees and render through this component; the fact-check desk's
 * verdict marks do the same. Colour is a ramp and never the only cue: the
 * text is required, and the mark is a function of the verdict's *polarity*
 * rather than of its colour, so "Verified" and "False" still differ when the
 * page is printed in greyscale or read under forced colours.
 *
 *   affirming   filled square    verified · documented · high · success · ok
 *   negating    filled diamond   false · misleading · manipulated · refuted ·
 *                                error · danger
 *   uncertain   hollow circle    contested · out of context · disputed ·
 *                                unsupported · unverified · unresolved ·
 *                                limited · low · warn · inferred
 *   other       dashed circle    satire · disabled · idle · empty · neutral
 *   in progress filled circle    loading · processing · emphasis, and the
 *                                middling grades (medium · observed ·
 *                                probable) that are neither a yes nor a no
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
  | "low"
  | "confirmed"
  | "probable";

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
  neutral: { ramp: "neutral", label: "Note", mark: "dashed", domain: "system" },
  gold: { ramp: "gold", label: "Emphasis", mark: "circle", domain: "system" },
  ember: { ramp: "ember", label: "Contested", mark: "hollow", domain: "verification" },
  ok: { ramp: "ok", label: "OK", mark: "square", domain: "system" },
  warn: { ramp: "warn", label: "Warning", mark: "hollow", domain: "system" },
  danger: { ramp: "danger", label: "Alert", mark: "diamond", domain: "system" },
  verified: { ramp: "ok", label: "Verified", mark: "square", domain: "verification" },
  warning: { ramp: "warn", label: "Warning", mark: "hollow", domain: "system" },
  idle: { ramp: "neutral", label: "Idle", mark: "dashed", domain: "system" },
  loading: { ramp: "gold", label: "Loading", mark: "circle", domain: "system" },
  processing: { ramp: "gold", label: "Processing", mark: "circle", domain: "system" },
  success: { ramp: "ok", label: "Success", mark: "square", domain: "system" },
  error: { ramp: "danger", label: "Error", mark: "diamond", domain: "system" },
  empty: { ramp: "neutral", label: "Empty", mark: "dashed", domain: "system" },
  disabled: { ramp: "neutral", label: "Disabled", mark: "dashed", domain: "system" },
  false: { ramp: "danger", label: "False", mark: "diamond", domain: "verification" },
  misleading: { ramp: "danger", label: "Misleading", mark: "diamond", domain: "verification" },
  manipulated: { ramp: "danger", label: "Manipulated", mark: "diamond", domain: "verification" },
  out_of_context: { ramp: "ember", label: "Out of context", mark: "hollow", domain: "verification" },
  contested: { ramp: "ember", label: "Contested", mark: "hollow", domain: "verification" },
  unsupported: { ramp: "warn", label: "Unsupported", mark: "hollow", domain: "verification" },
  unverified: { ramp: "neutral", label: "Unverified", mark: "hollow", domain: "verification" },
  satire: { ramp: "neutral", label: "Satire", mark: "dashed", domain: "verification" },
  refuted: { ramp: "danger", label: "Refuted", mark: "diamond", domain: "verification" },
  disputed: { ramp: "warn", label: "Disputed", mark: "hollow", domain: "verification" },
  unresolved: { ramp: "neutral", label: "Unresolved", mark: "hollow", domain: "verification" },
  documented: { ramp: "ok", label: "Documented", mark: "square", domain: "evidence" },
  observed: { ramp: "gold", label: "Observed", mark: "circle", domain: "evidence" },
  inferred: { ramp: "warn", label: "Inferred", mark: "hollow", domain: "evidence" },
  high: { ramp: "ok", label: "High confidence", mark: "square", domain: "evidence" },
  medium: { ramp: "gold", label: "Medium confidence", mark: "circle", domain: "evidence" },
  limited: { ramp: "warn", label: "Limited confidence", mark: "hollow", domain: "evidence" },
  low: { ramp: "warn", label: "Low confidence", mark: "hollow", domain: "evidence" },
  /* The roster's identity resolution (`CaseEntity.identityStatus`): a grade of
     how well the research knows who is behind an account, which is why it is
     filed under evidence and not verification. `unresolved` is shared with the
     narrative states above and reads the same either way. */
  confirmed: { ramp: "ok", label: "Confirmed", mark: "square", domain: "evidence" },
  probable: { ramp: "gold", label: "Probable", mark: "circle", domain: "evidence" },
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
      data-mark={mark}
      {...props}
    >
      <span className={styles.mark} data-dot={dot || undefined} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </span>
  );
}
