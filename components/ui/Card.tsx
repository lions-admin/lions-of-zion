import React from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import styles from "./card.module.css";

/**
 * The three editorial compositions, and the whole of the card grammar
 * (2026-09-16, workstream D). Sixteen row designs across the four hubs became
 * these three:
 *
 *   lead   the spread that opens a band — rule and space, never a box: an
 *          optional plate, the headline at the h2 step with the signal stub
 *          under it, the standfirst at the lede step.
 *   row    one record in a ruled ledger: a hairline below, the 24px stub
 *          under the headline that extends to the headline's full measure
 *          on hover and on focus. The rule is the hover state; the headline
 *          keeps its colour.
 *   tile   the one box, and only where the whole thing is pressable — a
 *          plate with a hairline that answers as one control. A tile needs
 *          an `href` (or `interactive`, when the caller owns the semantics).
 *
 * `feature` and `dossier` were the names until 2026-09-16 and still resolve
 * — both onto `tile`, the pressable plate they drew — for the two callers
 * outside this workstream (`components/content/ContentCard.tsx`,
 * `app/fake-resistance/official-narrative/page.tsx`). They go with those
 * callers; nothing new may use them. `PointerHighlight` left the card at the
 * same time: a pointer-following gold wash is a glow, and the identity spends
 * gold as a hairline and one filled control.
 */
export type CardVariant = "lead" | "row" | "tile";

/** @deprecated Resolve to `tile`; kept only for the two callers named above. */
export type LegacyCardVariant = "feature" | "dossier";

export type CardAccent = "none" | "gold" | "ember";

const VARIANT_CLASS: Record<CardVariant, string> = {
  lead: styles.lead,
  row: styles.row,
  tile: styles.tile,
};

const LEGACY_VARIANT: Record<LegacyCardVariant, CardVariant> = {
  feature: "tile",
  dossier: "tile",
};

export function resolveCardVariant(variant: CardVariant | LegacyCardVariant): CardVariant {
  return variant in LEGACY_VARIANT ? LEGACY_VARIANT[variant as LegacyCardVariant] : (variant as CardVariant);
}

type CardOwnProps = {
  variant?: CardVariant | LegacyCardVariant;
  /** Colour of the stub under the headline, and of a tile's top rule. */
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
  variant = "row",
  accent = "none",
  href,
  interactive,
  as: Component = "div",
  className = "",
  children,
  ...props
}: CardProps) {
  const composition = resolveCardVariant(variant);
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
      <Link href={href} className={classes} data-composition={composition} {...props}>
        {children}
      </Link>
    );
  }

  return React.createElement(
    Component,
    { className: classes, "data-composition": composition, ...props },
    children,
  );
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

/** A phrase a person wrote to name the record — a section, a flag, a
 *  status word. The kicker register, never mono. */
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

/** The media plate — `app/globals.css` `.mediaPlate` — sized by the
 *  composition. The picture inside it moves 2% when the record is hovered
 *  or holds keyboard focus, and holds still under reduced motion. */
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
 * the link — so it renders as text with the one arrow, which travels on
 * hover through the global `.arrow` utility, and carries `aria-hidden`
 * because the card's own accessible name already says where it goes.
 */
export function CardCta({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`${styles.cta} ${className}`.trim()} aria-hidden="true" {...props}>
      {children}
      <Icon name="arrow-right" inline className={styles.ctaArrow} />
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
