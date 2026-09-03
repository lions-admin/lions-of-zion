import React from "react";
import Link from "next/link";
import styles from "./card.module.css";

/**
 * Editorial surface compositions: feature, list-row, dossier, metric, and
 * quiet-note. `panel` maps to feature and `quiet` maps to row so existing
 * types keep compiling. Accent is the top/start rule colour, not a glow.
 */
export type CardVariant =
  | "feature"
  | "row"
  | "dossier"
  | "metric"
  | "note"
  | "panel"
  | "quiet";

export type CardAccent = "none" | "gold" | "ember";

const VARIANT_CLASS: Record<CardVariant, string> = {
  feature: styles.feature,
  row: styles.row,
  dossier: styles.dossier,
  metric: styles.metric,
  note: styles.note,
  panel: styles.feature,
  quiet: styles.row,
};

type CardOwnProps = {
  variant?: CardVariant;
  /** Alias of `variant` — same five compositions. */
  tone?: CardVariant;
  /** Colour of the accent rule and the eyebrow. */
  accent?: CardAccent;
  /** Renders the whole card as a link and arms the interactive treatment. */
  href?: string;
  /** Arms the interactive treatment without a link. The caller owns the
   *  semantics; a `<div>` with a click handler is not a control. */
  interactive?: boolean;
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
};

export type CardProps = Omit<React.HTMLAttributes<HTMLElement>, "children"> &
  CardOwnProps;

export function Card({
  variant,
  tone,
  accent = "none",
  href,
  interactive,
  as: Component = "div",
  className = "",
  children,
  ...props
}: CardProps) {
  const composition = variant ?? tone ?? "feature";
  const isInteractive = interactive ?? href !== undefined;

  const classes = [
    styles.card,
    VARIANT_CLASS[composition],
    accent === "none" ? "" : styles[accent],
    isInteractive ? styles.interactive : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href !== undefined) {
    return (
      <Link href={href} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return React.createElement(Component, { className: classes, ...props }, children);
}

/** The card's top row: an eyebrow on one edge, a count or a date on the
 *  other, aligned on their baselines. */
export function CardHeader({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${styles.header} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardEyebrow({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`${styles.eyebrow} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

/** A figure that sits beside the eyebrow — "7 files", "2026-08-27". Tabular
 *  by construction so a column of cards lines its numerals up. */
export function CardCount({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`${styles.count} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

export function CardTitle({
  as: Tag = "h3",
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" | "span" | "p" }) {
  return (
    <Tag className={`${styles.title} ${className}`.trim()} {...props}>
      {children}
    </Tag>
  );
}

export function CardDescription({
  className = "",
  clamp = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & {
  /** Truncate to three lines. Opt-in: a card in a fixed-height grid needs it,
   *  a card in a column must not silently truncate a record. */
  clamp?: boolean;
}) {
  const classes = [styles.description, clamp ? styles.clamp : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <p className={classes} {...props}>
      {children}
    </p>
  );
}

export function CardMedia({
  className = "",
  aspectRatio = "16 / 9",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { aspectRatio?: string }) {
  return (
    <div
      className={`${styles.media} ${className}`.trim()}
      style={{ aspectRatio }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * The pinned affordance at a card's foot. Not a control — the card itself is
 * the link — so it renders as text with an arrow that travels on hover, and
 * carries `aria-hidden` because the card's own accessible name already says
 * where it goes.
 */
export function CardCta({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`${styles.cta} ${className}`.trim()} aria-hidden="true" {...props}>
      {children}
      <span className={styles.ctaArrow}>→</span>
    </span>
  );
}

export function CardFooter({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${styles.footer} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
