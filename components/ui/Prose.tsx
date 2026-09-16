import React from "react";
import styles from "./prose.module.css";

export type ProseProps = React.HTMLAttributes<HTMLElement> & {
  /** The wrapper's element. `div` by default. */
  as?: React.ElementType;
  /** The measure token. Off by default: the wrapper states no width, because
   *  most callers (the reading shells first) already sit in a measure their
   *  layout owns — and some, the archive indexes, must be free to break out
   *  of it. A caller that wants the primitive to hold the measure picks one:
   *  `reading` (68ch), `wide` (80ch) or `narrow` (54ch). */
  measure?: "reading" | "wide" | "narrow";
};

const MEASURE: Record<NonNullable<ProseProps["measure"]>, string> = {
  reading: "var(--measure-reading)",
  wide: "var(--measure-wide)",
  narrow: "var(--measure-narrow)",
};

/**
 * The running-text wrapper: the measure, the leading, the link and quote
 * grammar of the site's prose, in one class.
 *
 * Server component. The rules are `:where()`-zero-weight, so the surface
 * that mounts this can still speak over any of them through its own class —
 * see the file comment. This is what the reading shells' `.body` block was;
 * the grammar now lives once, and any surface that renders running text
 * outside those shells mounts the same one.
 */
export function Prose({
  as: Component = "div",
  measure,
  className = "",
  children,
  style,
  ...props
}: ProseProps) {
  const classes = [styles.prose, className].filter(Boolean).join(" ");
  return (
    <Component
      className={classes}
      style={measure ? { maxWidth: MEASURE[measure], ...style } : style}
      {...props}
    >
      {children}
    </Component>
  );
}
