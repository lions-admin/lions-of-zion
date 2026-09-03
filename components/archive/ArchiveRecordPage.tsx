import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocPage } from '@/components/sections/DocPage';
import {
  type ArchiveIndexEntry,
  type ArchivePackageName,
  displayTitle,
  displayWitness,
  getCategories,
  getIndex,
  getMediaRegistry,
  getRecord,
  pickVersion,
} from '@/lib/content/archive';
import { SITE_URL } from '@/lib/site-config';
import type { ArchiveSensitivity } from './ArchiveBlocks';
import { ArchiveDateline, ArchiveRecord, type ArchiveNeighbour } from './ArchiveRecord';

export type ArchiveRecordPageArgs = {
  pkg: ArchivePackageName;
  slug: string;
  /** Omitted for the record's default language, which the bare route serves. */
  locale?: string;
  /** Default-language URL for this record, e.g. `/october-7/testimonies/foo`. */
  basePath: string;
  sourceLabel: string;
};

/**
 * Past this, the title is a caption the source wrote as a whole paragraph
 * rather than a headline, and `--t-display` stops being a signal about scale.
 *
 * 90 characters is where the documentation archive's distribution turns: its
 * p90 is 87 and its longest is 296. It catches 25 of 335 documentation records
 * and 31 of 179 testimonies, so it is a tail treatment, not a second style.
 */
const LONG_TITLE = 90;

/**
 * Below this a contents rail is noise rather than navigation, so the page pays
 * for neither the rail nor the reading line.
 *
 * 160 of the 505 testimony versions clear it, the longest running fifteen
 * sections. No documentation version has more than one heading, so the gate
 * never fires there and `.ai/DECISIONS.md`'s "documentation records take no
 * rails" holds without this having to know which archive it is in.
 */
const RAIL_HEADINGS = 3;

/** The route segment standing in for a record the source left uncategorised. */
const UNCATEGORISED = 'uncategorized';

/**
 * Where this record sits, for the identity band and for `BreadcrumbList`.
 *
 * Derived from `pkg` rather than passed in by each of the four record routes,
 * which differ only in which package they read.
 */
function archiveTrail(pkg: ArchivePackageName) {
  const index =
    pkg === 'october7'
      ? { href: '/october-7/testimonies', label: 'Testimonies' }
      : { href: '/october-7/documentation', label: 'Documentation' };
  return [{ href: '/october-7', label: 'October 7' }, index];
}

/**
 * What this record holds behind a stated choice (OCT-005).
 *
 * The rule is the *package*, and it is a fact about the two archives rather
 * than a judgement about any one record — there is no severity field to read,
 * and inventing one record-by-record would be inventing metadata on an
 * evidentiary surface.
 *
 *  - **hamas-massacre** is documentation of the attack. Every one of its 335
 *    records is a film (209) or a photograph (126) of that day, filed by the
 *    source under one of six categories it named itself. `all`.
 *  - **october7** is first-person accounts. The account is the record and is
 *    never covered — covering a witness's own words would be the archive
 *    refusing to say what it exists to say. The footage published alongside it
 *    is from that day: `video`.
 */
function sensitivityFor(
  pkg: ArchivePackageName,
  categoryName: string | null,
): ArchiveSensitivity {
  if (pkg === 'hamas-massacre') {
    return {
      gate: 'all',
      category: categoryName ?? 'Documentation of 7 October 2023',
      note: 'This is documentation of the 7 October 2023 attack, published by the source as evidence of it. It is graphic.',
    };
  }
  return {
    gate: 'video',
    category: 'Published with this account',
    note: 'This account was published with footage recorded on 7 October 2023. It is graphic.',
  };
}

/**
 * The record either side of this one, in its own index's order.
 *
 * Testimonies are ordered newest first and documentation is ordered inside its
 * category, which is what the two index routes show — so "next" here means the
 * next row of the list the reader came from, not the next line of a JSON file.
 *
 * Both lists are read from the cached package index, so this costs nothing per
 * page beyond a scan of an array already in memory.
 */
async function neighboursFor(
  pkg: ArchivePackageName,
  slug: string,
): Promise<{ previous: ArchiveNeighbour | null; next: ArchiveNeighbour | null }> {
  const index = await getIndex(pkg);

  let ordered: ArchiveIndexEntry[];
  if (pkg === 'october7') {
    // Newest first where a date exists; undated records sort last rather than
    // being dropped. The same comparator `getTestimonyIndex` uses — restated
    // rather than imported so this module stays package-neutral.
    ordered = [...index].sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return (a.title ?? a.id).localeCompare(b.title ?? b.id);
    });
  } else {
    // Documentation neighbours stay inside the record's own category: that is
    // the list the index shows and the one the reader was walking.
    const here = index.find((entry) => entry.id === slug);
    if (!here) return { previous: null, next: null };
    const category = here.category ?? UNCATEGORISED;
    ordered = index.filter((entry) => (entry.category ?? UNCATEGORISED) === category);
  }

  const at = ordered.findIndex((entry) => entry.id === slug);
  if (at === -1) return { previous: null, next: null };

  const href = (entry: ArchiveIndexEntry) =>
    pkg === 'october7'
      ? `/october-7/testimonies/${entry.id}`
      : `/october-7/documentation/${entry.category ?? UNCATEGORISED}/${entry.id}`;

  const shape = (entry: ArchiveIndexEntry | undefined): ArchiveNeighbour | null =>
    entry
      ? {
          href: href(entry),
          title: displayTitle(entry.title ?? entry.id),
          witness: entry.witness ? displayWitness(entry.witness) : null,
        }
      : null;

  return { previous: shape(ordered[at - 1]), next: shape(ordered[at + 1]) };
}

/** The source's own name for the category a record was filed under. */
async function categoryNameFor(
  pkg: ArchivePackageName,
  categoryId: string | null,
): Promise<string | null> {
  if (!categoryId) return null;
  const categories = await getCategories(pkg);
  const match = categories.find((c) => c.category_id === categoryId);
  return match?.names?.en ?? match?.category_id ?? null;
}

/**
 * The shared body of every archive record route.
 *
 * Four routes render a record — testimonies and documentation, each at a
 * default language and at a locale — and they differ only in which package
 * they read and what their URLs look like. Keeping the loading, the 404, the
 * shell, the sensitivity rule and the neighbour arithmetic here is what stops
 * those four drifting apart, and what makes one record template predictable
 * across all ~1,177 pages (OCT-004).
 */
export async function ArchiveRecordPage({
  pkg,
  slug,
  locale,
  basePath,
  sourceLabel,
}: ArchiveRecordPageArgs) {
  const record = await getRecord(pkg, slug);
  if (!record) notFound();

  // A locale route may only serve a language this record actually has, and
  // never the default — that one belongs to the bare route, and serving it
  // twice would build two pages competing for one canonical.
  if (locale && (!record.versions[locale] || locale === record.default_language)) {
    notFound();
  }

  const variant = pkg === 'october7' ? 'testimony' : 'documentation';
  const version = pickVersion(record, locale);
  const [media, categoryName, neighbours] = await Promise.all([
    getMediaRegistry(pkg),
    categoryNameFor(pkg, record.category_id),
    neighboursFor(pkg, slug),
  ]);

  const title = displayTitle(version.title);
  const headings = version.content_blocks.filter(
    (block) => block.type === 'heading' && block.text,
  ).length;
  // The same URL the metadata declares canonical — what every share carries.
  const shareUrl = `${SITE_URL}${locale ? `${basePath}/${locale}` : basePath}`;

  return (
    <DocPage
      routeId="october-7"
      // Every archive route is `october-7`, so without a seed of its own each
      // of the ~1,177 drew the identical nine corpus fragments in the
      // identical places — the one thing the seeding existed to prevent. The
      // slug and not the locale: a record's translations are one record, and
      // switching language should not reshuffle the page around it.
      backdropSeed={slug}
      title={title}
      titleScale={title.length > LONG_TITLE ? 'long' : 'default'}
      titleLang={version.locale}
      // No tagline: the archive's is a per-package sentence identical on 505
      // or 670 pages, and printing it here put boilerplate where the record's
      // own identity belongs. The dateline takes that slot instead.
      dateline={
        <ArchiveDateline
          variant={variant}
          record={record}
          version={version}
          basePath={basePath}
          categoryName={categoryName}
        />
      }
      rails={headings >= RAIL_HEADINGS ? 'toc' : 'none'}
      breadcrumb={archiveTrail(pkg)}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(recordJsonLd(record, version, basePath, locale, sourceLabel)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd(
              pkg,
              displayTitle(version.title),
              `${SITE_URL}${locale ? `${basePath}/${locale}` : basePath}`,
            ),
          ),
        }}
      />
      <ArchiveRecord
        pkg={pkg}
        variant={variant}
        record={record}
        version={version}
        media={media}
        basePath={basePath}
        sourceLabel={sourceLabel}
        shareUrl={shareUrl}
        categoryName={categoryName}
        sensitivity={sensitivityFor(pkg, categoryName)}
        previous={neighbours.previous}
        next={neighbours.next}
      />
    </DocPage>
  );
}

/**
 * Metadata for a record route, including the full `hreflang` set.
 *
 * The alternates come from the record's own `available_languages` rather than
 * being inferred: the packages carry symmetric translation links at
 * `confidence: high`, so there is nothing to guess.
 */
export async function archiveRecordMetadata({
  pkg,
  slug,
  locale,
  basePath,
}: Omit<ArchiveRecordPageArgs, 'sourceLabel'>): Promise<Metadata> {
  const record = await getRecord(pkg, slug);
  if (!record) return {};

  const version = pickVersion(record, locale);
  const url = `${SITE_URL}${locale ? `${basePath}/${locale}` : basePath}`;

  const languages: Record<string, string> = {};
  for (const lang of record.available_languages) {
    languages[lang] =
      `${SITE_URL}${lang === record.default_language ? basePath : `${basePath}/${lang}`}`;
  }

  const description = version.excerpt ?? version.full_text?.slice(0, 200) ?? undefined;

  return {
    title: displayTitle(version.title),
    description,
    // Canonical points here, not at the source site. See `.ai/DECISIONS.md`,
    // 2026-08-26 — conceding it guarantees zero reach for these pages.
    alternates: { canonical: url, languages },
    openGraph: {
      title: displayTitle(version.title),
      description,
      type: 'article',
      url,
      locale: version.locale,
    },
  };
}

function recordJsonLd(
  record: Awaited<ReturnType<typeof getRecord>> & object,
  version: { title: string; locale: string; source_url?: string },
  basePath: string,
  locale: string | undefined,
  sourceLabel: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ArchiveComponent',
    name: displayTitle(version.title),
    inLanguage: version.locale,
    url: `${SITE_URL}${locale ? `${basePath}/${locale}` : basePath}`,
    datePublished: record.publication_date ?? undefined,
    holdingArchive: { '@type': 'ArchiveOrganization', name: sourceLabel },
    // The verifiable pointer lives here rather than in the prose, which is
    // what lets the record body stay free of outbound links.
    isBasedOn: version.source_url ?? undefined,
    publisher: { '@type': 'Organization', name: 'Lions of Zion' },
  };
}

/** The same trail the identity band shows, so the hierarchy is not invisible
    to machines while being visible to readers. */
function breadcrumbJsonLd(pkg: ArchivePackageName, title: string, url: string) {
  const items = [...archiveTrail(pkg).map((c) => ({ name: c.label, url: `${SITE_URL}${c.href}` })), { name: title, url }];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
