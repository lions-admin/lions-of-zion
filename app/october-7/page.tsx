import type { Metadata } from "next";
import Link from "next/link";
import { ActivationBand } from "@/components/content";
import { EditorialShell } from "@/components/site/EditorialShell";
import { HubMasthead, HubUpdated } from "@/components/site/HubMasthead";
import { FigureRow, PublicationMeta, SourceList, Timeline } from "@/components/content";
import {
  Card,
  CardCount,
  CardCta,
  CardDescription,
  CardEyebrow,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { getOctober7Record } from "@/lib/content/october-7";
import { formatSourceDay } from "@/lib/format-date";
import {
  displayTitle,
  displayWitness,
  getMediaRegistry,
  getRecordDigests,
  manifestLanguages,
  pickVersion,
  type ArchiveIndexEntry,
  type ArchiveMedia,
  type ArchivePackageName,
} from "@/lib/content/archive";
import { firstArchiveSourceMedia } from "@/lib/content/archive-share";
import { DOCUMENTATION_PACKAGE, categorySlug, getDocumentationGroups, getDocumentationManifest, getDocumentationRecord, type DocumentationGroup } from "@/lib/content/documentation";
import { getTestimoniesManifest, getTestimony, getTestimonyIndex } from "@/lib/content/testimonies";
import { buildShareQuote, facebookShareUrl, stripSourceBreadcrumb, xIntentUrl } from "@/lib/content/share-text";
import { SITE_URL } from "@/lib/site-config";
import { ArchiveShareShowcase, type ArchiveShareSample } from "./ArchiveShareShowcase";
import styles from "./page.module.css";
import { pageMetadata } from "@/lib/page-metadata";

/* UX-02. The lede says what the reader gets and what they can do with it. */
const TAGLINE = "What happened, from the people it happened to. Documented, sourced, and yours to share.";
const PAGE_URL = `${SITE_URL}/october-7`;

export async function generateMetadata(): Promise<Metadata> {
  const record = await getOctober7Record();
  return pageMetadata({
    title: "October 7 Archive",
    description: TAGLINE,
    path: "/october-7",
    type: "article",
    publishedTime: new Date(record.publishedAt).toISOString(),
  });
}

function october7JsonLd(record: Awaited<ReturnType<typeof getOctober7Record>>) {
  return {
    "@context": "https://schema.org", "@type": "Article",
    headline: "October 7 Archive", description: TAGLINE, url: PAGE_URL,
    datePublished: new Date(record.publishedAt).toISOString(),
    author: { "@type": "Organization", name: "Lions of Zion" },
    publisher: { "@type": "Organization", name: "Lions of Zion" },
    citation: record.timeline.flatMap((entry) =>
      (entry.sources ?? []).map((source) => source.url).filter((url): url is string => Boolean(url))),
  };
}

function previewSelection(entries: ArchiveIndexEntry[]) {
  const eligible = entries.filter((entry) => entry.defaultLanguage === "en" && entry.title?.trim());
  const categories = new Set<string | null>();
  const titles = new Set<string>();
  const selected: ArchiveIndexEntry[] = [];
  for (const entry of eligible) {
    if (categories.has(entry.category) || titles.has(entry.title!)) continue;
    categories.add(entry.category);
    titles.add(entry.title!);
    selected.push(entry);
    if (selected.length === 6) return selected;
  }
  for (const entry of eligible) {
    if (titles.has(entry.title!)) continue;
    titles.add(entry.title!);
    selected.push(entry);
    if (selected.length === 6) break;
  }
  return selected;
}

async function shareSamples(
  entries: ArchiveIndexEntry[],
  kind: "testimony" | "documentation",
  categories: Map<string, string>,
  digests: Awaited<ReturnType<typeof getRecordDigests>>,
  pkg: ArchivePackageName,
  media: Map<string, ArchiveMedia>,
): Promise<ArchiveShareSample[]> {
  const results = await Promise.all(previewSelection(entries).map(async (entry) => {
    const record = await (kind === "testimony" ? getTestimony(entry.id) : getDocumentationRecord(entry.id));
    if (!record) return null;
    const version = pickVersion(record, "en");
    const title = displayTitle(version.title || entry.title || entry.id);
    const body = stripSourceBreadcrumb(version.full_text || version.excerpt || entry.excerpt).trim();
    const href = kind === "testimony"
      ? `/october-7/testimonies/${entry.id}`
      : `/october-7/documentation/${categorySlug(entry.category)}/${entry.id}`;
    const url = `${SITE_URL}${href}`;
    const source = kind === "testimony" ? "October7.org" : "Hamas-Massacre.net";
    const witness = record.witness_name ? displayWitness(record.witness_name) : null;
    /* The publisher's own calendar day, on the publisher's UTC day — the one
       exception the date policy names, and the reason this is formatSourceDay
       and not the desk's Jerusalem clock. */
    const date = record.publication_date ? formatSourceDay(record.publication_date) : null;
    const attribution = `Source: ${source}${date ? ` · Published ${date}` : ""}`;
    const warning = kind === "documentation"
      ? "Content warning: graphic material. Open the record to choose whether to view."
      : "First-person testimony. Sensitive accounts; accompanying footage is covered.";
    const shareText = [title, kind === "testimony" && witness ? `Account: ${witness}` : "", attribution, warning].filter(Boolean).join("\n");
    const xText = [buildShareQuote(title, 110), attribution,
      kind === "documentation" ? "Content warning: graphic material." : "Survivor testimony · sensitive account."].join("\n");
    const sourceMedia = firstArchiveSourceMedia(pkg, version, media);
    return {
      id: entry.id,
      title,
      href,
      url,
      source,
      date,
      witness,
      excerpt: kind === "testimony" && body !== title ? buildShareQuote(body, 230) : "",
      category: entry.category ? categories.get(entry.category) ?? null : null,
      medium: sourceMedia?.medium ?? digests.get(entry.id)?.medium ?? "text",
      shareText,
      xHref: xIntentUrl(xText, url),
      facebookHref: facebookShareUrl(url),
      xMedia: sourceMedia ? {
        ...sourceMedia,
        recordId: entry.id,
        locale: version.locale,
      } : null,
    };
  }));
  return results.filter((entry): entry is ArchiveShareSample => entry !== null);
}

type DocumentationRow = {
  id: string;
  title: string;
  category: string | null;
  href: string;
  /** The publisher-stated date, unformatted — printed with `formatSourceDay`. */
  date: string | null;
  medium: "video" | "image" | "text";
};

/**
 * The demoted documentation preview.
 *
 * The documentation showcase was a second full featured-record panel with its
 * own arrows and share controls — the same weight as the featured testimony,
 * on the one route where weight has to be held. It is demoted to a ledger:
 * rows, not panels, one quiet CTA each, and the sharing lives where it
 * belongs — on the record's own page, behind its gate.
 */
function documentationRows(groups: DocumentationGroup[], digests: Awaited<ReturnType<typeof getRecordDigests>>): DocumentationRow[] {
  const categoryTitles = new Map(groups.map((group) => [group.slug, group.title]));
  const index = groups.flatMap((group) => group.records);
  return previewSelection(index).map((entry) => ({
    id: entry.id,
    title: entry.title ?? "Documented record",
    category: entry.category ? categoryTitles.get(categorySlug(entry.category)) ?? null : null,
    href: `/october-7/documentation/${categorySlug(entry.category)}/${entry.id}`,
    date: entry.date ? formatSourceDay(entry.date) : null,
    medium: digests.get(entry.id)?.medium ?? "text",
  }));
}

export default async function Page() {
  const [
    record,
    testimonies,
    documentation,
    groups,
    digests,
    testimonyIndex,
    testimonyMedia,
  ] = await Promise.all([
    getOctober7Record(),
    getTestimoniesManifest(),
    getDocumentationManifest(),
    getDocumentationGroups(),
    getRecordDigests(DOCUMENTATION_PACKAGE),
    getTestimonyIndex(),
    getMediaRegistry("october7"),
  ]);
  const categories = new Map(groups.map((group) => [group.slug, group.title]));
  const stories = await shareSamples(testimonyIndex, "testimony", new Map(), new Map(), "october7", testimonyMedia);
  const rows = documentationRows(groups, digests);
  const storyCount = testimonies.counts.records;
  const recordCount = documentation.counts.records;
  const languageCount = manifestLanguages(testimonies).length;

  return (
    <EditorialShell routeId="october-7" showProgress={false} className={styles.page}>
      <div className={styles.hub}>
        <HubMasthead
          kicker="The record"
          title="October 7 Archive"
          standfirst={TAGLINE}
          status={<HubUpdated at={record.publishedAt} />}
          jumps={[
            { href: "#collections", label: "Archive collections" },
            { href: "#featured-testimony", label: "Featured testimony" },
            { href: "#the-record", label: "The record" },
            { href: "#what-followed", label: "What followed" },
          ]}
        />

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(october7JsonLd(record)) }} />

        {/* UX-23. The counts print once, on the collection each one measures. */}
        <Section
          id="collections"
          className={`${styles.archiveExplorer} enterQuiet`}
          aria-labelledby="explore-archive"
          kicker="Archive collections"
          heading="Explore the archive"
          headingId="explore-archive"
          headClassName={styles.archiveHead}
        >
          <nav className={styles.archiveEntries} aria-label="Choose an archive collection">
            <Card variant="tile" href="/october-7/testimonies" className={styles.archiveEntry} data-measure-id="o7-entry-testimonies">
              <CardHeader>
                <CardEyebrow>Testimony collection</CardEyebrow>
              </CardHeader>
              <CardTitle as="span">Survivor Stories</CardTitle>
              <CardDescription clamp>First-person accounts from survivors and witnesses, held in {languageCount} languages.</CardDescription>
              <span className={styles.entryCount}>
                <span className={styles.entryCountNumber}>{storyCount}</span>
                <span className={styles.entryCountUnit}>stories held</span>
              </span>
              <CardCta>Read survivor stories</CardCta>
            </Card>

            <Card variant="tile" href="/october-7/documentation" className={styles.archiveEntry} data-measure-id="o7-entry-documentation">
              <CardHeader>
                <CardEyebrow>Source record collection</CardEyebrow>
              </CardHeader>
              <CardTitle as="span">Documented Records</CardTitle>
              <CardDescription clamp>Archived videos, images and source records preserved with provenance and context.</CardDescription>
              <span className={styles.entryCount}>
                <span className={styles.entryCountNumber}>{recordCount}</span>
                <span className={styles.entryCountUnit}>records held</span>
              </span>
              <CardCta>Explore documented records</CardCta>
            </Card>
          </nav>
        </Section>

        {/* One featured record — the testimony. The documentation showcase was
            a second full panel with its own arrows, the same weight as this
            one, on the one route where weight has to be held; it is demoted
            to the ledger below. */}
        <section id="featured-testimony" className={`${styles.featured} enterQuiet`} aria-label="Featured testimony">
          <ArchiveShareShowcase kind="testimony" samples={stories} count={storyCount}
            detail={`Accounts available across ${languageCount} languages`} />
        </section>

        {/* The disclosure comes *before* the rows it describes: a reader meets
            graphic-source records and is told a viewport later that previews
            stay covered — the one sentence that answers "what am I about to
            see" arriving after they had already seen it. */}
        <Section
          id="documentation"
          className={`${styles.documentation} enterQuiet`}
          aria-labelledby="documentation-heading"
          heading="Documented records"
          headingId="documentation-heading"
          lede={`A selection of the ${recordCount} preserved source records. Each opens behind its own content warning.`}
          ledeSize="small"
          headClassName={styles.docsHead}
        >
          <p className={styles.mediaNotice}>
            <span className={styles.mediaNoticeLabel}>Content warning</span>
            Graphic material stays covered in previews. Share the record — the original is one click behind the warning.
          </p>
          <ol className={styles.docRows}>
            {rows.map((row) => (
              <li key={row.id}>
                {/* One documentation row, on the Card row composition with the
                    ruled headline. The warning is the row's own label — in the
                    warn state, never in the finding's device — and its CTA
                    carries the verb table's wording for a record behind a
                    warning. */}
                <Card variant="row" as="article" ledger className={styles.docRow}>
                  <CardHeader className={styles.docRowMeta}>
                    {row.category ? <CardEyebrow>{row.category}</CardEyebrow> : null}
                    <span className={styles.docWarningLabel}>Content warning · graphic material</span>
                    <CardCount>
                      {row.date ? <time dateTime={row.date}>{formatSourceDay(row.date)}</time> : null}
                    </CardCount>
                  </CardHeader>
                  <CardTitle as="h3"><Link href={row.href}>{row.title}</Link></CardTitle>
                  <CardFooter className={styles.docRowAction}>
                    <ButtonLink href={row.href} variant="text" size="md">
                      Open with a content warning
                    </ButtonLink>
                  </CardFooter>
                </Card>
              </li>
            ))}
          </ol>
          <details className={styles.categoryBrowser} data-measure-id="o7-categories">
            <summary>Browse documentation by category <span>{groups.length} categories</span></summary>
            <ul>
              {groups.map((group) => (
                <li key={group.slug}>
                  <Link href={`/october-7/documentation?category=${encodeURIComponent(group.slug)}`}>
                    <span>{group.title}</span><span>{group.records.length}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </Section>

        <Section
          id="the-record"
          className={`${styles.section} enterQuiet`}
          aria-labelledby="the-record-heading"
          heading="October 7, in the record"
          headingId="the-record-heading"
          headClassName={styles.sectionHead}
        >
          <p className={styles.sectionLede}>
            The attacks were documented by survivors, first responders, forensic teams and
            the perpetrators themselves. These figures come from public reporting;
            individual accounts and documentation are held in the archives above.
          </p>
          <div className={styles.inscription}><FigureRow figures={record.figures} /></div>
        </Section>

        <Section
          id="what-followed"
          className={`${styles.section} enterQuiet`}
          aria-labelledby="what-followed-heading"
          heading="What followed October 7"
          headingId="what-followed-heading"
          headClassName={styles.sectionHead}
        >
          <div className={styles.record}><Timeline variant="feed" entries={record.timeline} /></div>
        </Section>

        <Section
          className={`${styles.section} enterQuiet`}
          aria-labelledby="more-archives-heading"
          heading="Further testimony archives"
          headingId="more-archives-heading"
          headClassName={styles.sectionHead}
        >
          <p className={styles.sectionLede}>
            These independent projects hold additional interviews with survivors,
            first responders and bereaved families.
          </p>
          <SourceList sources={record.archives} />
        </Section>
        <PublicationMeta publishedAt={record.publishedAt} reviewedBy={record.reviewedBy} />

        {/* The band's sentence is this route's own, and it asks for the one
            act this archive exists for. */}
        <ActivationBand
          share={{ url: `${SITE_URL}/october-7`, text: "The October 7 archive — testimony and documented records, preserved with their sources." }}
          heading="Pass the record on."
          /* This hub's third action is the archive's own documentation
             collection, in the words the archive already uses for it. */
          extraAction={{ href: "/october-7/documentation", label: "Read the documented records" }}
        />
      </div>
    </EditorialShell>
  );
}
