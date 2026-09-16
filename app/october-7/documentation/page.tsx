import type { Metadata } from 'next';
import {
  ArchiveAdvisory,
  ArchiveFullIndex,
  ArchiveIndex,
  ArchiveIntro,
  type ArchiveFacet,
} from '@/components/archive';
import { DocPage } from '@/components/sections/DocPage';
import { getRecordDigests } from '@/lib/content/archive';
import { groupDigits } from '@/lib/content/archive-display';
import {
  DOCUMENTATION_PACKAGE,
  UNCATEGORISED,
  getDocumentationGroups,
} from '@/lib/content/documentation';
import { pageMetadata } from '@/lib/page-metadata';

const TAGLINE = 'The documentation record of October 7, filed as it was published.';
const BASE_PATH = '/october-7/documentation';

export const metadata: Metadata = pageMetadata({
  title: 'Documentation',
  description: TAGLINE,
  path: '/october-7/documentation',
});

export default async function Page() {
  const [groups, digests] = await Promise.all([
    getDocumentationGroups(),
    getRecordDigests(DOCUMENTATION_PACKAGE),
  ]);

  /* Flattened in the source's own menu order, so the file numbers run through
     the whole archive in the order the source filed it — the number is the
     exhibit's identity, and it must not change when a category is chosen. */
  const flat = groups.flatMap((group) => group.records);
  /* No `withCoverThumbs` here, and that is the advisory below made true
     (owner decision, 2026-09-16). Resolving covers for this index meant 24
     frames of the attack painted under a sentence promising that nothing is
     shown until it is asked for; not resolving them means the URLs never
     reach the client either, so there is nothing for a devtools panel or a
     copied payload to open. The rows carry the exhibit number, the filing
     line and the source's own caption. */
  const records = flat.map((entry) => ({
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
      title="Documentation"
      tagline={TAGLINE}
      breadcrumb={[{ href: '/october-7', label: 'October 7' }]}
    >
      {/* Every fact the two opening paragraphs carried is still here; what
          changed is which of them is prose. The counts are counts, so they are
          set as data; the filing policy is provenance, so it is one muted
          line; the warning is a warning, so it keeps the ember box the record
          pages use rather than arriving as a fourth paragraph of body text a
          reader has already started skimming past. */}
      <ArchiveIntro
        facts={[
          { value: groupDigits(records.length), label: 'records' },
          { value: groupDigits(films), label: 'films' },
          { value: groupDigits(photographs), label: 'photographs' },
        ]}
        provenance={
          <>
            Archived from Hamas-Massacre.net in English and Spanish, kept in the
            categories the source filed them under and reproduced as published,
            with credits intact — documentation of a massacre presented as
            documentation, described, dated and filed, so that what it shows can
            be checked rather than argued about.
          </>
        }
      >
        <ArchiveAdvisory labelId="documentation-advisory">
          Every record here is graphic. No film or photograph on this site is
          shown until you ask for it, and nothing plays by itself.
        </ArchiveAdvisory>
      </ArchiveIntro>

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
        searchHint="Caption or category"
        searchScope="The filter reads each record’s caption and the category it was filed under."
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
