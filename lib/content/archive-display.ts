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
