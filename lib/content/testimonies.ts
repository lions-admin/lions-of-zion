/**
 * Testimonies — the october7.org archive, 179 records across seven languages.
 *
 * A thin package-specific face over `archive.ts`; the shapes and loaders are
 * shared with `documentation.ts` because both packages satisfy one contract.
 *
 * This site hosts these records rather than linking out to them. That reverses
 * an earlier decision and was deliberate — see `.ai/DECISIONS.md`, 2026-08-26.
 */
import {
  type ArchiveIndexEntry,
  type ArchiveRecord,
  getIndex,
  getManifest,
  getRecord,
} from './archive';

export const TESTIMONIES_PACKAGE = 'october7' as const;

export type TestimonyRoute = { slug: string; locale?: string };

export async function getTestimonyIndex(): Promise<ArchiveIndexEntry[]> {
  const index = await getIndex(TESTIMONIES_PACKAGE);
  // Newest first where a date exists; undated records sort last rather than
  // being dropped, because the source published them without one.
  return [...index].sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return (a.title ?? a.id).localeCompare(b.title ?? b.id);
  });
}

export function getTestimony(slug: string): Promise<ArchiveRecord | null> {
  return getRecord(TESTIMONIES_PACKAGE, slug);
}

export function getTestimoniesManifest() {
  return getManifest(TESTIMONIES_PACKAGE);
}

/** Every record at its default language — one page each. */
export async function testimonyParams(): Promise<{ slug: string }[]> {
  const index = await getIndex(TESTIMONIES_PACKAGE);
  return index.map((entry) => ({ slug: entry.id }));
}

/**
 * Every *non-default* language version. The default language is served by the
 * bare `[slug]` route, so emitting it here too would build two pages for one
 * version and give them competing canonicals.
 */
export async function testimonyLocaleParams(): Promise<{ slug: string; locale: string }[]> {
  const index = await getIndex(TESTIMONIES_PACKAGE);
  return index.flatMap((entry) =>
    entry.languages
      .filter((locale) => locale !== entry.defaultLanguage)
      .map((locale) => ({ slug: entry.id, locale })),
  );
}
