import React from "react";
import styles from "./prose.module.css";

/**
 * Running text: the text face, one of the three steps, a reading measure and
 * the paragraph rhythm — plus the rules a passage's own elements need, so a
 * quote, a list or a figure inside a passage is set once rather than per
 * route.
 *
 * The steps are the site's, not this component's: `lede` is the standfirst
 * step, `body` is the reading step, `small` is the apparatus step (a note, a
 * caption row, the second column of a pair). There is no "tiny": the type
 * floor is `--t-body` ≥ 16px on a phone and `--t-small` is lifted to 16px
 * there, and a fourth step below them would be the thing that breaks it.
 *
 * `measure="none"` sets no width, for a passage inside a grid cell that is
 * already the right width.
 */
export type ProseSize = "lede" | "body" | "small";
export type ProseMeasure = "none" | "reading" | "narrow" | "wide";

const SIZE_CLASS: Record<ProseSize, string> = {
  lede: styles.lede,
  body: styles.body,
  small: styles.small,
};

const MEASURE_CLASS: Record<Exclude<ProseMeasure, "none">, string> = {
  reading: styles.reading,
  narrow: styles.narrow,
  wide: styles.wide,
};

export type ProseProps = Omit<React.HTMLAttributes<HTMLElement>, "children"> & {
  size?: ProseSize;
  measure?: ProseMeasure;
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
};

export function Prose({
  size = "body",
  measure = "none",
  as: Component = "div",
  className = "",
  children,
  ...props
}: ProseProps) {
  const classes = [
    styles.prose,
    SIZE_CLASS[size],
    measure === "none" ? "" : MEASURE_CLASS[measure],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return React.createElement(Component, { className: classes, ...props }, children);
}
