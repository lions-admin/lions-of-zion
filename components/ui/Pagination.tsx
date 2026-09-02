import React from "react";
import { ButtonLink } from "./Button";
import styles from "./pagination.module.css";

/**
 * Pagination over a long index — the archives run to ~1,177 records and had
 * no way through them but a 31,000px scroll.
 *
 * **Links, not buttons, deliberately.** Every page is a real URL, so the row
 * works with JavaScript off, a page can be bookmarked and shared, the back
 * button behaves, and a crawler can reach record 900. A pager built from
 * click handlers has none of that. It follows that this component is a server
 * component and safe on every tier.
 *
 * The current page is `aria-current="page"`; the ends are present but inert at
 * the extremes rather than removed, so the row does not shift sideways on the
 * first and last page.
 */
export interface PaginationProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /** 1-based. */
  page: number;
  pageCount: number;
  /** Builds the URL for a page. The caller owns the query shape. */
  hrefForPage: (page: number) => string;
  /** Names the nav for a screen reader listing landmarks — "Testimonies
   *  pages". A page with two pagers must give them different names. */
  label?: string;
  /** How many pages to show either side of the current one. */
  siblings?: number;
}

type Slot = number | "gap";

/**
 * The window: first page, last page, `siblings` either side of the current
 * one, and an elision wherever that skips more than a single page. A gap
 * standing in for exactly one page is replaced by the page itself — "1 … 3"
 * is never shorter than "1 2 3", only more work to read.
 */
export function pageWindow(page: number, pageCount: number, siblings = 1): Slot[] {
  const wanted = new Set<number>([1, pageCount]);
  for (let p = page - siblings; p <= page + siblings; p += 1) {
    if (p >= 1 && p <= pageCount) wanted.add(p);
  }

  const pages = [...wanted].sort((a, b) => a - b);
  const slots: Slot[] = [];
  let previous = 0;

  for (const p of pages) {
    const skipped = p - previous - 1;
    if (previous !== 0 && skipped > 0) {
      if (skipped === 1) slots.push(previous + 1);
      else slots.push("gap");
    }
    slots.push(p);
    previous = p;
  }

  return slots;
}

export function Pagination({
  page,
  pageCount,
  hrefForPage,
  label = "Pages",
  siblings = 1,
  className = "",
  ...props
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const current = Math.min(Math.max(page, 1), pageCount);
  const slots = pageWindow(current, pageCount, siblings);
  const atStart = current <= 1;
  const atEnd = current >= pageCount;

  return (
    <nav
      aria-label={label}
      className={[styles.nav, className].filter(Boolean).join(" ")}
      {...props}
    >
      {/* `list-style: none` drops list semantics in VoiceOver, so the
          role is restored explicitly — a pager is exactly the place a
          listener wants to hear how many items there are. */}
      <ol role="list" className={styles.list}>
        <li className={styles.item}>
          <ButtonLink
            variant="toolbar"
            size="sm"
            href={hrefForPage(Math.max(current - 1, 1))}
            className={atStart ? styles.disabled : ""}
            aria-disabled={atStart || undefined}
            tabIndex={atStart ? -1 : undefined}
            rel="prev"
          >
            <span aria-hidden="true">←</span>
            Previous
          </ButtonLink>
        </li>

        {slots.map((slot, index) =>
          slot === "gap" ? (
            <li key={`gap-${index}`} className={styles.item} aria-hidden="true">
              <span className={styles.gap}>…</span>
            </li>
          ) : (
            <li key={slot} className={styles.item}>
              <ButtonLink
                variant="toolbar"
                size="sm"
                href={hrefForPage(slot)}
                className={[styles.page, slot === current ? styles.current : ""]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={slot === current ? "page" : undefined}
                aria-label={`Page ${slot}`}
              >
                {slot}
              </ButtonLink>
            </li>
          ),
        )}

        <li className={styles.item}>
          <ButtonLink
            variant="toolbar"
            size="sm"
            href={hrefForPage(Math.min(current + 1, pageCount))}
            className={atEnd ? styles.disabled : ""}
            aria-disabled={atEnd || undefined}
            tabIndex={atEnd ? -1 : undefined}
            rel="next"
          >
            Next
            <span aria-hidden="true">→</span>
          </ButtonLink>
        </li>
      </ol>
    </nav>
  );
}
