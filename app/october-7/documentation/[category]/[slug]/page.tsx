import type { Metadata } from 'next';
import { ArchiveRecordPage, archiveRecordMetadata } from '@/components/archive';
import { DOCUMENTATION_PACKAGE, documentationParams } from '@/lib/content/documentation';

const SOURCE_LABEL = 'Hamas-Massacre.net';

type Params = { params: Promise<{ category: string; slug: string }> };

export async function generateStaticParams() {
  return documentationParams();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category, slug } = await params;
  return archiveRecordMetadata({
    pkg: DOCUMENTATION_PACKAGE,
    slug,
    basePath: `/october-7/documentation/${category}/${slug}`,
  });
}

export default async function Page({ params }: Params) {
  const { category, slug } = await params;
  return (
    <ArchiveRecordPage
      pkg={DOCUMENTATION_PACKAGE}
      slug={slug}
      basePath={`/october-7/documentation/${category}/${slug}`}
      sourceLabel={SOURCE_LABEL}
    />
  );
}
