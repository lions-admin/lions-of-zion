import type { Metadata } from "next";
import Link from "next/link";
import { SectionPage } from "@/components/sections/SectionPage";
import { FigureRow, PublicationMeta, SourceList, Timeline } from "@/components/content";
import { getOctober7Record } from "@/lib/content/october-7";
import { getRecordDigests, manifestLanguages } from "@/lib/content/archive";
import {
  DOCUMENTATION_PACKAGE,
  getDocumentationGroups,
  getDocumentationManifest,
} from "@/lib/content/documentation";
import { getTestimoniesManifest } from "@/lib/content/testimonies";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";

const TAGLINE =
  "The record of October 7: testimony, evidence, and remembrance.";
const PAGE_URL = `${SITE_URL}/october-7`;

export async function generateMetadata(): Promise<Metadata> {
  const record = await getOctober7Record();
  const publishedTime = new Date(record.publishedAt).toISOString();
  return {
    title: "October 7",
    description: TAGLINE,
    alternates: { canonical: PAGE_URL },
    openGraph: {
      title: "October 7 — LIONS OF ZION",
      description: TAGLINE,
      type: "article",
      publishedTime,
    },
  };
}

function october7JsonLd(record: Awaited<ReturnType<typeof getOctober7Record>>) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "October 7",
    description: TAGLINE,
    url: PAGE_URL,
    datePublished: new Date(record.publishedAt).toISOString(),
    author: { "@type": "Organization", name: "Lions of Zion" },
    publisher: { "@type": "Organization", name: "Lions of Zion" },
    citation: record.timeline.flatMap((entry) =>
      (entry.sources ?? []).map((source) => source.url).filter((url): url is string => Boolean(url)),
    ),
  };
}

/**
 * The two doors, and everything a reader is owed before walking through one.
 *
 * This page carries no `SectionBlock` and therefore no `Reveal` (OCT-001). The
 * shared section wrapper stages every block with an entrance fade, which is
 * right on eight other routes and wrong on this one: a memorial does not
 * arrive. What replaces it is a plain `<section>` with an anchored `h2`, so
 * the contents rail still finds the page and nothing on it moves.
 */
export default async function Page() {
  const [record, testimonies, documentation, groups, digests] = await Promise.all([
    getOctober7Record(),
    getTestimoniesManifest(),
    getDocumentationManifest(),
    getDocumentationGroups(),
    getRecordDigests(DOCUMENTATION_PACKAGE),
  ]);

  // Read from each package's own manifest and index rather than written into
  // the copy, so a re-import cannot leave this page quoting a number that
  // moved. The film/photograph split is what the source actually published,
  // counted — not an estimate and not a description.
  const counts = {
    testimonies: testimonies.counts.records,
    documentation: documentation.counts.records,
    // Through the helper, never `.length`: october7's manifest writes
    // `languages` as a per-language count map, so the array read produced
    // `undefined` and this door shipped an empty "Languages" value.
    languages: manifestLanguages(testimonies).length,
    films: 0,
    photographs: 0,
  };
  for (const digest of digests.values()) {
    if (digest.medium === "video") counts.films += 1;
    else if (digest.medium === "image") counts.photographs += 1;
  }

  return (
    <SectionPage
      id="october-7"
      register="muted"
      surface="quiet"
      title="October 7"
      tagline={TAGLINE}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(october7JsonLd(record)) }}
      />

      <section className={styles.section} aria-labelledby="archives">
        <h2 className={styles.sectionHeading} id="archives">
          Testimony and documentation
        </h2>
        <p className={styles.lede}>
          Two archives are held here in full, reproduced as published — their
          text, their media and their credits unaltered. They are not the same
          kind of record, and they do not ask the same thing of a reader.
        </p>

        {/*
         * The doors are deliberately not a matched pair of cards.
         *
         * One holds people describing what happened to them; the other holds
         * film and photographs of it happening. Giving them identical anatomy
         * was the hub's real defect — a reader could not tell from this page
         * which of the two they were about to open, and arrived at 335 pieces
         * of graphic footage having been told only that it was "much of it".
         *
         * So each door is built out of its own facts: the testimony door out
         * of voices and languages, the documentation door out of a medium
         * count and the six categories the source filed it under, with the
         * advisory stated on the door rather than behind it.
         */}
        <div className={styles.doors}>
          <article className={styles.door} data-kind="testimony">
            <p className={styles.doorKind}>First-hand accounts</p>
            <h3 className={styles.doorTitle}>
              <Link className={styles.doorLink} href="/october-7/testimonies">
                Testimonies
              </Link>
            </h3>
            <p className={styles.doorText}>
              People describing what happened to them, archived from
              October7.org. Each record names the witness, when it was
              published, and how much of the account the archive holds.
            </p>
            <dl className={styles.doorFacts}>
              <div>
                <dt>Accounts</dt>
                <dd>{counts.testimonies}</dd>
              </div>
              <div>
                <dt>Languages</dt>
                <dd>{counts.languages}</dd>
              </div>
            </dl>
            {/* Stated before entry, and stated precisely: the words are not
                covered, because covering a witness's own account would be
                this archive refusing to say the thing it exists to say. */}
            <p className={styles.doorAdvisory}>
              <span className={styles.doorAdvisoryMark} aria-hidden="true" />
              The accounts are open text. Film published alongside them was
              recorded on the day and stays covered until you ask for it.
            </p>
          </article>

          <article className={styles.door} data-kind="documentation">
            <p className={styles.doorKind}>Films and photographs</p>
            <h3 className={styles.doorTitle}>
              <Link className={styles.doorLink} href="/october-7/documentation">
                Documentation
              </Link>
            </h3>
            <p className={styles.doorText}>
              What was recorded that day, archived from Hamas-Massacre.net in
              English and Spanish, kept in the categories the source filed it
              under.
            </p>
            <dl className={styles.doorFacts}>
              <div>
                <dt>Films</dt>
                <dd>{counts.films}</dd>
              </div>
              <div>
                <dt>Photographs</dt>
                <dd>{counts.photographs}</dd>
              </div>
            </dl>
            <ul className={styles.doorCategories}>
              {groups.map((group) => (
                <li key={group.slug}>
                  <span className={styles.doorCategoryName}>{group.title}</span>
                  <span className={styles.doorCategoryCount}>
                    {group.records.length}
                  </span>
                </li>
              ))}
            </ul>
            <p className={styles.doorAdvisory} data-severity="high">
              <span className={styles.doorAdvisoryMark} aria-hidden="true" />
              Every record in this archive is graphic. Nothing is shown until
              you ask for it, and nothing plays by itself.
            </p>
          </article>
        </div>

        <p>
          Holding them here means the record survives whatever happens to any
          one site. It does not make this the only place they live, and the
          archives below hold testimony these two do not — recorded interviews
          with survivors, first responders and bereaved families, gathered by
          people with the consent and the process to do it:
        </p>
        <SourceList sources={record.archives} />
      </section>

      <section className={styles.section} aria-labelledby="the-record">
        <h2 className={styles.sectionHeading} id="the-record">
          The record
        </h2>
        <p>
          What happened on October 7, 2023 was documented as it happened —
          by the perpetrators themselves, by survivors, by first responders,
          and by the forensic teams who came after. The figures below are
          drawn from public reporting; the fuller documentation is in the
          two archives above.
        </p>
        <div className={styles.inscription}>
          <FigureRow figures={record.figures} />
        </div>
        <p>
          Denial of that day is not treated here as an opinion to argue with
          but as a documented phenomenon the record and the archives above
          answer directly.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="what-followed">
        <h2 className={styles.sectionHeading} id="what-followed">
          What followed
        </h2>
        <div className={styles.record}>
          <Timeline variant="feed" entries={record.timeline} />
        </div>
      </section>

      {/* A colophon, not a masthead: `publishedAt` and `reviewedBy` were
          declared here for the JSON-LD only and reaching no reader, while the
          other three editorial destinations rendered the same two through
          `PublicationMeta`. At the foot, where a reader who has read the page
          is the one asking who checked it. */}
      <PublicationMeta
        publishedAt={record.publishedAt}
        reviewedBy={record.reviewedBy}
      />
    </SectionPage>
  );
}
