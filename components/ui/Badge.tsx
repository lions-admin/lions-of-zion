import React from "react";
import styles from "./badge.module.css";

export type BadgeVariant = "gold" | "verified" | "neutral" | "warning" | "danger";

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
  const classes = [styles.badge, styles[variant], className].filter(Boolean).join(" ");

  return (
    <span className={classes} {...props}>
      {dot ? <span className={styles.dot} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
