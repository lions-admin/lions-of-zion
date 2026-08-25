import type { Metadata } from "next";
import Link from "next/link";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { Timeline, PublicationMeta, SourceList, CorrectionHistory } from "@/components/content";
import { getWarUpdateEdition } from "@/lib/content/war-update";

const TAGLINE =
  "Sourced, time-stamped updates from the front and the home front.";

export const metadata: Metadata = {
  title: "War Update",
  description: TAGLINE,
  openGraph: { title: "War Update — LIONS OF ZION", description: TAGLINE },
};

export default async function Page() {
  const edition = await getWarUpdateEdition();

  return (
    <SectionPage id="war-update" title="War Update" tagline={TAGLINE} surface="quiet">
      <SectionBlock heading="Trust">
        <p>{edition.trustStrip}</p>
        <p>
          Full sourcing standards and the corrections policy live on the{" "}
          <Link href="/methodology">Methodology</Link> page.
        </p>
      </SectionBlock>

      <PublicationMeta
        edition={edition.edition}
        publishedAt={edition.publishedAt}
        reviewedBy={edition.reviewedBy}
        sourceCount={edition.sourceCount}
      />

      <SectionBlock heading={`Documented milestones · ${edition.coverageWindow}`}>
        <Timeline variant="feed" entries={edition.entries} />
      </SectionBlock>

      <SectionBlock heading="Source stack">
        <SourceList sources={edition.sources} />
      </SectionBlock>

      <CorrectionHistory corrections={edition.corrections} />
    </SectionPage>
  );
}
