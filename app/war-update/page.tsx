import type { Metadata } from "next";
import Link from "next/link";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { PublicationMeta, SourceList, CorrectionHistory } from "@/components/content";
import { getWarUpdateEdition } from "@/lib/content/war-update";
import { SITE_URL } from "@/lib/site-config";
import { WireFeed } from "./WireFeed";
import styles from "./page.module.css";

const TAGLINE =
  "Sourced, time-stamped updates from the front and the home front.";

export const metadata: Metadata = {
  title: "War Update",
  description: TAGLINE,
  alternates: { canonical: `${SITE_URL}/war-update` },
  openGraph: {
    title: "War Update — LIONS OF ZION",
    description: TAGLINE,
    type: "article",
  },
};

export default async function Page() {
  const edition = await getWarUpdateEdition();
  const latestDate = edition.entries.reduce(
    (latest, entry) => (entry.datetime > latest ? entry.datetime : latest),
    edition.entries[0]?.datetime ?? edition.publishedAt,
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "War Update — documented ceasefire and diplomacy milestones",
    description: TAGLINE,
    datePublished: edition.publishedAt,
    dateModified: latestDate,
    author: { "@type": "Organization", name: "Lions of Zion" },
    publisher: { "@type": "Organization", name: "Lions of Zion" },
    url: `${SITE_URL}/war-update`,
  };

  return (
    <SectionPage id="war-update" title="War Update" tagline={TAGLINE} surface="quiet">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SectionBlock heading="Trust">
        <p className={styles.advisory}>
          <span className={styles.advisoryLabel}>Editor’s note —</span>{" "}
          {edition.trustStrip}
        </p>
        <p>
          Full sourcing standards and the corrections policy live on the{" "}
          <Link href="/methodology">Methodology</Link> page.
        </p>
      </SectionBlock>

      <PublicationMeta
        edition={edition.edition}
        publishedAt={edition.publishedAt}
        coverageWindow={edition.coverageWindow}
        reviewedBy={edition.reviewedBy}
        sourceCount={edition.sourceCount}
      />

      <SectionBlock heading={`Documented milestones · ${edition.coverageWindow}`}>
        <WireFeed entries={edition.entries} />
      </SectionBlock>

      <SectionBlock heading="Source stack">
        <SourceList sources={edition.sources} />
      </SectionBlock>

      <CorrectionHistory corrections={edition.corrections} />
    </SectionPage>
  );
}
