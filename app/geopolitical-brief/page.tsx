import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";

const TAGLINE =
  "The daily strategic picture: verified developments, their context, and what they change.";

export const metadata: Metadata = {
  title: "Geopolitical Brief — LIONS OF ZION",
  description: TAGLINE,
};

export default function Page() {
  return (
    <SectionPage id="geopolitical-brief" title="Geopolitical Brief" tagline={TAGLINE}>
      <SectionBlock heading="What a brief contains">
        <p>
          Every brief is built the same way. First, the development itself,
          stated plainly — what happened, where, and when. Then the sourcing
          behind it. Then the context that makes it legible: which actors are
          involved, what came before, what constraint or opportunity has
          shifted. Assessment is kept separate from reporting and labeled as
          assessment, so a reader always knows whether they are looking at what
          happened or at what we think it means.
        </p>
      </SectionBlock>

      <SectionBlock heading="Verification before publication">
        <p>
          Nothing enters a brief because it is trending. A development starts
          as a claim, and a claim earns its place by being checked: cross-read
          against independent sources, matched against official statements
          where they exist, and — for footage — geolocated and time-checked
          where the material allows it. Items that cannot yet be confirmed
          either wait or appear explicitly marked as unconfirmed. The brief is
          slower than the feed on purpose.
        </p>
      </SectionBlock>

      <SectionBlock heading="Reading the map">
        <p>
          The region is a system, not a list of headlines. Briefs treat it that
          way: state actors and their proxies, the alliances that constrain
          them, the supply lines and pressure points that connect a strike in
          one theater to a decision in another. Each entry names the actors
          involved and the interest being pursued, so that over time the daily
          picture accumulates into an understanding of the board — not just the
          latest move on it.
        </p>
      </SectionBlock>
    </SectionPage>
  );
}
