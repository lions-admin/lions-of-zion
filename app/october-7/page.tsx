import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { FigureRow, SourceList, Timeline } from "@/components/content";
import { getOctober7Record } from "@/lib/content/october-7";
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
  const record = await getOctober7Record();

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
      <SectionBlock heading="The record">
        <p>
          What happened on October 7, 2023 was documented as it happened —
          by the perpetrators themselves, by survivors, by first responders,
          and by the forensic teams who came after. The figures below are
          drawn from public reporting; deeper documentation lives with the
          real archives further down this page.
        </p>
        <div className={styles.inscription}>
          <FigureRow figures={record.figures} />
        </div>
        <p>
          Denial of that day is not treated here as an opinion to argue with
          but as a documented phenomenon the record and the archives below
          answer directly.
        </p>
      </SectionBlock>

      <SectionBlock heading="What followed">
        <div className={styles.record}>
          <Timeline variant="feed" entries={record.timeline} />
        </div>
      </SectionBlock>

      <SectionBlock heading="Testimony and remembrance">
        <p>
          This site does not host survivor testimony or build victim
          profiles here — that requires direct consent from the people
          involved, and there is no process yet to obtain it responsibly.
          What this page can do honestly is point to where that record
          already lives, gathered and held by people who do have that
          consent:
        </p>
        <SourceList sources={record.archives} />
      </SectionBlock>
    </SectionPage>
  );
}
