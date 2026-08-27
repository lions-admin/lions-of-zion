import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocPage } from '@/components/sections/DocPage';
import {
  type ArchivePackageName,
  displayTitle,
  getMediaRegistry,
  getRecord,
  pickVersion,
} from '@/lib/content/archive';
import { SITE_URL } from '@/lib/site-config';
import { ArchiveDateline, ArchiveRecord } from './ArchiveRecord';

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

/**
 * The shared body of every archive record route.
 *
 * Four routes render a record — testimonies and documentation, each at a
 * default language and at a locale — and they differ only in which package
 * they read and what their URLs look like. Keeping the loading, the 404 and
 * the shell here is what stops those four drifting apart.
 */
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

  const version = pickVersion(record, locale);
  const media = await getMediaRegistry(pkg);
  const title = displayTitle(version.title);
  const headings = version.content_blocks.filter(
    (block) => block.type === 'heading' && block.text,
  ).length;

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
          record={record}
          version={version}
          basePath={basePath}
          sourceLabel={sourceLabel}
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
        record={record}
        version={version}
        media={media}
        basePath={basePath}
        sourceLabel={sourceLabel}
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
