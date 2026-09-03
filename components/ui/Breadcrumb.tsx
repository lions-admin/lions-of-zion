import Link from "next/link";
import styles from "./breadcrumb.module.css";

export interface BreadcrumbCrumb {
  href: string;
  label: string;
}

interface BreadcrumbProps {
  /**
   * Ancestors of this page, nearest the root first. "Home" is implicit and
   * always rendered, so a page one level down passes an empty trail.
   */
  trail?: BreadcrumbCrumb[];
  /** This page. The last segment, and never a link. */
  current: string;
  /**
   * Placement only — where the trail sits in the consuming shell's grid, and
   * how wide it may run. The trail's own typography, link contract, coarse
   * target floor and truncation live here and are not a caller's business.
   */
  className?: string;
}

/**
 * The document trail — one implementation.
 *
 * There were two: `.documentTrail` in `components/sections/sections.module.css`
 * (DocPage and SectionPage) and `.breadcrumb` in the article route's module.
 * They rendered the same markup with the same separators and drifted only in
 * what they had been remembered to carry — the article trail had no
 * reduced-motion rule, so its links kept animating their colour for a reader
 * who asked them not to. Both are this component now (CLEAN-002).
 *
 * The separators are `aria-hidden`: a screen reader gets the links and the
 * `Breadcrumb` label, not a row of slashes.
 */
export function Breadcrumb({ trail, current, className }: BreadcrumbProps) {
  return (
    <nav
      className={[styles.trail, className].filter(Boolean).join(" ")}
      aria-label="Breadcrumb"
    >
      <Link href="/">Home</Link>
      <span aria-hidden="true">/</span>
      {trail?.map((crumb) => (
        <span key={crumb.href} className={styles.segment}>
          <Link href={crumb.href}>{crumb.label}</Link>
          <span aria-hidden="true">/</span>
        </span>
      ))}
      <span className={styles.current}>{current}</span>
    </nav>
  );
}
