import React from "react";
import Link from "next/link";
import styles from "./card.module.css";

/**
 * The chrome surface primitive: a container with a hairline, a state matrix
 * and an optional accent rule. Three anatomies, all traced from surfaces that
 * ship — see the header of `card.module.css`.
 *
 * It is deliberately not the editorial card. A record with an eyebrow, a
 * title, a body and a citation is `components/content/ContentCard`, which
 * renders an `<article>` and knows the publication's vocabulary. This one
 * knows surfaces, hairlines, focus and lift, and nothing about what it holds.
 * `components/ui/README.md` states the boundary and where each belongs.
 */
export type CardVariant = "panel" | "dossier" | "quiet";
export type CardAccent = "none" | "gold" | "ember";

type CardOwnProps = {
  variant?: CardVariant;
  /** The colour of the top rule and the eyebrow. Sections own their accent;
   *  the primitive does not bake one in. */
  accent?: CardAccent;
  /** Renders the whole card as a link and arms the interactive treatment. */
  href?: string;
  /** Arms the interactive treatment without a link — for a card whose whole
   *  surface is a button or a label. The caller owns the semantics; a `<div>`
   *  with a click handler is not a control. */
  interactive?: boolean;
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
};

export type CardProps = Omit<React.HTMLAttributes<HTMLElement>, "children"> &
  CardOwnProps;

export function Card({
  variant = "panel",
  accent = "none",
  href,
  interactive,
  as: Component = "div",
  className = "",
  children,
  ...props
}: CardProps) {
  const isInteractive = interactive ?? href !== undefined;

  const classes = [
    styles.card,
    styles[variant],
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
 * where it goes. A second announcement of "Open the file" would make every
 * card in a grid read identically.
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
