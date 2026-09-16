/**
 * Pure display helpers for archive records — no loaders, no filesystem.
 *
 * These live apart from `archive.ts` for one concrete reason: that module
 * reads `node:fs/promises`, and `ArchiveIndex` is a client component.
 * Importing these from the seam pulled `fs` into the client graph and the
 * route failed to build outright ("the chunking context does not support
 * external modules"). `archive.ts` re-exports both, so every server-side call
 * site is unchanged and unaware.
 *
 * Both strip source-site furniture at *render* time and leave the stored
 * record exactly as published. That boundary outlived the provenance footer
 * that used to state it (removed 2026-08-27): the source site's chrome is
 * dropped, the record's own words are never touched.
 *
 * Since 2026-09-17 (Midnight Signal, workstream H) this is also where the
 * archive's small formatting vocabulary lives — digit grouping, the one date
 * formatter, the seven locale names — because each had grown a private copy
 * in a component and the copies were one refactor away from disagreeing.
 * Everything here must stay deterministic: the index renders on the server
 * for the first window and again on the client after hydration, and
 * `toLocaleString` would resolve against two different ICU environments and
 * mismatch.
 */

/** Thousands separators, nothing else — the archive's counts are small. */
export function groupDigits(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Short month names for the row-facts date; English only, like the site. */
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The source's own publication day, on the publisher's UTC calendar — the one
 * exception the date policy names — as "7 October 2023" (long) or the row
 * fact "7 Oct 2023" (short). Hand-built from UTC parts rather than
 * `toLocaleDateString` so the server render and the client re-render cannot
 * disagree. Returns '' for a value that does not parse, and the caller drops
 * the pair rather than printing a hole.
 */
export function formatArchiveDate(
  value: string | null | undefined,
  style: 'long' | 'short' = 'long',
): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const months = style === 'long' ? MONTHS_LONG : MONTHS_SHORT;
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * The seven languages the packages carry. Every label is written in the
 * language it names ("Español", "日本語"), so wherever a name renders it needs
 * `lang` as well — see `ArchiveDateline`.
 */
export const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  pt: 'Português',
};

/**
 * A record's title, minus the source page's own chrome.
 *
 * Nine october7 titles are the page's <title> tag verbatim and end in site
 * furniture — "| October7 Blog", "- October7 Blog", "| October7 Nova Fest".
 * This strips only those two known suffixes, only at the very end. A dash or
 * pipe inside the testimony's own words survives. Same rule as the importer's
 * `cleanTitle`.
 */
export function displayTitle(title: string): string {
  return (
    title.replace(/\s*[|–—-]\s*October7\s+(Blog|Nova\s*Fest)\s*$/i, '').trim() ||
    title.trim()
  );
}

/**
 * The witness's name, without the source site's byline phrasing.
 *
 * `witness_name` is not a name — it is october7.org's byline — so a `Witness`
 * label rendered "WITNESS Gili Y.'s story" on all 505 version pages and 179
 * index rows: the label and the value disagreeing about what they are.
 *
 * 177 of the 179 end in a clean possessive; the other two are malformed in the
 * source ("Yuval H.s story", "Avram R'.s story"), which is why the apostrophe
 * and the period are both optional here — a stricter pattern leaves exactly
 * those two still showing the suffix.
 */
export function displayWitness(witness: string): string {
  return witness.replace(/\s*['’.]?s['’]?\s+story\s*$/i, '').trim() || witness.trim();
}
