import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";

const TAGLINE =
  "The long arc: history, identity, and the context the noise leaves out.";

export const metadata: Metadata = {
  title: "Israel’s Story",
  description: TAGLINE,
};

export default function Page() {
  return (
    <SectionPage id="israels-story" title="Israel’s Story" tagline={TAGLINE}>
      <SectionBlock heading="The long arc">
        <p>
          The story of the Jewish people in this land is measured in millennia,
          not news cycles — a continuity of presence, language, memory, and
          return that modern Israel stands inside, not apart from. This
          section tells that arc the only way it can honestly be told: with
          dates, places, and sources, period by period, so the reader can
          follow the thread themselves rather than take a slogan on faith.
        </p>
      </SectionBlock>

      <SectionBlock heading="The context that gets cut">
        <p>
          A ten-second clip is an editing decision. It removes what happened
          the minute before, what stands outside the frame, and everything in
          the years that led to the moment it shows. This section does the
          opposite of the clip: it restores chronology. For the questions most
          often flattened into a caption — the wars, the offers, the
          withdrawals, the treaties — it lays out what happened in order, with
          the record for each step.
        </p>
      </SectionBlock>

      <SectionBlock heading="Sources and further reading">
        <p>
          Every historical claim made in this section is built to be checked.
          Each chapter closes with its sources — primary documents where they
          exist, scholarship where interpretation is needed — and a structured
          reading list for anyone who wants to go deeper than any website can
          take them. History told without footnotes is just another feed; this
          one comes with them.
        </p>
      </SectionBlock>
    </SectionPage>
  );
}
