import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocPage } from '@/components/sections/DocPage';
import {
  type ArchivePackageName,
  getMediaRegistry,
  getRecord,
  pickVersion,
} from '@/lib/content/archive';
import { SITE_URL } from '@/lib/site-config';
import { ArchiveRecord } from './ArchiveRecord';

export type ArchiveRecordPageArgs = {
  pkg: ArchivePackageName;
  slug: string;
  /** Omitted for the record's default language, which the bare route serves. */
  locale?: string;
  /** Default-language URL for this record, e.g. `/october-7/testimonies/foo`. */
  basePath: string;
  sourceLabel: string;
  /** Shown under the title; describes the archive, not the record. */
  tagline: string;
};

/**
 * The shared body of every archive record route.
 *
 * Four routes render a record — testimonies and documentation, each at a
 * default language and at a locale — and they differ only in which package
 * they read and what their URLs look like. Keeping the loading, the 404 and
 * the shell here is what stops those four drifting apart.
 */
export async function ArchiveRecordPage({
  pkg,
  slug,
  locale,
  basePath,
  sourceLabel,
  tagline,
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

  return (
    <DocPage routeId="october-7" title={version.title} tagline={tagline}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(recordJsonLd(record, version, basePath, locale, sourceLabel)),
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
}: Omit<ArchiveRecordPageArgs, 'sourceLabel' | 'tagline'>): Promise<Metadata> {
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
    title: version.title,
    description,
    // Canonical points here, not at the source site. See `.ai/DECISIONS.md`,
    // 2026-08-26 — conceding it guarantees zero reach for these pages.
    alternates: { canonical: url, languages },
    openGraph: {
      title: version.title,
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
    name: version.title,
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
