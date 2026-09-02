/**
 * BorderBeam — a light travelling the edge of a container that is doing
 * something right now.
 *
 * Not a client component: the whole animation is CSS, so this renders on the
 * server and ships no JavaScript. That is the reason the port was worth
 * doing rather than installing `motion`.
 *
 * Place it inside a `position: relative` host. It is `aria-hidden` and
 * `pointer-events: none`; it decorates a state that is always also stated in
 * text, never the state itself (§28).
 */

import type { CSSProperties } from "react";
import styles from "./border-beam.module.css";

export interface BorderBeamProps {
  /** Length of the travelling head, in px. */
  size?: number;
  /** Seconds for one full circuit. */
  duration?: number;
  /** Seconds. Negative-friendly: offsets a second beam on the same ring. */
  delay?: number;
  /** Border thickness, in px. */
  width?: number;
  /** Starting position on the ring, 0–100. */
  offset?: number;
  reverse?: boolean;
  /** `signal` is the default ink beam; `gold` is reserved, `ember` is hostile. */
  tone?: "signal" | "gold" | "ember";
  className?: string;
}

export function BorderBeam({
  size = 84,
  duration = 7,
  delay = 0,
  width = 1,
  offset = 0,
  reverse = false,
  tone = "signal",
  className,
}: BorderBeamProps) {
  return (
    <span
      aria-hidden="true"
      data-tone={tone === "signal" ? undefined : tone}
      className={[styles.beam, className].filter(Boolean).join(" ")}
      style={
        {
          "--beam-size": `${size}px`,
          "--beam-duration": `${duration}s`,
          "--beam-delay": `${delay}s`,
          "--beam-width": `${width}px`,
          "--beam-offset": `${offset}%`,
        } as CSSProperties
      }
    >
      <span className={[styles.travel, reverse ? styles.reverse : ""].filter(Boolean).join(" ")} />
    </span>
  );
}
