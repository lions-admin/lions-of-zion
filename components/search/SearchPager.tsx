"use client";

/**
 * Paging through a result set, for a list that had no way past its first
 * twenty-five.
 *
 * `useSearch` hard-coded `LIMIT = 25` and the contract had no offset at all, so
 * twenty-five was not a page — it was the end of the corpus as far as any
 * reader could tell. The panel now asks for ten at a time and this is how the
 * reader asks for the next ten.
 *
 * ## Buttons, where the site's other pager uses links
 *
 * `components/ui/Pagination` is built from `ButtonLink` on purpose: an archive
 * page is server-rendered, so every page of it is a real URL that works without
 * JavaScript, can be bookmarked, and can be crawled. None of that is available
 * here. Search runs entirely in the browser against a rate-limited endpoint —
 * the `<noscript>` block on `/search` says so and hands over a static index
 * instead — so a pager built from links would offer a no-JS reader a row of
 * addresses that render the same empty panel, and would cost every other reader
 * a server round trip to change a number the client already holds.
 *
 * What is borrowed is the part that is genuinely shared: `pageWindow`, the
 * first/last/siblings elision. Two implementations of "1 2 3 … 9" drift.
 *
 * The page *is* still mirrored into the address bar by `SearchPageView`, so a
 * result set stays linkable — through `history.replaceState`, which updates the
 * URL without re-running the server component.
 */

import { Button } from "@/components/ui/Button";
import { pageWindow } from "@/components/ui/Pagination";
import { Icon } from "@/components/ui/Icon";
import styles from "./search.module.css";

interface SearchPagerProps {
  /** 0-based, as `useSearch` holds it. Rendered 1-based. */
  page: number;
  pageCount: number;
  onSelect: (page: number) => void;
  /** Names the nav in a screen reader's landmark list. */
  label: string;
  /** Dims the row while a newer request is in flight, matching the list. */
  busy: boolean;
}

export function SearchPager({ page, pageCount, onSelect, label, busy }: SearchPagerProps) {
  if (pageCount <= 1) return null;

  const current = Math.min(Math.max(page, 0), pageCount - 1) + 1;
  const slots = pageWindow(current, pageCount, 1);
  const atStart = current <= 1;
  const atEnd = current >= pageCount;

  return (
    <nav className={styles.pager} aria-label={label} data-busy={busy ? "" : undefined}>
      {/* `list-style: none` drops list semantics in VoiceOver, so the role is
          restored explicitly — a pager is exactly where a listener wants to
          hear how many there are. */}
      <ol role="list" className={styles.pagerList}>
        <li>
          <Button
            type="button"
            variant="toolbar"
            size="sm"
            className={styles.pagerStep}
            /* Disabled at the ends rather than removed, so the row does not
               shift sideways under the pointer between the first page and the
               second. Really `disabled`, not `aria-disabled`: unlike the
               archive pager — where the ends are links a reader might still
               want to copy — there is nothing here for the control to do, and
               a focusable no-op costs a keyboard reader a stop on every page. */
            disabled={atStart}
            aria-label="Previous page of results"
            onClick={() => onSelect(current - 2)}
          >
            <Icon name="arrow-left" size={14} />
            <span className={styles.pagerStepLabel}>Previous</span>
          </Button>
        </li>

        {slots.map((slot, index) =>
          slot === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true">
              <span className={styles.pagerGap}>…</span>
            </li>
          ) : (
            <li key={slot}>
              {/* `aria-current="page"` and not `Button`'s `isActive`: this is
                  navigation within one result set, not a toggle, and passing
                  `isActive` would emit `aria-pressed="false"` on every page a
                  reader is not on. The current page is marked by weight, ink
                  and a rule under the number — never by colour alone. */}
              <Button
                type="button"
                variant="toolbar"
                size="sm"
                className={styles.pagerPage}
                aria-current={slot === current ? "page" : undefined}
                aria-label={`Page ${slot} of ${pageCount}`}
                onClick={() => onSelect(slot - 1)}
              >
                {slot}
              </Button>
            </li>
          ),
        )}

        <li>
          <Button
            type="button"
            variant="toolbar"
            size="sm"
            className={styles.pagerStep}
            disabled={atEnd}
            aria-label="Next page of results"
            onClick={() => onSelect(current)}
          >
            <span className={styles.pagerStepLabel}>Next</span>
            <Icon name="arrow-right" size={14} />
          </Button>
        </li>
      </ol>
    </nav>
  );
}
