/**
 * ShinyText — a two-word status label with a slow pass of light through it.
 *
 * For live, processing, verifying, updating. Server component: the whole
 * effect is CSS. If the label needs to announce a change to assistive tech,
 * the caller owns that with a live region — this does not add one, because
 * most uses are ambient and would otherwise chatter.
 */

import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import styles from "./shiny-text.module.css";

export interface ShinyTextProps extends ComponentPropsWithoutRef<"span"> {
  tone?: "signal" | "gold" | "ember";
  /** Seconds for a full cycle, most of which is rest. */
  duration?: number;
}

export function ShinyText({
  tone = "signal",
  duration = 5,
  className,
  children,
  style,
  ...rest
}: ShinyTextProps) {
  return (
    <span
      className={[styles.shiny, tone === "signal" ? "" : styles[tone], className]
        .filter(Boolean)
        .join(" ")}
      style={{ ...style, "--shiny-duration": `${duration}s` } as CSSProperties}
      {...rest}
    >
      {children}
    </span>
  );
}
