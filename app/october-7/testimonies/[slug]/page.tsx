import type { Metadata } from 'next';
import { ArchiveRecordPage, archiveRecordMetadata } from '@/components/archive';
import { TESTIMONIES_PACKAGE, testimonyParams } from '@/lib/content/testimonies';

const TAGLINE = 'Archived testimony from October 7.';
const SOURCE_LABEL = 'October7.org';

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return testimonyParams();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return archiveRecordMetadata({
    pkg: TESTIMONIES_PACKAGE,
    slug,
    basePath: `/october-7/testimonies/${slug}`,
  });
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  return (
    <ArchiveRecordPage
      pkg={TESTIMONIES_PACKAGE}
      slug={slug}
      basePath={`/october-7/testimonies/${slug}`}
      sourceLabel={SOURCE_LABEL}
      tagline={TAGLINE}
    />
  );
}
