import type { Metadata } from 'next';
import {
  ArchiveFullIndex,
  ArchiveIndex,
  ArchiveIntro,
  ArchiveNote,
  type ArchiveFacet,
} from '@/components/archive';
import { DocPage } from '@/components/sections/DocPage';
import styles from '@/components/archive/archive.module.css';
import {
  getRecordDigests,
  manifestLanguages,
  withCoverThumbs,
} from '@/lib/content/archive';
import {
  groupDigits,
  LANGUAGE_NAMES,
} from '@/lib/content/archive-display';
import {
  TESTIMONIES_PACKAGE,
  getTestimoniesManifest,
  getTestimonyIndex,
} from '@/lib/content/testimonies';
import { pageMetadata } from '@/lib/page-metadata';

const TAGLINE = 'First-hand accounts of October 7, held here in full.';
const BASE_PATH = '/october-7/testimonies';

export const metadata: Metadata = pageMetadata({
  title: 'Testimonies',
  description: TAGLINE,
  path: '/october-7/testimonies',
});

export default async function Page() {
  const [index, manifest, digests] = await Promise.all([
    getTestimonyIndex(),
    getTestimoniesManifest(),
    getRecordDigests(TESTIMONIES_PACKAGE),
  ]);
  // Covers resolve here, server-side — the rows need URLs and intrinsic
  // dimensions, not media_ids, and the media registry stays out of the client
  // bundle.
  const withThumbs = await withCoverThumbs(TESTIMONIES_PACKAGE, index);
  const records = withThumbs.map((entry) => ({
    ...entry,
    digest: digests.get(entry.id),
  }));

  /* The filing axis for this archive is language, not category: the accounts
     were translated into up to seven and a reader who can only read one wants
     the accounts they can actually read. Counts are the archive's own — the
     number of records that really carry each language, never the manifest's
     list of what the package supports. */
  const languageCounts = new Map<string, number>();
  for (const entry of index) {
    for (const locale of entry.languages) {
      languageCounts.set(locale, (languageCounts.get(locale) ?? 0) + 1);
    }
  }
  const facets: ArchiveFacet[] = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({
      value,
      label: LANGUAGE_NAMES[value] ?? value.toUpperCase(),
      count,
    }));

  /* Through the helper: this package's manifest writes `languages` as a
     per-language count map rather than an array, so `.length` was
     `undefined` and the sentence below never rendered. */
  const languages = manifestLanguages(manifest).length;

  return (
    <DocPage
      routeId="october-7"
      // Both indexes and every record share this route, so each supplies the
      // seed that makes its slice of the corpus its own.
      title="Testimonies"
      tagline={TAGLINE}
      breadcrumb={[{ href: '/october-7', label: 'October 7' }]}
    >
      {/* One breakout column for everything the index is: the counts, the
          apparatus, the filter, the rows and the no-JavaScript index — the
          list surface is wider than the reading column, and it breaks out
          once here rather than piecemeal inside the components. */}
      <div className={styles.archiveColumn}>
        {/* Same split as the documentation index: the counts are data, the
            provenance is one muted line, and the sentence that says what these
            accounts *are* keeps a box of its own. It is not an ember advisory —
            nothing here is graphic and spending the danger ramp on a statement
            about custody is how a real warning stops being believed. */}
        <ArchiveIntro
          facts={[
            { value: groupDigits(records.length), label: 'accounts' },
            ...(languages > 1
              ? [{ value: groupDigits(languages), label: 'languages' }]
              : []),
          ]}
          provenance={
            <>
              Archived from October7.org and reproduced as published — their text,
              their images and their credits unaltered.
              {languages > 1 ? ' Most exist in several languages, and e' : ' E'}ach
              row below names its witness, when the account was published, how
              much of it is held, and the languages it carries.
            </>
          }
        >
          <ArchiveNote labelId="testimonies-note" label="What is held here">
            These are people describing what happened to them. They are held here
            rather than linked to, so the record survives whatever happens to any
            one site.
          </ArchiveNote>
        </ArchiveIntro>

        <ArchiveIndex
          variant="testimony"
          records={records}
          basePath={BASE_PATH}
          facets={facets}
          facetLegend="Language"
          searchLabel="Testimonies"
          /* What the filter actually searches — the fields a row carries. The
             hint used to promise the body text of the account itself, which
             no row shows and no index exists for: shipping all 179
             default-language accounts to the browser measured 1.4 MB (446 kB
             gzipped), so the hint names what is true instead. */
          searchHint="Witness, title, or the account's opening words"
        />

        <ArchiveFullIndex
          entries={index}
          basePath={BASE_PATH}
          heading="Every testimony"
        />
      </div>
    </DocPage>
  );
}
