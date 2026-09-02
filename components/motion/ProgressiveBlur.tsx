/**
 * ProgressiveBlur — a graded focus fall-off at the edge of a section.
 *
 * Used where one visual system hands off to another and a hard line would
 * expose the seam: the home scene into the editorial band, a scrolling rail
 * into its container's edge.
 *
 * Server component; the stack is entirely CSS. Place inside a
 * `position: relative` host.
 */

import type { CSSProperties } from "react";
import styles from "./progressive-blur.module.css";

export interface ProgressiveBlurProps {
  position?: "bottom" | "top";
  /** Any CSS length or percentage. */
  height?: string;
  className?: string;
}

export function ProgressiveBlur({
  position = "bottom",
  height = "30%",
  className,
}: ProgressiveBlurProps) {
  return (
    <div
      aria-hidden="true"
      className={[styles.blur, styles[position], className].filter(Boolean).join(" ")}
      style={{ "--blur-height": height } as CSSProperties}
    >
      <div className={styles.layer} />
      <div className={styles.layer} />
      <div className={styles.layer} />
      <div className={styles.layer} />
      <div className={styles.layer} />
      <div className={styles.tint} />
    </div>
  );
}
