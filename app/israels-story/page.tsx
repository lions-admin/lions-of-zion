import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { SourceList, Timeline } from "@/components/content";
import { getIsraelsStoryEdition } from "@/lib/content/israels-story";

const TAGLINE =
  "The long arc: history, identity, and the context the noise leaves out.";

export const metadata: Metadata = {
  title: "Israel’s Story",
  description: TAGLINE,
  openGraph: { title: "Israel’s Story — LIONS OF ZION", description: TAGLINE },
};

export default async function Page() {
  const edition = await getIsraelsStoryEdition();

  return (
    <SectionPage id="israels-story" surface="quiet" title="Israel’s Story" tagline={TAGLINE}>
      {edition.chapters.map((chapter) => (
        <SectionBlock key={chapter.id} heading={chapter.title} id={chapter.id}>
          <p>{chapter.intro}</p>
          <Timeline variant="history" entries={chapter.timeline} />
          <SourceList sources={chapter.sources} />
        </SectionBlock>
      ))}

      <SectionBlock heading="Sources and further reading">
        <p>
          This is a first edition: two chapters, chosen because they could
          be sourced and checked properly in the time available, not
          because they are the whole story. Every historical claim above is
          built to be checked — the dates and sources are cited inline.
          Later chapters (the ancient and biblical period, the 1967 and
          1973 wars, the Oslo Accords, the 1994 treaty with Jordan, and the
          2020 Abraham Accords) are real, documented history not yet
          detailed here — a known next step, not an omission to gloss over.
        </p>
      </SectionBlock>
    </SectionPage>
  );
}
