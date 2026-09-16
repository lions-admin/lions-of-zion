import React from "react";
import styles from "./section.module.css";

/**
 * The one heading renderer.
 *
 * `level` is the rank a screen reader gets; `size` is the step a reader sees.
 * They are separate because they are separate decisions — the second record
 * in a ledger is an `h3` at the `h2` step, the bridge at the foot of a hub is
 * an `h2` at the `h3` step — and welding them together is what produced every
 * hand-rolled `.x h3 { font-size: var(--t-h2) … }` block in the route CSS.
 *
 * `level="none"` renders a `<span>`: the visual rank without the semantic one,
 * for a headline inside a `<summary>` or a `<figcaption>`, where a heading
 * element would lie about the document outline. `size` is required there,
 * because there is no level to take it from.
 *
 * When `size` matches the level's own step the class is still applied and is
 * simply what `@layer base` in `app/globals.css` already says — which is why
 * a route stylesheet that restated those four properties could delete them
 * rather than adopt this component.
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** The three steps `app/globals.css` defines. A fourth is a token decision. */
export type HeadingSize = "display" | "h2" | "h3";

const SIZE_CLASS: Record<HeadingSize, string> = {
  display: styles.display,
  h2: styles.h2,
  h3: styles.h3,
};

const LEVEL_SIZE: Record<HeadingLevel, HeadingSize> = {
  1: "display",
  2: "h2",
  3: "h3",
  4: "h3",
  5: "h3",
  6: "h3",
};

type HeadingBase = Omit<React.HTMLAttributes<HTMLHeadingElement>, "children"> & {
  className?: string;
  children: React.ReactNode;
};

export type HeadingProps = HeadingBase &
  (
    | { level: HeadingLevel; size?: HeadingSize }
    | { level: "none"; size: HeadingSize }
  );

export function Heading({
  level,
  size,
  className = "",
  children,
  ...props
}: HeadingProps) {
  const Tag = level === "none" ? "span" : (`h${level}` as const);
  /* `level="none"` requires `size` in the prop type, so the left side of the
     `??` is always present in that case and the map is never reached with it. */
  const step: HeadingSize = size ?? LEVEL_SIZE[level as HeadingLevel];
  const classes = [styles.heading, SIZE_CLASS[step], className]
    .filter(Boolean)
    .join(" ");

  return React.createElement(Tag, { className: classes, ...props }, children);
}
