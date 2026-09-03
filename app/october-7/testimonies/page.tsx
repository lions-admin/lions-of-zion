import type { Metadata } from 'next';
import { ArchiveFullIndex, ArchiveIndex, type ArchiveFacet } from '@/components/archive';
import { DocPage } from '@/components/sections/DocPage';
import { getRecordDigests, withCoverThumbs } from '@/lib/content/archive';
import {
  TESTIMONIES_PACKAGE,
  getTestimoniesManifest,
  getTestimonyIndex,
} from '@/lib/content/testimonies';
import { SITE_URL } from '@/lib/site-config';

const TAGLINE = 'First-hand accounts of October 7, held here in full.';
const PAGE_URL = `${SITE_URL}/october-7/testimonies`;
const BASE_PATH = '/october-7/testimonies';

const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  pt: 'Português',
};

export const metadata: Metadata = {
  title: 'Testimonies',
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
};

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

  const languages = manifest.languages.length;

  return (
    <DocPage
      routeId="october-7"
      // Both indexes and every record share this route, so each supplies the
      // seed that makes its slice of the corpus its own.
      backdropSeed="october-7/testimonies"
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
        one site. Each entry below names the witness, when the account was
        published, how much of it the archive holds, and which languages it
        exists in.
      </p>

      <ArchiveIndex
        variant="testimony"
        records={records}
        basePath={BASE_PATH}
        facets={facets}
        facetLegend="Language"
        searchLabel="Testimonies"
        searchHint="Filter by witness, place or words in the account"
      />

      <ArchiveFullIndex
        entries={index}
        basePath={BASE_PATH}
        heading="Every testimony"
      />
    </DocPage>
  );
}
