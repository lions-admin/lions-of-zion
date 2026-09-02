import React from "react";
import Link from "next/link";
/* Deep import rather than the `@/components/motion` barrel on purpose. The
   barrel re-exports three other client components (`Reveal`, `SignalBeam`,
   `Ticker`); importing it from a server component registers all of them as
   client entries for every route that renders a Card, to use one. */
import { Spotlight } from "@/components/motion/Spotlight";
import styles from "./card.module.css";

export type CardVariant = "default" | "dossier" | "interactive" | "flat";

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  variant?: CardVariant;
  href?: string;
  as?: React.ElementType;
  /**
   * Opt-in cursor response: the surface lifts fractionally and the hairline
   * the card already has brightens along the arc nearest the pointer.
   *
   * Off by default, and deliberately not tied to `interactive` — most cards
   * on this site are editorial content objects, and a tile that lights up
   * when looked at is the wrong claim about an article. Reach for it on a
   * genuinely interactive surface, and leave the rest alone.
   *
   * `interactive` is where it reads best: that variant's surface is
   * translucent, so the wash is visible through it as well as the border arc.
   * On `default` and `dossier` the fill is opaque and only the hairline
   * responds, which is the quieter half and still correct.
   *
   * Ignored on `flat`, which is a bottom rule rather than a box — lighting a
   * four-sided ring around it would draw an edge the card does not have.
   *
   * Costs nothing on touch: `Spotlight` attaches no listener and renders no
   * layers where the pointer is coarse or motion is reduced.
   */
  spotlight?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Card({
  variant = "default",
  href,
  as: Component = "div",
  spotlight = false,
  className = "",
  children,
  ...props
}: CardProps) {
  const cardClasses = [styles.card, styles[variant], className].filter(Boolean).join(" ");

  const card = href
    ? React.createElement(
        Link as React.ElementType,
        { href, className: `${cardClasses} ${styles.linkCard}`, ...props },
        children,
      )
    : React.createElement(Component, { className: cardClasses, ...props }, children);

  if (!spotlight || variant === "flat") return card;

  /* `children` is handed to `Spotlight` as a prop, so everything inside the
     card is still rendered on the server — the wrapper is the only client
     boundary, and this file stays a server component. */
  return <Spotlight className={styles.spotHost}>{card}</Spotlight>;
}

export function CardHeader({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${styles.header} ${className}`} {...props}>
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
    <span className={`${styles.eyebrow} ${className}`} {...props}>
      {children}
    </span>
  );
}

export function CardTitle({
  as: Tag = "h3",
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" | "span" }) {
  return (
    <Tag className={`${styles.title} ${className}`} {...props}>
      {children}
    </Tag>
  );
}

export function CardDescription({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`${styles.description} ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardMedia({
  className = "",
  aspectRatio = "16/9",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { aspectRatio?: string }) {
  return (
    <div
      className={`${styles.media} ${className}`}
      style={{ aspectRatio }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${styles.footer} ${className}`} {...props}>
      {children}
    </div>
  );
}
