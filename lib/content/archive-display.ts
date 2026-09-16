/**
 * Pure display helpers for archive records — no loaders, no filesystem.
 *
 * These live apart from `archive.ts` for one concrete reason: that module
 * reads `node:fs/promises`, and `ArchiveIndexFilter` is a client component.
 * Importing these two from the seam pulled `fs` into the client graph and the
 * route failed to build outright ("the chunking context does not support
 * external modules"). `archive.ts` re-exports both, so every server-side call
 * site is unchanged and unaware.
 *
 * Both strip source-site furniture at *render* time and leave the stored
 * record exactly as published. That boundary outlived the provenance footer
 * that used to state it (removed 2026-08-27): the source site's chrome is
 * dropped, the record's own words are never touched.
 */

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

/* ---------------------------------------------------------------------------
 * The values every archive surface prints, with one implementation each.
 *
 * Consolidated 2026-09-16. `groupDigits` had four byte-identical copies
 * (`ArchiveIndex`, `ArchiveRecordList`, `ArchiveRecord`, the documentation
 * index route), the month table and the language table two each, and a
 * duplicated formatter is how two surfaces end up disagreeing about the same
 * record. Pure and dependency-free, like the two helpers above, so the client
 * components that filter and list can import them without pulling the
 * filesystem seam into the browser bundle.
 * ------------------------------------------------------------------------ */

/** Thousands separators, so 7,525 words reads as a quantity and not an id. */
export function groupDigits(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Both date formatters are deterministic on purpose.
 *
 * The index rows render on the server for the first window and again on the
 * client after hydration, and `toLocaleString` resolves against two different
 * ICU environments — which is a hydration mismatch on a date nobody edited.
 */
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseUtc(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `7 Oct 2023` — the index row, where the date is one fact among five. */
export function formatArchiveDay(value: string | null | undefined): string {
  const date = parseUtc(value);
  if (!date) return '';
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `7 October 2023` — the record's own dateline, where it is the fact. */
export function formatArchiveDate(value: string | null | undefined): string | null {
  const date = parseUtc(value);
  if (!date) return null;
  return `${date.getUTCDate()} ${MONTHS_LONG[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * The seven languages the two packages actually carry, each written in the
 * language it names — which is why every call site also binds `lang`: the
 * attribute describes the text a screen reader is about to pronounce.
 */
const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  pt: 'Português',
};

/** A locale's own name, or the bare code upper-cased when it is not one of ours. */
export function languageName(locale: string): string {
  return LANGUAGE_NAMES[locale] ?? locale.toUpperCase();
}
