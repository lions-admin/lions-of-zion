import type { Metadata } from 'next';
import { ArchiveFullIndex, ArchiveIndex, type ArchiveFacet } from '@/components/archive';
import { DocPage } from '@/components/sections/DocPage';
import { getRecordDigests, withCoverThumbs } from '@/lib/content/archive';
import {
  DOCUMENTATION_PACKAGE,
  UNCATEGORISED,
  getDocumentationGroups,
} from '@/lib/content/documentation';
import { SITE_URL } from '@/lib/site-config';

const TAGLINE = 'The documentation record of October 7, filed as it was published.';
const PAGE_URL = `${SITE_URL}/october-7/documentation`;
const BASE_PATH = '/october-7/documentation';

export const metadata: Metadata = {
  title: 'Documentation',
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
};

export default async function Page() {
  const [groups, digests] = await Promise.all([
    getDocumentationGroups(),
    getRecordDigests(DOCUMENTATION_PACKAGE),
  ]);

  /* Flattened in the source's own menu order, so the file numbers run through
     the whole archive in the order the source filed it — the number is the
     exhibit's identity, and it must not change when a category is chosen. */
  const flat = groups.flatMap((group) => group.records);
  const withThumbs = await withCoverThumbs(DOCUMENTATION_PACKAGE, flat);
  const records = withThumbs.map((entry) => ({
    ...entry,
    digest: digests.get(entry.id),
  }));

  const facets: ArchiveFacet[] = groups.map((group) => ({
    value: group.slug,
    label: group.title,
    count: group.records.length,
  }));

  const films = records.filter((r) => r.digest?.medium === 'video').length;
  const photographs = records.filter((r) => r.digest?.medium === 'image').length;

  return (
    <DocPage
      routeId="october-7"
      // Both indexes and every record share this route, so each supplies the
      // seed that makes its slice of the corpus its own.
      backdropSeed="october-7/documentation"
      register="silent"
      title="Documentation"
      tagline={TAGLINE}
      breadcrumb={[{ href: '/october-7', label: 'October 7' }]}
    >
      <p>
        {records.length} records archived from Hamas-Massacre.net — {films} films
        and {photographs} photographs — in English and Spanish, kept in the
        categories the source filed them under. Each is reproduced as published,
        with its credits intact.
      </p>
      <p>
        Every record here is graphic. It is documentation of a massacre, and it
        is presented as documentation — described, dated and filed, so that what
        it shows can be checked rather than argued about. No film or photograph
        on this site is shown until you ask for it, and nothing plays by itself.
      </p>

      {/* The sticky category jump is gone: it moved the page without changing
          what was on it, so a reader still had 335 equally-weighted rows below
          them. The categories are a filter now, and they carry their counts. */}
      <ArchiveIndex
        variant="documentation"
        records={records}
        basePath={BASE_PATH}
        uncategorised={UNCATEGORISED}
        facets={facets}
        facetLegend="Category"
        searchLabel="Documentation"
        searchHint="Filter by description, place or category"
      />

      <ArchiveFullIndex
        entries={flat}
        basePath={BASE_PATH}
        categorised
        uncategorised={UNCATEGORISED}
        heading="Every record"
      />
    </DocPage>
  );
}
