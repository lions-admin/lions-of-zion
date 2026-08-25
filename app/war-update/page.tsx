import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";

const TAGLINE =
  "Sourced, time-stamped updates from the front and the home front.";

export const metadata: Metadata = {
  title: "War Update",
  description: TAGLINE,
};

export default function Page() {
  return (
    <SectionPage id="war-update" title="War Update" tagline={TAGLINE}>
      <SectionBlock heading="How updates are sourced">
        <p>
          Every item published here carries its provenance: where the
          information originated, when it was recorded, and what its
          verification status is. An update is marked <strong>verified</strong>{" "}
          when it is confirmed by independent sources, <strong>reported</strong>{" "}
          when it rests on a single credible source, and{" "}
          <strong>disputed</strong> when credible sources conflict. The label
          travels with the item wherever it is shared. No update appears
          without one.
        </p>
      </SectionBlock>

      <SectionBlock heading="The front">
        <p>
          Operational updates draw on official statements cross-checked against
          open sources — footage, flight data, published imagery — and say only
          what that record supports. Where the fog is real, the update says so.
          There is no speculation about ongoing operations here, and nothing
          that could endanger the people carrying them out.
        </p>
      </SectionBlock>

      <SectionBlock heading="The home front">
        <p>
          The war is also lived far from the line: sirens and shelters,
          evacuated communities, the families of hostages, the slow work of
          rebuilding. Updates from the home front hold to the same standard as
          updates from the front — named sources, stated times — because the
          civilian record is the part most often distorted, and the part most
          worth getting right.
        </p>
      </SectionBlock>

      <SectionBlock heading="Corrections">
        <p>
          A network that verifies will still sometimes be wrong. When that
          happens, the correction is made as loud as the original claim: the
          item is amended in place, marked as corrected, and the change is
          announced through the same channels that carried the error. Corrected
          items are never quietly deleted — the record of the correction is
          part of the record.
        </p>
      </SectionBlock>
    </SectionPage>
  );
}
