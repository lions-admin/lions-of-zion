import React from "react";
import styles from "./skeleton.module.css";

/**
 * Loading placeholders that match the layout they stand in for.
 *
 * Every shape is `aria-hidden`. Pass `label` on a composed shape (or wrap a
 * group in `SkeletonRegion`) so the region is a `role="status"` and a screen
 * reader hears the wait once. Family compositions match header + content
 * geometry via `--header-h`, `--family-measure`, and `--chrome-w`.
 */

export type SkeletonShape = "text" | "title" | "label" | "block" | "circle";

export interface SkeletonProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  shape?: SkeletonShape;
  /** Any CSS length or percentage. Defaults to filling the container. */
  width?: string;
  /** Only meaningful for `block` and `circle`; the type shapes size
   *  themselves from the type scale so they match the real line box. */
  height?: string;
}

export function Skeleton({
  shape = "text",
  width,
  height,
  className = "",
  style,
  ...props
}: SkeletonProps) {
  const classes = [styles.skeleton, styles[shape], className].filter(Boolean).join(" ");
  return (
    <span
      aria-hidden="true"
      className={classes}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}

export interface SkeletonRegionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** What is loading, as a sentence a listener would accept: "Loading the
   *  testimony index". Omit only when a nearer element already says it. */
  label?: string;
}

/** Marks a group of shapes as one pending region. */
export function SkeletonRegion({
  label,
  className,
  children,
  ...props
}: SkeletonRegionProps) {
  return (
    <div
      role={label ? "status" : undefined}
      aria-busy={label ? true : undefined}
      className={className}
      {...props}
    >
      {label ? <span className={styles.srOnly}>{label}</span> : null}
      {children}
    </div>
  );
}

export interface SkeletonTextProps extends SkeletonRegionProps {
  /** How many lines of running text to hold. */
  lines?: number;
}

/** A paragraph's worth of lines at the body line box, last line short. */
export function SkeletonText({
  lines = 3,
  label,
  className = "",
  ...props
}: SkeletonTextProps) {
  return (
    <SkeletonRegion
      label={label}
      className={[styles.lines, className].filter(Boolean).join(" ")}
      {...props}
    >
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} shape="text" />
      ))}
    </SkeletonRegion>
  );
}

/** Holds the box of a `Card variant="dossier"`: eyebrow, title, two lines of
 *  description, and the pinned call to action. */
export function SkeletonCard({ label, className = "", ...props }: SkeletonRegionProps) {
  return (
    <SkeletonRegion
      label={label}
      className={[styles.card, className].filter(Boolean).join(" ")}
      {...props}
    >
      <Skeleton shape="label" width="7rem" />
      <Skeleton shape="title" width="80%" />
      <Skeleton shape="text" />
      <Skeleton shape="text" width="72%" />
      <Skeleton shape="label" width="9rem" className={styles.cardCta} />
    </SkeletonRegion>
  );
}

/** Holds the box of an archive index row: cover thumbnail, title, excerpt. */
export function SkeletonRow({ label, className = "", ...props }: SkeletonRegionProps) {
  return (
    <SkeletonRegion
      label={label}
      className={[styles.row, className].filter(Boolean).join(" ")}
      {...props}
    >
      <Skeleton shape="block" className={styles.rowThumb} />
      <span className={styles.rowBody}>
        <Skeleton shape="label" width="5rem" />
        <Skeleton shape="title" width="70%" />
        <Skeleton shape="text" width="90%" />
      </span>
    </SkeletonRegion>
  );
}

/**
 * Where the fallback stands.
 *
 * `false` — the default — is the standalone stand-in for a whole page: a full
 * viewport tall, offset by the header, carrying the family scan. `true` is for
 * a fallback nested *inside* a shell that is already in the HTML above it,
 * where that geometry would count the header offset twice and push a viewport
 * of empty tint below real content.
 */
export interface FamilySkeletonProps extends SkeletonRegionProps {
  inline?: boolean;
}

function FamilyShell({
  family,
  label,
  className,
  inline = false,
  children,
  ...props
}: FamilySkeletonProps & { family: "desk" | "dossier" | "institution" }) {
  return (
    <SkeletonRegion
      label={label}
      data-family={family}
      className={[styles.family, inline ? styles.familyInline : "", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <div className={styles.familyChrome}>
        <div className={styles.familyBody}>{children}</div>
      </div>
    </SkeletonRegion>
  );
}

/** Desk family: header offset, wide measure, stacked result rows. */
export function SkeletonDesk({
  label = "Loading the desk",
  className = "",
  ...props
}: FamilySkeletonProps) {
  return (
    <FamilyShell family="desk" label={label} className={className} {...props}>
      <Skeleton shape="label" width="7rem" />
      <Skeleton shape="title" width="42%" />
      <SkeletonText lines={2} />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </FamilyShell>
  );
}

/** Dossier family: header offset, reading measure, title + body + record. */
export function SkeletonDossier({
  label = "Loading the record",
  className = "",
  ...props
}: FamilySkeletonProps) {
  return (
    <FamilyShell family="dossier" label={label} className={className} {...props}>
      <Skeleton shape="label" width="9rem" />
      <Skeleton shape="title" width="70%" />
      <Skeleton shape="text" width="88%" />
      <Skeleton shape="block" className={styles.dossierMedia} />
      <SkeletonText lines={5} />
      <SkeletonCard />
    </FamilyShell>
  );
}

/** Institution family: header offset, quieter column, statement + notes. */
export function SkeletonInstitution({
  label = "Loading the page",
  className = "",
  ...props
}: FamilySkeletonProps) {
  return (
    <FamilyShell family="institution" label={label} className={className} {...props}>
      <Skeleton shape="label" width="8rem" />
      <Skeleton shape="title" width="50%" />
      <SkeletonText lines={4} />
      <Skeleton shape="text" width="40%" />
      <SkeletonText lines={3} />
    </FamilyShell>
  );
}
