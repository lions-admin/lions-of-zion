import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";

const TAGLINE =
  "The people behind the story: the fallen, the fighters, the rescuers.";

export const metadata: Metadata = {
  title: "Our Heroes — LIONS OF ZION",
  description: TAGLINE,
};

export default function Page() {
  return (
    <SectionPage id="our-heroes" title="Our Heroes" tagline={TAGLINE}>
      <SectionBlock heading="The fallen">
        <p>
          Soldiers who fell in battle and civilians who died shielding others
          are remembered here one at a time. Each entry is a life, not a
          statistic: a name, a face, the people and places that made them, and
          the moment they gave everything. The aim is that no one who reads
          these pages can mistake the cost of this war for a number.
        </p>
      </SectionBlock>

      <SectionBlock heading="Those who ran toward danger">
        <p>
          On the hardest days, some people moved against the current — medics
          and paramedics, security volunteers, off-duty soldiers and police,
          civilians who drove toward the gunfire to pull strangers out. This
          section tells their stories: what they saw, what they decided in the
          seconds they had, and the lives that exist because of it.
        </p>
      </SectionBlock>

      <SectionBlock heading="How these stories are gathered">
        <p>
          Every story here begins with consent. Families decide whether a story
          is told, what it includes, and what stays private — and can change
          that decision at any time. What they entrust to us is then verified
          against official records and the accounts of those who were there
          before it is published. Nothing appears on these pages that the
          family has not seen and approved.
        </p>
      </SectionBlock>
    </SectionPage>
  );
}
