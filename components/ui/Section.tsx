import React from "react";
import styles from "./section.module.css";

/**
 * The editorial band: a rule above it, a head, a measure and a rhythm.
 *
 * Every hub and every record ends in bands, and until 2026-09-16 each route
 * stylesheet drew its own — the same rule/space trio written out again with a
 * different token for the hairline. `Section` is that trio, and nothing more:
 * it draws no box, no plate and no background, because a band is marked by a
 * rule and by space (Gestalt — a box only where the whole thing is pressable,
 * which is `Card variant="tile"`).
 *
 * Every prop defaults to the inert value, so `<Section>` alone renders a plain
 * block. That matters for migration: a band adopts the primitive one decision
 * at a time, and a band whose children carry their own margins keeps
 * `flow="none"` and does not change by a pixel.
 */
export type SectionRule = "none" | "hairline" | "strong" | "gold";
export type SectionFlow = "none" | "tight" | "base" | "loose";
export type SectionMeasure = "none" | "reading" | "narrow" | "wide";

const RULE_CLASS: Record<Exclude<SectionRule, "none">, string> = {
  hairline: styles.hairline,
  strong: styles.strong,
  gold: styles.gold,
};

const FLOW_CLASS: Record<Exclude<SectionFlow, "none">, string> = {
  tight: styles.flowTight,
  base: styles.flowBase,
  loose: styles.flowLoose,
};

const MEASURE_CLASS: Record<Exclude<SectionMeasure, "none">, string> = {
  reading: styles.reading,
  narrow: styles.narrow,
  wide: styles.wide,
};

export type SectionProps = Omit<React.HTMLAttributes<HTMLElement>, "children"> & {
  /** The hairline above the band, and whether there is one at all. */
  rule?: SectionRule;
  /** The gap between the band's own children. `none` sets no display. */
  flow?: SectionFlow;
  measure?: SectionMeasure;
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
};

export function Section({
  rule = "none",
  flow = "none",
  measure = "none",
  as: Component = "section",
  className = "",
  children,
  ...props
}: SectionProps) {
  const classes = [
    styles.section,
    rule === "none" ? "" : `${styles.ruled} ${RULE_CLASS[rule]}`,
    flow === "none" ? "" : FLOW_CLASS[flow],
    measure === "none" ? "" : MEASURE_CLASS[measure],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return React.createElement(Component, { className: classes, ...props }, children);
}

/** The band's head: kicker, heading, and the line under it, on one grid. */
export function SectionHead({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${styles.head} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

/** The word above the heading — a phrase a person wrote, so the kicker
 *  register. A machine value (a date, a count) is `.dataMeta`, not this. */
export function SectionKicker({
  as: Component = "span",
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { as?: React.ElementType }) {
  return React.createElement(
    Component,
    { className: `${styles.kicker} ${className}`.trim(), ...props },
    children,
  );
}
