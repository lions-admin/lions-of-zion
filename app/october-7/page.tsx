import type { Metadata } from "next";
import Link from "next/link";
import { SectionPage } from "@/components/sections/SectionPage";
import { FigureRow, PublicationMeta, SourceList, Timeline } from "@/components/content";
import { getOctober7Record } from "@/lib/content/october-7";
import { displayTitle, displayWitness, getRecordDigests, manifestLanguages, pickVersion, type ArchiveIndexEntry } from "@/lib/content/archive";
import { DOCUMENTATION_PACKAGE, categorySlug, getDocumentationGroups, getDocumentationManifest, getDocumentationRecord } from "@/lib/content/documentation";
import { getTestimoniesManifest, getTestimony, getTestimonyIndex } from "@/lib/content/testimonies";
import { buildShareQuote, facebookShareUrl, stripSourceBreadcrumb, xIntentUrl } from "@/lib/content/share-text";
import { SITE_URL } from "@/lib/site-config";
import { ArchiveShareShowcase, type ArchiveShareSample } from "./ArchiveShareShowcase";
import styles from "./page.module.css";

const TAGLINE = "Survivor stories and documented records. Read, share and preserve the context.";
const PAGE_URL = `${SITE_URL}/october-7`;

export async function generateMetadata(): Promise<Metadata> {
  const record = await getOctober7Record();
  return {
    title: "October 7",
    description: TAGLINE,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: "October 7 — LIONS OF ZION",
      description: TAGLINE,
      type: "article",
      publishedTime: new Date(record.publishedAt).toISOString(),
    },
  };
}

function october7JsonLd(record: Awaited<ReturnType<typeof getOctober7Record>>) {
  return {
    "@context": "https://schema.org", "@type": "Article",
    headline: "October 7", description: TAGLINE, url: PAGE_URL,
    datePublished: new Date(record.publishedAt).toISOString(),
    author: { "@type": "Organization", name: "Lions of Zion" },
    publisher: { "@type": "Organization", name: "Lions of Zion" },
    citation: record.timeline.flatMap((entry) =>
      (entry.sources ?? []).map((source) => source.url).filter((url): url is string => Boolean(url))),
  };
}

/** A small, deterministic cross-section, not a popularity or relevance ranking. */
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
    const timestamp = record.publication_date ? new Date(record.publication_date) : null;
    const date = timestamp && Number.isFinite(timestamp.getTime())
      ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(timestamp) : null;
    const attribution = `Source: ${source}${date ? ` · Published ${date}` : ""}`;
    const warning = kind === "documentation"
      ? "Content warning: graphic material. Open the record to choose whether to view."
      : "First-person testimony. Sensitive accounts; accompanying footage is covered.";
    const shareText = [title, kind === "testimony" && witness ? `Account: ${witness}` : "", attribution, warning].filter(Boolean).join("\n");
    const xText = [buildShareQuote(title, 110), attribution,
      kind === "documentation" ? "Content warning: graphic material." : "Survivor testimony · sensitive account."].join("\n");
    return {
      id: entry.id, title, href, url, source, date, witness,
      excerpt: kind === "testimony" && body !== title ? buildShareQuote(body, 230) : "",
      category: entry.category ? categories.get(entry.category) ?? null : null,
      medium: digests.get(entry.id)?.medium ?? "text",
      shareText, xHref: xIntentUrl(xText, url), facebookHref: facebookShareUrl(url),
    };
  }));
  return results.filter((entry): entry is ArchiveShareSample => entry !== null);
}

export default async function Page() {
  const [record, testimonies, documentation, groups, digests, testimonyIndex] = await Promise.all([
    getOctober7Record(), getTestimoniesManifest(), getDocumentationManifest(),
    getDocumentationGroups(), getRecordDigests(DOCUMENTATION_PACKAGE), getTestimonyIndex(),
  ]);
  const counts = { films: 0, photographs: 0 };
  for (const digest of digests.values()) {
    if (digest.medium === "video") counts.films += 1;
    else if (digest.medium === "image") counts.photographs += 1;
  }
  const categories = new Map(groups.map((group) => [group.slug, group.title]));
  const [stories, records] = await Promise.all([
    shareSamples(testimonyIndex, "testimony", new Map(), new Map()),
    shareSamples(groups.flatMap((group) => group.records), "documentation", categories, digests),
  ]);

  return (
    <SectionPage id="october-7" register="silent" surface="quiet" title="October 7" tagline={TAGLINE}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(october7JsonLd(record)) }} />
      <div className={styles.archiveIntro}>
        <p className={styles.eyebrow}>Help the record reach others</p>
        <p>Choose a survivor’s story or a documented record below. Read it, then share
          its link with the source and context intact.</p>
        <nav className={styles.collectionJump} aria-label="Choose an archive collection">
          <a href="#survivor-stories">Survivor stories</a>
          <a href="#documented-records">Documented records</a>
        </nav>
      </div>

      <div className={styles.archiveShowcase}>
        <ArchiveShareShowcase kind="testimony" samples={stories} count={testimonies.counts.records}
          detail={`Accounts available across ${manifestLanguages(testimonies).length} languages`} />
        <ArchiveShareShowcase kind="documentation" samples={records} count={documentation.counts.records}
          detail={`${counts.films} films · ${counts.photographs} photographs`} />
      </div>

      <details className={styles.categoryBrowser}>
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
      <p className={styles.sharingNote}>Preview selections contain text only. Original media stays in the archive record,
        behind its content warning where applicable. Sharing a link does not reveal media here.</p>

      <section className={styles.section} aria-labelledby="the-record">
        <h2 className={styles.sectionHeading} id="the-record">October 7, in the record</h2>
        <p>The attacks were documented by survivors, first responders, forensic teams and
          the perpetrators themselves. These figures come from public reporting;
          individual accounts and documentation are held in the archives above.</p>
        <div className={styles.inscription}><FigureRow figures={record.figures} /></div>
      </section>

      <section className={styles.section} aria-labelledby="what-followed">
        <h2 className={styles.sectionHeading} id="what-followed">What followed October 7</h2>
        <div className={styles.record}><Timeline variant="feed" entries={record.timeline} /></div>
      </section>

      <section className={styles.section} aria-labelledby="more-archives">
        <h2 className={styles.sectionHeading} id="more-archives">Further testimony archives</h2>
        <p>These independent projects hold additional interviews with survivors,
          first responders and bereaved families.</p>
        <SourceList sources={record.archives} />
      </section>
      <PublicationMeta publishedAt={record.publishedAt} reviewedBy={record.reviewedBy} />
    </SectionPage>
  );
}
