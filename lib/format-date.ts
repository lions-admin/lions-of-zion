/**
 * The one reader-facing date policy.
 *
 * Every date a reader sees on the public site is **absolute**, in **one
 * timezone**, in **one locale**. Absolute for the reason `components/live/
 * feed-time.ts` gives: a page is rendered once on the server, cached for
 * minutes and left open for hours, so "12 minutes ago" is wrong almost
 * immediately and wrong in the direction that flatters the desk. One
 * timezone — Asia/Jerusalem, where the desk is and where the edition's day
 * boundary falls — so the same record is dated the same way for every reader
 * and on every render (a server component's string never re-formats in a
 * browser, so a zone that followed the reader would hydrate to a different
 * one: VA-43). One locale, en-GB, so day precedes month everywhere and the
 * hubs, the article page and the homepage cannot disagree about the shape of
 * a date.
 *
 * The exception is deliberate and named: `formatSourceDay` prints a
 * publisher-stated date in UTC, because it is the publisher's calendar day,
 * not the desk's clock.
 *
 * Invalid input is returned as it came. A record whose stamp cannot be parsed
 * is a data problem to surface, not a page to crash.
 */

const ZONE = "Asia/Jerusalem";

/** Named once on the page beside a clock so a reader knows whose 17:07 it is. */
export const ISRAEL_TIME_SUFFIX = " · Israel time";

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: ZONE,
});

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: ZONE,
});

const EDITION = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: ZONE,
});

const SOURCE_DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function parse(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `12 Sept 2026` — a day, in Jerusalem. */
export function formatDay(iso: string): string {
  const date = parse(iso);
  return date ? DAY.format(date) : iso;
}

/** `12 Sept 2026, 17:07` — a day and a 24-hour clock, in Jerusalem. */
export function formatDateTime(iso: string): string {
  const date = parse(iso);
  return date ? DATE_TIME.format(date) : iso;
}

/**
 * `Sat 12 Sept 2026` — an edition's calendar date, from its `YYYY-MM-DD`.
 *
 * The date is anchored at 09:00 UTC, which is noon in Jerusalem in summer and
 * 11:00 in winter — inside the named day either way. Anchoring at UTC
 * midnight would name the previous day for nothing, and `T12:00:00+03:00` is
 * only right for half the year.
 */
export function formatEditionDate(calendarDate: string): string {
  const date = parse(`${calendarDate}T09:00:00Z`);
  if (!date) return calendarDate;
  const parts = EDITION.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`;
}

/** `31 Aug 2026` — a publisher-stated date, on the publisher's UTC day. */
export function formatSourceDay(iso: string): string {
  const date = parse(iso);
  return date ? SOURCE_DAY.format(date) : iso;
}
