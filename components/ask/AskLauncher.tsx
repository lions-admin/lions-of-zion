"use client";

/**
 * The way into the desk.
 *
 * A plain link, not a floating chat bubble. `/ask` is a page, and a page is
 * what a reader can bookmark, share, open in a new tab and reach with
 * JavaScript off. The bubble in the corner is also the visual grammar of a
 * support widget, which is the wrong promise for a surface whose output is
 * cited evidence.
 *
 * Exported for Wave B to mount in the header; this wave does not touch
 * `components/site/**`.
 */

import Link from "next/link";
import styles from "./ask.module.css";

export interface AskLauncherProps {
  variant?: "bar" | "icon";
  className?: string;
}

export function AskLauncher({ variant = "bar", className }: AskLauncherProps) {
  return (
    <Link
      href="/ask"
      className={[styles.launcher, className].filter(Boolean).join(" ")}
      data-variant={variant}
    >
      <span className={styles.launcherGlyph} aria-hidden="true">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M2.4 3.4h11.2v7.4H7.2L4 13.4v-2.6H2.4z" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={styles.launcherLabel}>Ask</span>
    </Link>
  );
}
