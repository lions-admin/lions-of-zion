/**
 * Time and grouping for the updates feed.
 *
 * Everything here is deliberately **absolute**. A relative stamp ("12 minutes
 * ago", "just now") is computed once on the server and then frozen into a page
 * that is cached for up to five minutes and may sit in a tab for an hour — so
 * it is wrong almost immediately, and wrong in the direction that flatters the
 * feed. "Just now" on a half-hour-old page is the small lie this whole surface
 * exists not to tell.
 *
 * One timezone for every reader, named on the page: Asia/Jerusalem is where
 * the desk is and where the day boundaries the feed groups on actually fall.
 */

/** How long a cached read of the published record may be, in seconds. Mirrors
 *  `revalidate: 300` on the `unstable_cache` wrappers in `lib/publications.ts`
 *  — the number the reader is told is the number the code uses. */
export const FEED_REVALIDATE_SECONDS = 300;

const DAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Jerusalem",
});

const CLOCK = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Jerusalem",
});

const STAMP = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jerusalem",
});

/** `2026-09-02` in Jerusalem — the key the feed groups days on. */
export function dayKey(iso: string): string {
  return DAY_KEY.format(new Date(iso));
}

/** `Wednesday, 2 September 2026` — the day heading. */
export function dayLabel(iso: string): string {
  return DAY.format(new Date(iso));
}

/** `14:20` — the row stamp. Tabular by CSS, 24-hour so the column aligns. */
export function clock(iso: string): string {
  return CLOCK.format(new Date(iso));
}

/** `2 Sep 2026, 14:20` — the full stamp, for titles and single-line contexts. */
export function stamp(iso: string): string {
  return STAMP.format(new Date(iso));
}

export interface DayGroup<T> {
  key: string;
  label: string;
  entries: T[];
}

/**
 * Groups an already-ordered list into days without re-sorting it.
 *
 * The API orders `published_at DESC, public_id DESC` and the cursor walks that
 * order; re-sorting here would silently disagree with the pagination and drop
 * or duplicate rows across page boundaries.
 */
export function groupByDay<T>(entries: T[], at: (entry: T) => string): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const entry of entries) {
    const key = dayKey(at(entry));
    const last = groups.at(-1);
    if (last?.key === key) last.entries.push(entry);
    else groups.push({ key, label: dayLabel(at(entry)), entries: [entry] });
  }
  return groups;
}
