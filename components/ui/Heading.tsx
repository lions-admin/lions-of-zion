import React from "react";
import styles from "./heading.module.css";

export type HeadingLevel = "h1" | "h2" | "h3" | "h4";

export type HeadingSize = "display" | "h2" | "h3" | "lede" | "figure";

const SIZE_CLASS: Record<HeadingSize, string> = {
  display: styles.display,
  h2: styles.h2,
  h3: styles.h3,
  lede: styles.lede,
  figure: styles.figure,
};

export type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> & {
  /** The semantic level, rendered as the real element. Defaults to `h2`. */
  level?: HeadingLevel;
  /** The visual role (SYS-004). Defaults to the level's own base mapping. */
  size?: HeadingSize;
};

/**
 * A heading whose semantic level and visual size are separate decisions.
 *
 * Server-rendered, token-driven, no client JS. Every other heading on the
 * site renders through the base layer's element mapping; this component is
 * for the places that need the map's other half — a `size` the element does
 * not carry — so a page never has to write its own `font-size` block to get
 * there.
 */
export function Heading({
  level = "h2",
  size,
  className = "",
  children,
  ...props
}: HeadingProps) {
  const Tag: HeadingLevel = level;
  const classes = [size ? SIZE_CLASS[size] : "", className].filter(Boolean).join(" ");
  return (
    <Tag className={classes || undefined} {...props}>
      {children}
    </Tag>
  );
}
