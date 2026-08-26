import type { Metadata } from 'next';
import { ArchiveRecordPage, archiveRecordMetadata } from '@/components/archive';
import {
  DOCUMENTATION_PACKAGE,
  documentationLocaleParams,
} from '@/lib/content/documentation';

const SOURCE_LABEL = 'Hamas-Massacre.net';

type Params = { params: Promise<{ category: string; slug: string; locale: string }> };

/**
 * Non-default language versions only. Every record in this archive exists in
 * both English and Spanish, so this route builds the 335 Spanish pages and the
 * bare route builds the 335 English ones — not one pattern serving 670.
 */
export async function generateStaticParams() {
  return documentationLocaleParams();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category, slug, locale } = await params;
  return archiveRecordMetadata({
    pkg: DOCUMENTATION_PACKAGE,
    slug,
    locale,
    basePath: `/october-7/documentation/${category}/${slug}`,
  });
}

export default async function Page({ params }: Params) {
  const { category, slug, locale } = await params;
  return (
    <ArchiveRecordPage
      pkg={DOCUMENTATION_PACKAGE}
      slug={slug}
      locale={locale}
      basePath={`/october-7/documentation/${category}/${slug}`}
      sourceLabel={SOURCE_LABEL}
    />
  );
}
