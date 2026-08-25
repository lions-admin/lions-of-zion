import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";

const TAGLINE =
  "Who Lions of Zion are, why this network exists, and how it works.";

export const metadata: Metadata = {
  title: "We Are",
  description: TAGLINE,
};

export default function Page() {
  return (
    <SectionPage id="we-are" title="We Are" tagline={TAGLINE}>
      <SectionBlock heading="Who we are">
        <p>
          Lions of Zion is a network of volunteers — researchers, analysts,
          translators, designers, developers — who share one discipline:
          verify before you publish. The network exists because the
          information war against Israel is organized, funded, and fast, and
          because the answer to organized falsehood is not louder anger. It is
          organized evidence.
        </p>
      </SectionBlock>

      <SectionBlock heading="The method">
        <p>
          Everything published here moves through the same pipeline. Evidence
          first: a claim is traced to its origin, its material is checked, its
          sources are weighed. Human review second: no item goes out on one
          person’s say-so, and no automated system publishes on its own.
          Sources last and always: what we publish carries the evidence it
          rests on, so a reader never has to take our word for anything.
        </p>
      </SectionBlock>

      <SectionBlock heading="The line we hold">
        <p>
          The standard is truth, not advantage. A claim that would help the
          cause but does not hold up is a claim we do not publish — because a
          single falsehood, once found, is the weapon handed to everyone who
          wants to dismiss the rest. When we get something wrong, the
          correction is public and as prominent as the error. That is the
          line, and it is the entire point of the name on the door.
        </p>
      </SectionBlock>
    </SectionPage>
  );
}
