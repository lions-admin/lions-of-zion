import React from "react";
import styles from "./badge.module.css";

/**
 * A chrome status pill: tracked capitals in the data face, one state ramp per
 * tone. A count, a stage, a filter state, a route status.
 *
 * It is **not** an editorial verdict. `components/content/VerificationBadge`
 * renders one of the nine `AssessmentValue`s, is deliberately not a pill and
 * not tracked capitals, and carries the sentence that explains the verdict.
 * That difference is a decision, not an inconsistency — `components/ui/README.md`
 * states the boundary.
 *
 * Tones are named for the token ramps they read (`--state-ok`, `--state-warn`,
 * `--state-danger`), never for what the value means. `verified` and `warning`
 * are the old domain-flavoured names, kept working so the one call site can be
 * migrated by the wave that owns it; they are aliases, not variants.
 */
export type BadgeTone = "neutral" | "gold" | "ember" | "ok" | "warn" | "danger";

/** @deprecated Use `BadgeTone`. */
export type BadgeVariant = BadgeTone | "verified" | "warning";

const TONE_ALIASES: Record<string, BadgeTone> = {
  verified: "ok",
  warning: "warn",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Badge({
  variant = "neutral",
  dot = false,
  className = "",
  children,
  ...props
}: BadgeProps) {
  const tone = TONE_ALIASES[variant] ?? (variant as BadgeTone);
  const classes = [styles.badge, styles[tone], className].filter(Boolean).join(" ");

  return (
    <span className={classes} {...props}>
      {dot ? <span className={styles.dot} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
