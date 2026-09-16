import React from "react";
import Link from "next/link";
import { PointerHighlight } from "@/components/motion/PointerHighlight";
import { RecordShare } from "@/components/motion/view-transition";
import { Icon } from "@/components/ui/Icon";
import styles from "./card.module.css";

/**
 * Editorial surface compositions: the hub grammar (lead / row / tile) and the
 * earlier five (feature, list-row, dossier, metric, quiet-note). `panel` maps
 * to feature and `quiet` maps to row so existing types keep compiling. Accent
 * is the top/start rule colour, not a glow.
 *
 * `lead` is a front's lead record and `tile` is a compact pressable plate —
 * the two additions of the 2026-09-16 hub round, which folds the sixteen hub
 * row designs across the four hubs onto three compositions. Cards are for
 * things that are entirely pressable or entirely ledgered; rules and space
 * group content everywhere else, and boxes only appear where the whole card
 * is one link.
 */
export type CardVariant =
  | "feature"
  | "row"
  | "dossier"
  | "metric"
  | "note"
  | "lead"
  | "tile"
  | "panel"
  | "quiet";

export type CardAccent = "none" | "gold" | "ember";

const VARIANT_CLASS: Record<CardVariant, string> = {
  feature: styles.feature,
  row: styles.row,
  dossier: styles.dossier,
  metric: styles.metric,
  note: styles.note,
  lead: styles.lead,
  tile: styles.tile,
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
  /**
   * The ruled ledger: a 24px gold stub under the card's headline that extends
   * to the headline's full width while the card is hovered or holds focus
   * within it. The headline's colour does not change — the rule is the state.
   * Compose it on `row` and `lead`, whose records sit in columns and whose
   * hover state should be one hairline, not a plate.
   */
  ledger?: boolean;
  /** The `to-record` transition type this link declares (stage 7), so the
   *  list → record navigation morphs the record's shared elements. Omitted
   *  — and the transition stays at the root crossfade — for every link that
   *  is not a record. */
  transitionTypes?: string[];
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
  ledger = false,
  transitionTypes,
  as: Component = "div",
  className = "",
  children,
  ...props
}: CardProps) {
  const composition = variant ?? tone ?? "feature";
  const isInteractive = interactive ?? href !== undefined;
  const tracksPointer = isInteractive && (
    composition === "feature" || composition === "panel" || composition === "dossier"
  );

  const classes = [
    styles.card,
    VARIANT_CLASS[composition],
    accent === "none" ? "" : styles[accent],
    isInteractive ? styles.interactive : "",
    tracksPointer ? styles.pointerSurface : "",
    ledger ? styles.ledger : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href !== undefined) {
    return (
      <Link href={href} className={classes} transitionTypes={transitionTypes} {...props}>
        {tracksPointer ? <PointerHighlight /> : null}
        {children}
      </Link>
    );
  }

  return React.createElement(
    Component,
    { className: classes, ...props },
    tracksPointer ? <PointerHighlight /> : null,
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

export function CardEyebrow({
  className = "",
  viewName,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  /** The record's shared kicker name (stage 7) — the eyebrow becomes the
   *  shared element that morphs into the record page's section kicker. */
  viewName?: string | null;
}) {
  return (
    <RecordShare name={viewName}>
      <span className={`${styles.eyebrow} ${className}`.trim()} {...props}>
        {children}
      </span>
    </RecordShare>
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
  viewName,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
  as?: "h2" | "h3" | "h4" | "span" | "p";
  /** The record's shared headline name (stage 7) — the title becomes the
   *  shared element that morphs into the record page's headline. */
  viewName?: string | null;
}) {
  return (
    <RecordShare name={viewName}>
      <Tag className={`${styles.title} ${className}`.trim()} {...props}>
        {children}
      </Tag>
    </RecordShare>
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
  viewName,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  aspectRatio?: string;
  /** The record's shared plate name (stage 7) — the media becomes the
   *  shared element that morphs into the record page's media plate. */
  viewName?: string | null;
}) {
  return (
    <RecordShare name={viewName}>
      <div
        className={`${styles.media} ${className}`.trim()}
        style={{ aspectRatio }}
        {...props}
      >
        {children}
      </div>
    </RecordShare>
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
      <Icon name="arrow-right" size="1em" className={styles.ctaArrow} />
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
