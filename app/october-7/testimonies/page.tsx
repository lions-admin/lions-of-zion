import type { Metadata } from 'next';
import { ArchiveIndexFilter } from '@/components/archive';
import { DocPage } from '@/components/sections/DocPage';
import { getTestimoniesManifest, getTestimonyIndex } from '@/lib/content/testimonies';
import { SITE_URL } from '@/lib/site-config';

const TAGLINE = 'First-hand accounts of October 7, held here in full.';
const PAGE_URL = `${SITE_URL}/october-7/testimonies`;

export const metadata: Metadata = {
  title: 'Testimonies',
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
};

export default async function Page() {
  const [records, manifest] = await Promise.all([
    getTestimonyIndex(),
    getTestimoniesManifest(),
  ]);

  const languages = manifest.languages.length;

  return (
    <DocPage
      routeId="october-7"
      title="Testimonies"
      tagline={TAGLINE}
      breadcrumb={[{ href: '/october-7', label: 'October 7' }]}
    >
      <p>
        {records.length} accounts, archived from October7.org and reproduced as
        published — their text, their images and their credits unaltered.
        {languages > 1
          ? ` Most are available in ${languages} languages; each record carries its own.`
          : null}
      </p>
      <p>
        These are people describing what happened to them. They are held here
        rather than linked to, so the record survives whatever happens to any
        one site.
      </p>
      <ArchiveIndexFilter
        groups={[{ slug: '', records }]}
        basePath="/october-7/testimonies"
        label="Find"
      />
    </DocPage>
  );
}
