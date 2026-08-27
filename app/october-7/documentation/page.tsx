import type { Metadata } from 'next';
import { ArchiveIndexFilter } from '@/components/archive';
import { DocPage } from '@/components/sections/DocPage';
import { getDocumentationGroups } from '@/lib/content/documentation';
import { SITE_URL } from '@/lib/site-config';

const TAGLINE = 'The documentation record of October 7, filed as it was published.';
const PAGE_URL = `${SITE_URL}/october-7/documentation`;

export const metadata: Metadata = {
  title: 'Documentation',
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
};

export default async function Page() {
  const groups = await getDocumentationGroups();
  const total = groups.reduce((sum, group) => sum + group.records.length, 0);

  return (
    <DocPage
      routeId="october-7"
      // Both indexes and every record share this route, so each supplies the
      // seed that makes its slice of the corpus its own.
      backdropSeed="october-7/documentation"
      title="Documentation"
      tagline={TAGLINE}
      breadcrumb={[{ href: '/october-7', label: 'October 7' }]}
    >
      <p>
        {total} records archived from Hamas-Massacre.net, in English and
        Spanish, kept in the categories the source filed them under. Each is
        reproduced as published, with its credits intact.
      </p>
      <p>
        Much of this material is graphic. It is documentation of a massacre,
        and it is presented as documentation — described, dated and credited,
        so that what it shows can be checked rather than argued about.
      </p>

      {/* No meta line — see `showMeta`. These records carry no witness, all
          have two languages, and the date is the crawl timestamp, so it
          resolved to two strings across all 335 rows. File numbers run
          through the whole archive and are assigned before filtering. */}
      <ArchiveIndexFilter
        groups={groups.map((group) => ({
          slug: group.slug,
          title: group.title,
          records: group.records,
        }))}
        basePath="/october-7/documentation"
        showMeta={false}
        showCategoryJump
        label="Find"
      />
    </DocPage>
  );
}
