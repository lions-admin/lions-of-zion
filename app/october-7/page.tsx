import type { Metadata } from "next";
import Link from "next/link";
import { ActivationBand, FigureRow, PublicationMeta, SourceList, Timeline } from "@/components/content";
import { EditorialShell } from "@/components/site/EditorialShell";
import { HubMasthead, HubUpdated } from "@/components/site/HubMasthead";
import { formatSourceDay } from "@/lib/format-date";
import { Icon } from "@/components/ui/Icon";
import { getOctober7Record } from "@/lib/content/october-7";
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
import { DOCUMENTATION_PACKAGE, categorySlug, getDocumentationGroups, getDocumentationManifest, getDocumentationRecord } from "@/lib/content/documentation";
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
    /* `formatSourceDay` — the site's one publisher-stated-day formatter, on
       the publisher's UTC day. This was a fourth hand-rolled `Intl` instance
       printing the same string until 2026-09-16. */
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

export default async function Page() {
  const [
    record,
    testimonies,
    documentation,
    groups,
    digests,
    testimonyIndex,
    testimonyMedia,
    documentationMedia,
  ] = await Promise.all([
    getOctober7Record(),
    getTestimoniesManifest(),
    getDocumentationManifest(),
    getDocumentationGroups(),
    getRecordDigests(DOCUMENTATION_PACKAGE),
    getTestimonyIndex(),
    getMediaRegistry("october7"),
    getMediaRegistry(DOCUMENTATION_PACKAGE),
  ]);
  const counts = { films: 0, photographs: 0 };
  for (const digest of digests.values()) {
    if (digest.medium === "video") counts.films += 1;
    else if (digest.medium === "image") counts.photographs += 1;
  }
  const categories = new Map(groups.map((group) => [group.slug, group.title]));
  const [stories, records] = await Promise.all([
    shareSamples(testimonyIndex, "testimony", new Map(), new Map(), "october7", testimonyMedia),
    shareSamples(groups.flatMap((group) => group.records), "documentation", categories, digests, DOCUMENTATION_PACKAGE, documentationMedia),
  ]);
  const storyCount = testimonies.counts.records;
  const recordCount = documentation.counts.records;
  const languageCount = manifestLanguages(testimonies).length;

  return (
    /* October 7 is a hub, and since 2026-09-16 it is built like one: the same
       `HubMasthead` inside the same 100rem container as the other three
       fronts, rather than the 68ch `SectionPage` shell it alone used. Its
       child routes — the testimony and documentation indexes and their
       records — stay on `SectionPage`, which is a reading shell and right
       for them.
       The memorial profile (no accent fill, the display step one weight
       lighter, the signal rule unlit and unbroken, fade-only entrances) is
       carried by `.page` on this route's own `<main>`. */
    <EditorialShell routeId="october-7" showProgress={false} className={styles.page}>
      <div className={styles.hub}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(october7JsonLd(record)) }} />

      <HubMasthead
        kicker="The record"
        title={<>October 7 Archive</>}
        standfirst={TAGLINE}
        status={<HubUpdated at={record.publishedAt} />}
        jumps={[
          { href: "#explore-archive", label: "The collections" },
          { href: "#archive-showcase", label: "From the archive" },
          { href: "#in-the-record", label: "In the record" },
          { href: "#what-followed", label: "What followed" },
        ]}
      />

      {/* UX-23. The counts used to open the page and then repeat on the two
          collection cards a viewport later. They print once now, on the cards,
          next to the collection each one measures; the language count stays
          on the testimony showcase's detail line. */}
      <section id="explore-archive" className={`${styles.archiveExplorer} enterQuiet`} aria-labelledby="explore-archive-heading">
        <header className={styles.explorerHeading}>
          <p className={styles.eyebrow}>Archive collections</p>
          <h2 id="explore-archive-heading">Explore the archive</h2>
        </header>
        <nav className={styles.archiveEntries} aria-label="Choose an archive collection">
          <Link className={styles.archiveEntry} href="/october-7/testimonies" data-measure-id="o7-entry-testimonies">
            <span className={styles.entryKind}>Testimony collection</span>
            <span className={styles.entryTitle}>Survivor Stories</span>
            <span className={styles.entryDescription}>First-person accounts from survivors and witnesses.</span>
            <span className={styles.entryCount}>
              <span className={styles.entryCountNumber}>{storyCount}</span>
              <span className={styles.entryCountUnit}>stories held</span>
            </span>
            <span className={styles.entryAction}>Read survivor stories <Icon name="arrow-right" size={19} /></span>
          </Link>

          <Link className={styles.archiveEntry} href="/october-7/documentation" data-measure-id="o7-entry-documentation">
            <span className={styles.entryKind}>Source record collection</span>
            <span className={styles.entryTitle}>Documented Records</span>
            <span className={styles.entryDescription}>Archived videos, images and source records preserved with provenance and context.</span>
            <span className={styles.entryCount}>
              <span className={styles.entryCountNumber}>{recordCount}</span>
              <span className={styles.entryCountUnit}>records held</span>
            </span>
            <span className={styles.entryAction}>Explore documented records <Icon name="arrow-right" size={19} /></span>
          </Link>
        </nav>
      </section>

      {/* The disclosure comes *before* the previews it describes. It ran after
          both showcases until now, which meant a reader met six preview cards
          drawn from a massacre archive and was told a viewport later that
          previews stay covered — the one sentence that answers "what am I
          about to see" arriving after they had already seen it. */}
      <p className={styles.sharingNote}>Graphic media stays covered in previews. Share the record — the original is one click behind the warning.</p>

      <div id="archive-showcase" className={`${styles.archiveShowcase} enterQuiet`}>
        <ArchiveShareShowcase kind="testimony" samples={stories} count={storyCount}
          detail={`Accounts available across ${languageCount} languages`} />
        <ArchiveShareShowcase kind="documentation" demoted samples={records} count={recordCount}
          detail={`${counts.films} films · ${counts.photographs} photographs`} />
      </div>

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

      <section id="in-the-record" className={styles.section} aria-labelledby="the-record">
        <h2 className={styles.sectionHeading} id="the-record">October 7, in the record</h2>
        <p>The attacks were documented by survivors, first responders, forensic teams and
          the perpetrators themselves. These figures come from public reporting;
          individual accounts and documentation are held in the archives above.</p>
        <div className={styles.inscription}><FigureRow figures={record.figures} /></div>
      </section>

      <section id="what-followed" className={styles.section} aria-labelledby="what-followed-heading">
        <h2 className={styles.sectionHeading} id="what-followed-heading">What followed October 7</h2>
        <div className={styles.record}><Timeline variant="feed" entries={record.timeline} /></div>
      </section>

      <section className={styles.section} aria-labelledby="more-archives">
        <h2 className={styles.sectionHeading} id="more-archives">Further testimony archives</h2>
        <p>These independent projects hold additional interviews with survivors,
          first responders and bereaved families.</p>
        <SourceList sources={record.archives} />
      </section>
      <PublicationMeta publishedAt={record.publishedAt} reviewedBy={record.reviewedBy} />
      {/* The ending this route lacked (Peak-End). It promised "yours to
          share" in its own standfirst and then stopped on a metadata
          footer. The band's sentence is this route's own, and the share
          carries the archive rather than a record. */}
      <ActivationBand
        heading="Yours to carry."
        share={{ url: PAGE_URL, text: "The October 7 archive — survivor testimony and documented records, held with their sources." }}
      />
      </div>
    </EditorialShell>
  );
}
