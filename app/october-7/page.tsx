import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";

const TAGLINE =
  "The record of October 7: testimony, evidence, and remembrance.";

export const metadata: Metadata = {
  title: "October 7",
  description: TAGLINE,
};

export default function Page() {
  return (
    <SectionPage id="october-7" register="muted" title="October 7" tagline={TAGLINE}>
      <SectionBlock heading="The record">
        <p>
          What happened on October 7 was documented as it happened — by the
          perpetrators themselves, by survivors, by first responders, and by
          the forensic teams who came after. This section preserves that
          record: footage with its chain of custody, forensic documentation,
          and the official findings that rest on them, organized so that each
          piece of evidence can be examined on its own terms.
        </p>
        <p>
          Denial of that day is not treated here as an opinion to argue with
          but as a documented phenomenon to answer. Where a denial narrative
          circulates, the record that refutes it is placed alongside — the
          evidence, not the outrage.
        </p>
      </SectionBlock>

      <SectionBlock heading="Testimony">
        <p>
          Survivors and first responders speak here in their own words.
          Testimony is presented as it was given — attributed with each
          witness’s consent, in their own language with translation, and never
          cut for effect. The role of this section is to carry the voice, not
          to shape it.
        </p>
      </SectionBlock>

      <SectionBlock heading="Remembrance">
        <p>
          Behind every number is a name, and behind every name a life. This
          section holds space for the murdered and the fallen of that day to be
          remembered as people — who they were, what they loved, who they
          leave behind — built with their families and at their families’
          pace.
        </p>
      </SectionBlock>
    </SectionPage>
  );
}
