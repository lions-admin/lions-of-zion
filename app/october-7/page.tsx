import type { Metadata } from "next";
import Link from "next/link";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { FigureRow, SourceList, Timeline } from "@/components/content";
import { getOctober7Record } from "@/lib/content/october-7";
import { getDocumentationManifest } from "@/lib/content/documentation";
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

export default async function Page() {
  const [record, testimonies, documentation] = await Promise.all([
    getOctober7Record(),
    getTestimoniesManifest(),
    getDocumentationManifest(),
  ]);

  // Read from each package's own manifest rather than written into the copy,
  // so a re-import cannot leave this page quoting a number that moved.
  const counts = {
    testimonies: testimonies.counts.records,
    documentation: documentation.counts.records,
  };

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
      <SectionBlock heading="Testimony and documentation">
        <p>
          Two archives are held here in full, reproduced as published —
          their text, their media and their credits unaltered.
        </p>
        <ul className={styles.archiveEntries}>
          <li>
            <Link href="/october-7/testimonies">
              Testimonies — {counts.testimonies} first-hand accounts
            </Link>
            <span>
              Archived from October7.org, in up to seven languages. People
              describing what happened to them.
            </span>
          </li>
          <li>
            <Link href="/october-7/documentation">
              Documentation — {counts.documentation} records
            </Link>
            <span>
              Archived from Hamas-Massacre.net, in English and Spanish, filed
              under the six categories the source used. Much of it is graphic.
            </span>
          </li>
        </ul>
        <p>
          Holding them here means the record survives whatever happens to any
          one site. It does not make this the only place they live, and the
          archives below hold testimony these two do not — recorded interviews
          with survivors, first responders and bereaved families, gathered by
          people with the consent and the process to do it:
        </p>
        <SourceList sources={record.archives} />
      </SectionBlock>

      <SectionBlock heading="The record">
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
      </SectionBlock>

      <SectionBlock heading="What followed">
        <div className={styles.record}>
          <Timeline variant="feed" entries={record.timeline} />
        </div>
      </SectionBlock>
    </SectionPage>
  );
}
