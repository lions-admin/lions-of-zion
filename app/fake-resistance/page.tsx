import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";

const TAGLINE =
  "Inside the influence machine: how manufactured outrage is built and amplified.";

export const metadata: Metadata = {
  title: "Fake Resistance",
  description: TAGLINE,
};

export default function Page() {
  return (
    <SectionPage id="fake-resistance" accent="ember" title="Fake Resistance" tagline={TAGLINE}>
      <SectionBlock heading="The machine">
        <p>
          Manufactured outrage has a supply chain. A claim is seeded by a small
          set of originating accounts, picked up by amplifier networks that
          exist to move volume, laundered through accounts that look organic,
          and finally carried by real people who believe they found it
          themselves. Recycled imagery — footage from other conflicts, other
          years, other continents — is the raw material. This section maps
          that chain, link by link, in the campaigns that target Israel.
        </p>
      </SectionBlock>

      <SectionBlock heading="The tells">
        <p>
          A manufactured wave looks spontaneous from inside and mechanical
          from above. The recurring signatures:
        </p>
        <ul>
          <li>
            Identical or near-identical phrasing across accounts with no
            connection to each other.
          </li>
          <li>
            Synchronized timing — a claim erupting everywhere at once, rather
            than spreading outward from a source.
          </li>
          <li>
            Amplifier accounts created in the same narrow window, with thin
            histories and borrowed profile material.
          </li>
          <li>
            Imagery that reverse-image search traces to a different time and
            place.
          </li>
        </ul>
        <p>
          None of these alone is proof. Together, and documented, they are a
          pattern — and patterns can be shown.
        </p>
      </SectionBlock>

      <SectionBlock heading="Case files">
        <p>
          Each documented campaign gets a file with the same structure: the
          claim as it spread, its point of origin, the amplification pattern,
          the evidence that unmade it, and archived links so the record
          survives deletion. The case files exist so that the next wave can be
          recognized from the last one — the machine changes its content far
          more often than it changes its method.
        </p>
      </SectionBlock>
    </SectionPage>
  );
}
