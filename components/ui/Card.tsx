import React from "react";
import Link from "next/link";
import styles from "./card.module.css";

export type CardVariant = "default" | "dossier" | "interactive" | "flat";

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  variant?: CardVariant;
  href?: string;
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
}

export function Card({
  variant = "default",
  href,
  as: Component = "div",
  className = "",
  children,
  ...props
}: CardProps) {
  const cardClasses = [styles.card, styles[variant], className].filter(Boolean).join(" ");

  if (href) {
    return React.createElement(
      Link as React.ElementType,
      { href, className: `${cardClasses} ${styles.linkCard}`, ...props },
      children,
    );
  }

  return React.createElement(Component, { className: cardClasses, ...props }, children);
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
