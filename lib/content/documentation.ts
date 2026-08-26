/**
 * Documentation — the hamas-massacre.net archive, 335 records in English and
 * Spanish, filed under six categories.
 *
 * The package-specific face over `archive.ts`, matching `testimonies.ts`.
 * Both packages satisfy one contract, so nothing here re-implements loading.
 *
 * Two shapes of this archive drive the route design:
 *
 *  - Every record exists in both languages, so the bare record route serves
 *    English and `[locale]` serves Spanish — 335 pages each, not one 670-page
 *    pattern.
 *  - One record was published with no category at all. Rule 4 of the package
 *    contract forbids inventing one, so `category_id` stays null and the route
 *    files it under `UNCATEGORISED`. That is a presentation choice; the data is
 *    untouched.
 */
import {
  type ArchiveCategory,
  type ArchiveIndexEntry,
  type ArchiveRecord,
  getCategories,
  getIndex,
  getManifest,
  getRecord,
} from './archive';

export const DOCUMENTATION_PACKAGE = 'hamas-massacre' as const;

/** The route segment standing in for a record the source left uncategorised. */
export const UNCATEGORISED = 'uncategorized';

export type DocumentationGroup = {
  category: ArchiveCategory | null;
  slug: string;
  title: string;
  records: ArchiveIndexEntry[];
};

export function categorySlug(categoryId: string | null): string {
  return categoryId ?? UNCATEGORISED;
}

export function getDocumentationIndex(): Promise<ArchiveIndexEntry[]> {
  return getIndex(DOCUMENTATION_PACKAGE);
}

export function getDocumentationRecord(slug: string): Promise<ArchiveRecord | null> {
  return getRecord(DOCUMENTATION_PACKAGE, slug);
}

export function getDocumentationManifest() {
  return getManifest(DOCUMENTATION_PACKAGE);
}

/**
 * Records grouped by category, in the source site's own menu order. A category
 * the source declared but filed nothing under is dropped; the uncategorised
 * bucket is appended last and only when it holds something.
 */
export async function getDocumentationGroups(locale = 'en'): Promise<DocumentationGroup[]> {
  const [index, categories] = await Promise.all([
    getIndex(DOCUMENTATION_PACKAGE),
    getCategories(DOCUMENTATION_PACKAGE),
  ]);

  const byCategory = new Map<string, ArchiveIndexEntry[]>();
  for (const entry of index) {
    const slug = categorySlug(entry.category);
    const bucket = byCategory.get(slug);
    if (bucket) bucket.push(entry);
    else byCategory.set(slug, [entry]);
  }

  const ordered = [...categories].sort(
    (a, b) => (a.menu_order ?? 99) - (b.menu_order ?? 99),
  );

  const groups: DocumentationGroup[] = [];
  for (const category of ordered) {
    const records = byCategory.get(category.category_id);
    if (!records?.length) continue;
    groups.push({
      category,
      slug: category.category_id,
      title: category.names?.[locale] ?? category.names?.en ?? category.category_id,
      records,
    });
  }

  const loose = byCategory.get(UNCATEGORISED);
  if (loose?.length) {
    groups.push({
      category: null,
      slug: UNCATEGORISED,
      title: 'Uncategorised',
      records: loose,
    });
  }

  return groups;
}

/** Every record at its default language, addressed through its category. */
export async function documentationParams(): Promise<{ category: string; slug: string }[]> {
  const index = await getIndex(DOCUMENTATION_PACKAGE);
  return index.map((entry) => ({ category: categorySlug(entry.category), slug: entry.id }));
}

/** Every non-default language version; the default is served by the bare route. */
export async function documentationLocaleParams(): Promise<
  { category: string; slug: string; locale: string }[]
> {
  const index = await getIndex(DOCUMENTATION_PACKAGE);
  return index.flatMap((entry) =>
    entry.languages
      .filter((locale) => locale !== entry.defaultLanguage)
      .map((locale) => ({
        category: categorySlug(entry.category),
        slug: entry.id,
        locale,
      })),
  );
}
