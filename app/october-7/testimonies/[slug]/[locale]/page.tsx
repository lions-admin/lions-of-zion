import type { Metadata } from 'next';
import { ArchiveRecordPage, archiveRecordMetadata } from '@/components/archive';
import { TESTIMONIES_PACKAGE, testimonyLocaleParams } from '@/lib/content/testimonies';

const SOURCE_LABEL = 'October7.org';

type Params = { params: Promise<{ slug: string; locale: string }> };

/**
 * Non-default language versions only — the bare `[slug]` route serves the
 * record's default language, and building it here too would give one version
 * two URLs competing for a single canonical.
 */
export async function generateStaticParams() {
  return testimonyLocaleParams();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, locale } = await params;
  return archiveRecordMetadata({
    pkg: TESTIMONIES_PACKAGE,
    slug,
    locale,
    basePath: `/october-7/testimonies/${slug}`,
  });
}

export default async function Page({ params }: Params) {
  const { slug, locale } = await params;
  return (
    <ArchiveRecordPage
      pkg={TESTIMONIES_PACKAGE}
      slug={slug}
      locale={locale}
      basePath={`/october-7/testimonies/${slug}`}
      sourceLabel={SOURCE_LABEL}
    />
  );
}
